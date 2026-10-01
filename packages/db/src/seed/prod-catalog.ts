/**
 * Seed de catálogo para producción.
 * Solo inserta/actualiza datos de referencia globales (sin RLS).
 * NO crea tenants ni usuarios de prueba.
 *
 * Uso: pnpm --filter @wla/db db:seed:prod-catalog
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ── int_templates ────────────────────────────────────────────────────────
  const templates = [
    { code: "file_people",          name: "Archivo: Personas",                    category: "file", targetModel: "people" },
    { code: "file_time",            name: "Archivo: Asistencia",                  category: "file", targetModel: "time" },
    { code: "file_absenteeism",     name: "Archivo: Ausentismo",                  category: "file", targetModel: "absenteeism" },
    { code: "file_payroll",         name: "Archivo: Liquidaciones",               category: "file", targetModel: "payroll" },
    { code: "api_mandu_visma_hr",   name: "API Mandú/Visma (HR)",                 category: "api",  targetModel: "people" },
    { code: "api_mandu_visma_full", name: "API Mandú/Visma (HR + Liquidaciones)", category: "api",  targetModel: "people_payroll" },
    { code: "api_geovictoria",      name: "API Geovictoria (T&A)",                category: "api",  targetModel: "time" },
  ];

  for (const t of templates) {
    await prisma.intTemplate.upsert({
      where: { code: t.code },
      update: { name: t.name, isActive: true },
      create: { ...t, isActive: true },
    });
  }

  // Desactivar templates obsoletos
  await prisma.intTemplate.updateMany({
    where: { code: { in: ["api_manu"] } },
    data: { isActive: false },
  });

  console.log(`✓ int_templates: ${templates.length} registros`);
  console.log("✓ Seed de catálogo completado.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
