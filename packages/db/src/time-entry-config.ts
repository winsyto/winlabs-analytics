import type { Prisma } from "@prisma/client";

/** Categorías de tipo de hora (cfg_tenant_time_entry_types.category). */
export const TIME_ENTRY_CATEGORIES = [
  { code: "regular", name: "Regular" },
  { code: "overtime", name: "Hora extra" },
  { code: "overtime_na", name: "Hora extra no autorizada" },
  { code: "training", name: "Capacitación" },
  { code: "holiday", name: "Feriado" },
  { code: "absence", name: "Ausencia" },
  { code: "other", name: "Otra" },
] as const;

export type TimeEntryCategory = (typeof TIME_ENTRY_CATEGORIES)[number]["code"];

/** Catálogo global de tipos de hora (se copia a cada tenant nuevo). */
export const TIME_ENTRY_TYPE_DEFAULTS: ReadonlyArray<{
  code: string;
  name: string;
  category: TimeEntryCategory;
  sign: 1 | -1;
}> = [
  { code: "REGULAR", name: "Horas regulares", category: "regular", sign: 1 },
  { code: "NIGHT", name: "Horas nocturnas", category: "regular", sign: 1 },
  { code: "TRAINING", name: "Capacitación", category: "training", sign: 1 },
  { code: "HOLIDAY", name: "Día feriado", category: "holiday", sign: 1 },
  { code: "ABSENT", name: "Ausencia", category: "absence", sign: -1 },
  { code: "SICK_LEAVE", name: "Licencia por enfermedad", category: "absence", sign: -1 },
  { code: "OVERTIME", name: "Horas extra", category: "overtime", sign: 1 },
  { code: "OT50", name: "Hora extra 50%", category: "overtime", sign: 1 },
  { code: "OT50OC", name: "Hora extra 50% otra categoría", category: "overtime", sign: 1 },
  { code: "OT100", name: "Hora extra 100%", category: "overtime", sign: 1 },
  { code: "OT100OC", name: "Hora extra 100% otra categoría", category: "overtime", sign: 1 },
  { code: "OTNIGHT", name: "Hora extra nocturna", category: "overtime", sign: 1 },
  { code: "OT50NA", name: "Hora extra 50% no autorizada", category: "overtime_na", sign: 1 },
  { code: "OT100NA", name: "Hora extra 100% no autorizada", category: "overtime_na", sign: 1 },
];

/** Inserta/actualiza (idempotente) el catálogo global. Lo usan el seed de catálogo y el de dev. */
export async function upsertTimeEntryTypeDefaults(client: {
  cfgTimeEntryType: Prisma.TransactionClient["cfgTimeEntryType"];
}): Promise<void> {
  for (const [i, t] of TIME_ENTRY_TYPE_DEFAULTS.entries()) {
    await client.cfgTimeEntryType.upsert({
      where: { code: t.code },
      update: { name: t.name, category: t.category, sign: t.sign, sortOrder: i + 1, isActive: true },
      create: { ...t, sortOrder: i + 1, isActive: true },
    });
  }
}

/**
 * Copia (idempotente) el catálogo global de tipos de hora a un tenant.
 * No pisa tipos existentes. Debe ejecutarse dentro de withTenantContext(tenantId, ...).
 */
export async function applyDefaultTimeEntryTypes(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<void> {
  const defaults = await tx.cfgTimeEntryType.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  await tx.cfgTenantTimeEntryType.createMany({
    data: defaults.map((d) => ({
      tenantId,
      code: d.code,
      name: d.name,
      category: d.category,
      sign: d.sign,
      isClassified: true,
      sortOrder: d.sortOrder,
    })),
    skipDuplicates: true,
  });
}
