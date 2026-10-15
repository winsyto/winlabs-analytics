import type { Prisma } from "@prisma/client";

/** Clases de tipo de ausencia (cfg_absenteeism_types.class). */
export const ABSENTEEISM_CLASSES = [
  { code: "medical", name: "Enfermedad", countsAsAbsence: true },
  { code: "accident", name: "Accidente", countsAsAbsence: true },
  { code: "unpaid", name: "Sin goce de haberes", countsAsAbsence: true },
  { code: "unjustified", name: "Sin aviso / injustificada", countsAsAbsence: true },
  { code: "suspension", name: "Suspensión", countsAsAbsence: true },
  { code: "personal", name: "Personal / familiar", countsAsAbsence: true },
  { code: "other", name: "Otra", countsAsAbsence: true },
  { code: "vacation", name: "Vacaciones", countsAsAbsence: false },
  { code: "legal_leave", name: "Licencia de ley", countsAsAbsence: false },
  { code: "day_off", name: "Franco", countsAsAbsence: false },
] as const;

export type AbsenteeismClass = (typeof ABSENTEEISM_CLASSES)[number]["code"];

/** Catálogo global de tipos de ausencia por defecto (se copia a cada tenant nuevo). */
export const ABSENTEEISM_TYPE_DEFAULTS: ReadonlyArray<{
  code: string;
  name: string;
  class: AbsenteeismClass;
  countsAsAbsence: boolean;
}> = [
  { code: "ENFERMEDAD", name: "Enfermedad", class: "medical", countsAsAbsence: true },
  { code: "ENFERMEDAD_FAMILIAR", name: "Enfermedad de familiar", class: "personal", countsAsAbsence: true },
  { code: "ACCIDENTE_TRABAJO", name: "Accidente de trabajo / ART", class: "accident", countsAsAbsence: true },
  { code: "SIN_GOCE", name: "Sin goce de haberes", class: "unpaid", countsAsAbsence: true },
  { code: "SIN_AVISO", name: "Ausencia sin aviso", class: "unjustified", countsAsAbsence: true },
  { code: "SUSPENSION", name: "Suspensión", class: "suspension", countsAsAbsence: true },
  { code: "MUDANZA", name: "Mudanza", class: "personal", countsAsAbsence: true },
  { code: "VACACIONES", name: "Vacaciones", class: "vacation", countsAsAbsence: false },
  { code: "MATERNIDAD", name: "Licencia por maternidad", class: "legal_leave", countsAsAbsence: false },
  { code: "PATERNIDAD", name: "Licencia por paternidad", class: "legal_leave", countsAsAbsence: false },
  { code: "MATRIMONIO", name: "Licencia por matrimonio", class: "legal_leave", countsAsAbsence: false },
  { code: "FALLECIMIENTO", name: "Licencia por fallecimiento", class: "legal_leave", countsAsAbsence: false },
  { code: "EXAMEN", name: "Licencia por examen", class: "legal_leave", countsAsAbsence: false },
  { code: "FRANCO_COMPENSATORIO", name: "Franco compensatorio", class: "day_off", countsAsAbsence: false },
];

/** Inserta/actualiza (idempotente) el catálogo global. Lo usan el seed de catálogo y el de dev. */
export async function upsertAbsenteeismTypeDefaults(client: {
  cfgAbsenteeismTypeDefault: Prisma.TransactionClient["cfgAbsenteeismTypeDefault"];
}): Promise<void> {
  for (const [i, t] of ABSENTEEISM_TYPE_DEFAULTS.entries()) {
    await client.cfgAbsenteeismTypeDefault.upsert({
      where: { code: t.code },
      update: { name: t.name, class: t.class, countsAsAbsence: t.countsAsAbsence, sortOrder: i + 1 },
      create: { ...t, sortOrder: i + 1 },
    });
  }
}

/**
 * Copia (idempotente) el catálogo global de tipos de ausencia a un tenant.
 * No pisa tipos existentes. Debe ejecutarse dentro de withTenantContext(tenantId, ...).
 */
export async function applyDefaultAbsenteeismTypes(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<void> {
  const defaults = await tx.cfgAbsenteeismTypeDefault.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  await tx.cfgAbsenteeismType.createMany({
    data: defaults.map((d) => ({
      tenantId,
      code: d.code,
      name: d.name,
      class: d.class,
      countsAsAbsence: d.countsAsAbsence,
      isClassified: true,
    })),
    skipDuplicates: true,
  });
}
