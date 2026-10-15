/**
 * Limpia los datos de dominio cargados por archivos/integraciones de UN tenant
 * (personas, asistencia, ausentismo, liquidaciones, historial, unidades organizativas).
 *
 * NO borra: el tenant, sus usuarios, la configuración (tipos de unidad organizativa y
 * dimensiones), ni las integraciones configuradas. El historial de ejecuciones
 * (jobs / int_runs) se borra solo con --include-runs.
 *
 * Por defecto es una simulación (dry-run): muestra qué se borraría. Para ejecutar de verdad
 * hay que pasar --confirm.
 *
 * Uso:
 *   pnpm --filter @wla/db db:cleanup:tenant -- --tenant=acme              (local, simulación)
 *   pnpm --filter @wla/db db:cleanup:tenant -- --tenant=acme --confirm    (local, ejecuta)
 *   pnpm --filter @wla/db db:cleanup:tenant:prod -- --tenant=acme --confirm   (producción)
 */
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const slug = value("tenant");
const confirm = flag("confirm");
const includeRuns = flag("include-runs");

if (!slug) {
  console.error("Falta --tenant=<slug>.");
  process.exit(1);
}

const prisma = new PrismaClient();

// Orden de borrado respetando claves foráneas
const TABLES = [
  "att_time_daily_entries",
  "att_time_daily",
  "att_absenteeism_events",
  "pay_entries",
  "pay_periods",
  "pay_concepts",
  "cfg_absenteeism_types",
  "hr_people_history",
  "hr_people_org_assignments",
  "hr_people",
  "hr_shift_schedules",
  "hr_org_units",
] as const;

const RUN_TABLES = ["job_events", "job_checkpoints", "job_runs", "jobs", "int_run_errors", "int_runs"] as const;

function dbTarget(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(DATABASE_URL no disponible)";
  }
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant "${slug}" no existe.`);

  console.log(`Base de datos: ${dbTarget()}`);
  console.log(`Tenant: ${tenant.name} (${tenant.slug}) ${tenant.id}`);
  console.log(confirm ? "MODO: EJECUCIÓN (--confirm)" : "MODO: simulación (agregá --confirm para borrar)");
  console.log();

  const tables = includeRuns ? [...RUN_TABLES, ...TABLES] : [...TABLES];

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.id}, true)`;

      for (const table of tables) {
        const rows = await tx.$queryRawUnsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM ${table} WHERE tenant_id = $1::uuid`,
          tenant.id
        );
        console.log(`  ${table.padEnd(28)} ${String(rows[0]?.n ?? 0).padStart(8)} filas`);
      }

      if (!confirm) return;

      // Referencias circulares dentro de las tablas a borrar
      await tx.$executeRaw`UPDATE hr_people SET manager_id = NULL WHERE tenant_id = ${tenant.id}::uuid`;
      await tx.$executeRaw`UPDATE hr_org_units SET parent_org_unit_id = NULL WHERE tenant_id = ${tenant.id}::uuid`;
      for (const table of tables) {
        await tx.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id = $1::uuid`, tenant.id);
      }
    },
    { timeout: 120_000 }
  );

  console.log();
  console.log(confirm ? "Listo: datos eliminados." : "Simulación terminada. No se borró nada.");
}

main()
  .catch((e) => {
    console.error("Error:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
