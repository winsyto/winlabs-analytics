/**
 * Medición de rendimiento del motor de horas extra: tenant temporal con 3.000 personas y 12 meses de asistencia
 * diaria (~780 mil días y ~1 millón de horas por tipo). Mide con estadísticas viejas (recién cargado) y con
 * ANALYZE. Uso (desde apps/cliente):
 *   ../../packages/db/node_modules/.bin/tsx --env-file=.env.local scripts/bench-overtime.ts
 */
import { prisma, applyDefaultOrgConfig, applyDefaultTenantSettings } from "@wla/db";
import { withTenantContext } from "@wla/auth";
import { loadOvertime } from "../app/(dashboard)/overtime/_data/queries";
import type { Dimension } from "../app/(dashboard)/_dashboard-kit/dimensions";

const PEOPLE = Number(process.env.BENCH_PEOPLE ?? 3000);

async function main() {
  const slug = "tmp-ot-bench";
  await prisma.tenant.deleteMany({ where: { slug } }).catch(() => undefined);
  const tenant = await prisma.tenant.create({ data: { slug, name: "TMP bench overtime" } });
  const T = tenant.id;
  try {
    const areas: number[] = [];
    const locs: number[] = [];
    await withTenantContext(T, async (tx) => {
      await applyDefaultOrgConfig(tx, T);
      await applyDefaultTenantSettings(tx, T);
      for (const [type, n, arr] of [["AREA", 20, areas], ["LOCATION", 8, locs]] as const) {
        for (let i = 1; i <= n; i++) {
          const u = await tx.hrOrgUnit.create({ data: { tenantId: T, orgUnitTypeCode: type, code: `${type}${i}`, name: `${type} ${i}`, isActive: true, level: 0 } });
          arr.push(u.id);
        }
      }
      await tx.cfgTenantTimeEntryType.createMany({
        data: [
          { tenantId: T, code: "REGULAR", name: "Horas regulares", category: "regular", sign: 1 },
          { tenantId: T, code: "OT50", name: "Hora extra 50%", category: "overtime", sign: 1 },
          { tenantId: T, code: "OT100", name: "Hora extra 100%", category: "overtime", sign: 1 },
          { tenantId: T, code: "OT50NA", name: "Hora extra 50% no autorizada", category: "overtime_na", sign: 1 },
        ],
      });
      await tx.$executeRawUnsafe(
        `INSERT INTO hr_people (tenant_id, employee_code, full_name, hire_date, status, updated_at)
         SELECT '${T}'::uuid, 'B' || i, 'B' || i, '2024-01-01', 'active', now() FROM generate_series(1, ${PEOPLE}) i`
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO hr_people_org_assignments (tenant_id, person_id, org_unit_id, org_unit_type_code, valid_from)
         SELECT '${T}'::uuid, p.id, (ARRAY[${areas.join(",")}])[1 + (p.id % ${areas.length})], 'AREA', '2024-01-01'
         FROM hr_people p WHERE p.tenant_id = '${T}'::uuid`
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO hr_people_org_assignments (tenant_id, person_id, org_unit_id, org_unit_type_code, valid_from)
         SELECT '${T}'::uuid, p.id, (ARRAY[${locs.join(",")}])[1 + (p.id % ${locs.length})], 'LOCATION', '2024-01-01'
         FROM hr_people p WHERE p.tenant_id = '${T}'::uuid`
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO att_time_daily (tenant_id, person_id, date, is_working_day, scheduled_hours, worked_hours, has_absence, updated_at)
         SELECT '${T}'::uuid, p.id, d::date, true, 8, 8, false, now()
         FROM hr_people p, generate_series('2025-10-01'::date, '2026-09-30'::date, '1 day') d
         WHERE p.tenant_id = '${T}'::uuid AND extract(isodow FROM d) <= 5`
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO att_time_daily_entries (tenant_id, time_daily_id, time_entry_type_id, hours)
         SELECT '${T}'::uuid, d.id, (SELECT id FROM cfg_tenant_time_entry_types WHERE tenant_id = '${T}'::uuid AND code = 'REGULAR'), 8
         FROM att_time_daily d WHERE d.tenant_id = '${T}'::uuid`
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO att_time_daily_entries (tenant_id, time_daily_id, time_entry_type_id, hours)
         SELECT '${T}'::uuid, d.id,
                (SELECT id FROM cfg_tenant_time_entry_types WHERE tenant_id = '${T}'::uuid AND code = CASE WHEN d.id % 10 = 0 THEN 'OT100' WHEN d.id % 17 = 0 THEN 'OT50NA' ELSE 'OT50' END),
                1.5
         FROM att_time_daily d WHERE d.tenant_id = '${T}'::uuid AND (d.id % 5 = 0 OR d.id % 17 = 0)`
      );
    }, { timeout: 300_000 });

    const [counts] = await withTenantContext(T, (tx) =>
      tx.$queryRawUnsafe<{ d: bigint; e: bigint }[]>(
        `SELECT (SELECT count(*) FROM att_time_daily WHERE tenant_id = '${T}'::uuid) AS d,
                (SELECT count(*) FROM att_time_daily_entries WHERE tenant_id = '${T}'::uuid) AS e`
      )
    );
    console.log(`Datos: ${PEOPLE} personas · ${counts?.d ?? "?"} días · ${counts?.e ?? "?"} filas de horas`);

    const dims: Dimension[] = [
      { code: "AREA", name: "Área", slug: "area" },
      { code: "LOCATION", name: "Sucursal", slug: "location" },
    ];
    const run = async (label: string) => {
      for (const p of ["month", "12m", "year"] as const) {
        const t0 = Date.now();
        const data = await loadOvertime(T, { p, dims: {}, types: [] }, dims);
        const ms = Date.now() - t0;
        const rate = data.status === "ok" ? data.kpis.rate.value?.toFixed(2) : data.status;
        console.log(`${label} · ${p.padEnd(5)} ${String(ms).padStart(6)} ms · tasa ${rate} %`);
      }
    };
    await run("estadísticas viejas");
    await prisma.$executeRawUnsafe("ANALYZE att_time_daily");
    await prisma.$executeRawUnsafe("ANALYZE att_time_daily_entries");
    await prisma.$executeRawUnsafe("ANALYZE hr_people_org_assignments");
    await prisma.$executeRawUnsafe("ANALYZE hr_people");
    await run("con ANALYZE        ");
  } finally {
    await withTenantContext(T, async (tx) => {
      for (const t of ["att_time_daily_entries", "att_time_daily", "cfg_tenant_time_entry_types", "hr_people_history", "hr_people_org_assignments", "hr_people", "hr_shift_schedules", "hr_org_units", "dsh_dimensions", "cfg_tenant_org_unit_types"]) {
        await tx.$executeRawUnsafe(`DELETE FROM ${t} WHERE tenant_id = '${T}'::uuid`);
      }
    }, { timeout: 900_000 });
    await prisma.tenant.delete({ where: { id: T } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
