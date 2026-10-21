import type { Prisma } from "@prisma/client";

/** Tipos estándar de concepto de liquidación (pay_concepts.concept_type). Vocabulario fijo. */
export const PAY_CONCEPT_TYPES = [
  { code: "salary", name: "Sueldo remunerativo" },
  { code: "sac", name: "SAC / aguinaldo" },
  { code: "additional", name: "Adicionales" },
  { code: "family_allowance", name: "Asignaciones familiares" },
  { code: "non_remunerative", name: "No remunerativos" },
  { code: "employee_contribution", name: "Aportes del empleado" },
  { code: "income_tax", name: "Impuesto a las ganancias" },
  { code: "deductions", name: "Descuentos" },
  { code: "garnishments", name: "Embargos" },
  { code: "loans", name: "Préstamos" },
  { code: "employer_contribution", name: "Contribuciones patronales" },
  { code: "provisions", name: "Provisiones" },
  { code: "accumulators", name: "Acumuladores" },
] as const;

export type PayConceptType = (typeof PAY_CONCEPT_TYPES)[number]["code"];

/** Tipos de proceso de liquidación (pay_processes.process_type). */
export const PAY_PROCESS_TYPES = [
  { code: "monthly", name: "Mensual" },
  { code: "biweekly", name: "Quincenal" },
  { code: "weekly", name: "Semanal" },
  { code: "sac", name: "SAC" },
  { code: "adjustments", name: "Ajustes" },
  { code: "provisions", name: "Provisiones" },
  { code: "final_settlement", name: "Liquidación final" },
  { code: "vacation", name: "Vacaciones" },
] as const;

export type PayProcessType = (typeof PAY_PROCESS_TYPES)[number]["code"];

/** Qué acumulador es el sueldo bruto y cuál el neto (pay_concepts.reference_total). */
export const PAY_REFERENCE_TOTALS = [
  { code: "gross", name: "Sueldo bruto" },
  { code: "net", name: "Sueldo neto" },
] as const;

export type PayReferenceTotal = (typeof PAY_REFERENCE_TOTALS)[number]["code"];

export const PAY_CLASS_SIDES = [
  { code: "earning", name: "Haber" },
  { code: "deduction", name: "Retención" },
] as const;

export type PayClassSide = (typeof PAY_CLASS_SIDES)[number]["code"];

/** Clases base de un tenant nuevo (editables) y los tipos de concepto que agrupan por defecto. */
export const PAY_CLASS_DEFAULTS: ReadonlyArray<{
  code: string;
  name: string;
  side: PayClassSide;
  types: readonly PayConceptType[];
}> = [
  { code: "sueldo", name: "Sueldo", side: "earning", types: ["salary", "sac"] },
  { code: "horas_extra", name: "Horas extra", side: "earning", types: [] },
  { code: "bonos", name: "Bonos", side: "earning", types: [] },
  { code: "otros_haberes", name: "Otros haberes", side: "earning", types: ["additional", "family_allowance", "non_remunerative"] },
  { code: "impuestos", name: "Impuestos y aportes", side: "deduction", types: ["employee_contribution", "income_tax"] },
  { code: "otras_retenciones", name: "Otras retenciones", side: "deduction", types: ["deductions", "garnishments", "loans"] },
];

/**
 * Crea (idempotente) las clases base de un tenant y sus reglas por tipo. No pisa clases ni reglas existentes.
 * Debe ejecutarse dentro de withTenantContext(tenantId, ...).
 */
export async function applyDefaultPayrollClasses(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<void> {
  for (const [i, c] of PAY_CLASS_DEFAULTS.entries()) {
    const cls = await tx.payConceptClass.upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      update: {},
      create: { tenantId, code: c.code, name: c.name, side: c.side, sortOrder: i + 1 },
    });
    for (const conceptType of c.types) {
      const exists = await tx.payClassRule.findFirst({ where: { tenantId, conceptType } });
      if (!exists) await tx.payClassRule.create({ data: { tenantId, classId: cls.id, conceptType } });
    }
  }
}
