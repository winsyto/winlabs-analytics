/**
 * Seed de catálogo para producción.
 * Solo inserta/actualiza datos de referencia globales (sin RLS).
 * NO crea tenants ni usuarios de prueba.
 *
 * Uso: pnpm --filter @wla/db db:seed:prod-catalog
 */
import { PrismaClient } from "@prisma/client";
import { TERMINATION_REASONS } from "./termination-reasons";
import { ORG_UNIT_TYPES } from "../org-config";

const prisma = new PrismaClient();

async function main() {
  // ── cfg_org_unit_types ───────────────────────────────────────────────────
  for (const t of ORG_UNIT_TYPES) {
    await prisma.cfgOrgUnitType.upsert({
      where:  { code: t.code },
      update: { name: t.name, description: t.description, sortOrder: t.sortOrder, isActive: true },
      create: { ...t, isActive: true },
    });
  }
  console.log(`✓ cfg_org_unit_types: ${ORG_UNIT_TYPES.length} registros`);

  // ── cfg_time_entry_types ─────────────────────────────────────────────────
  const timeEntryTypes = [
    { code: "REGULAR",   name: "Horas regulares",      category: "special",  sign:  1 },
    { code: "OVERTIME",  name: "Horas extra",           category: "overtime", sign:  1 },
    { code: "NIGHT",     name: "Horas nocturnas",       category: "overtime", sign:  1 },
    { code: "TRAINING",  name: "Capacitación",          category: "special",  sign:  1 },
    { code: "HOLIDAY",   name: "Día feriado",           category: "special",  sign:  1 },
    { code: "ABSENT",    name: "Ausencia",              category: "absence",  sign: -1 },
    { code: "SICK_LEAVE",name: "Licencia por enfermedad", category: "absence", sign: -1 },
  ];

  for (const t of timeEntryTypes) {
    await prisma.cfgTimeEntryType.upsert({
      where:  { code: t.code },
      update: { name: t.name, category: t.category, sign: t.sign, isActive: true },
      create: { ...t, isActive: true },
    });
  }
  console.log(`✓ cfg_time_entry_types: ${timeEntryTypes.length} registros`);

  // ── cfg_termination_reasons ──────────────────────────────────────────────
  for (const t of TERMINATION_REASONS) {
    await prisma.cfgTerminationReason.upsert({
      where:  { code: t.code },
      update: { name: t.name, category: t.category, isActive: true },
      create: { ...t, isActive: true },
    });
  }
  console.log(`✓ cfg_termination_reasons: ${TERMINATION_REASONS.length} registros`);

  // ── int_templates ────────────────────────────────────────────────────────
  const templates = [
    { code: "file_people",          name: "Archivo: Personas",                    category: "file", targetModel: "people" },
    { code: "file_time",            name: "Archivo: Asistencia",                  category: "file", targetModel: "time" },
    { code: "file_absenteeism",     name: "Archivo: Ausentismo",                  category: "file", targetModel: "absenteeism" },
    { code: "file_payroll",         name: "Archivo: Liquidaciones",               category: "file", targetModel: "payroll" },
    { code: "file_org_history", name: "Archivo: Historial de unidades organizativas", category: "file", targetModel: "org_history" },
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

  // Eliminar templates obsoletos (sin FK activas en prod)
  await prisma.intTemplate.deleteMany({
    where: { code: { in: ["api_manu"] } },
  });

  console.log(`✓ int_templates: ${templates.length} registros`);
  console.log("✓ Seed de catálogo completado.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
