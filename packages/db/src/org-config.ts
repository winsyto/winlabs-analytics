import type { Prisma } from "@prisma/client";

/** Catálogo global de tipos de unidad organizativa (ordenado). */
export const ORG_UNIT_TYPES = [
  { code: "COMPANY", name: "Empresa", description: "Empresa / razón social dentro del grupo del cliente" },
  { code: "LOCATION", name: "Sucursal", description: "Lugar de trabajo / sede" },
  { code: "AREA", name: "Área", description: "Área / sector" },
  { code: "POSITION", name: "Puesto", description: "Cargo / puesto" },
  { code: "CONTRACT", name: "Contrato", description: "Tipo de contrato (tiempo determinado, indeterminado, pasante, etc.)" },
  { code: "DEPARTMENT", name: "Departamento", description: "Subdivisión de un área" },
  { code: "COST_CENTER", name: "Centro de costos", description: "Unidad de imputación contable" },
  { code: "MANAGEMENT", name: "Gerencia", description: "Gerencia" },
  { code: "CATEGORY", name: "Categoría", description: "Categoría laboral" },
  { code: "SHIFT", name: "Turno", description: "Agrupación para tiempos y asistencia" },
  { code: "UNION", name: "Sindicato", description: "Sindicato" },
  { code: "AGREEMENT", name: "Convenio", description: "Convenio colectivo" },
  { code: "PAY_FREQUENCY", name: "Forma de liquidación", description: "Mensual, quincenal, semanal, etc." },
  { code: "AGENCY", name: "Agencia", description: "Agencia (personal contratado por tercero)" },
  { code: "ART", name: "ART", description: "Aseguradora de Riesgos del Trabajo" },
].map((t, i) => ({ ...t, sortOrder: i + 1 }));

/** Dimensiones por defecto de los dashboards (también los tipos que la carga de personas exige). */
export const DEFAULT_DIMENSION_TYPES = ["COMPANY", "LOCATION", "AREA", "POSITION", "CONTRACT"] as const;

/** Tipos habilitados por defecto: las dimensiones por defecto más SHIFT (opcional, para turnos y horarios). */
export const DEFAULT_ENABLED_TYPES = [...DEFAULT_DIMENSION_TYPES, "SHIFT"] as const;

export const DASHBOARD_CODES = ["headcount", "absenteeism", "overtime", "turnover", "payroll"] as const;
export type DashboardCode = (typeof DASHBOARD_CODES)[number];

/** Dimensiones por defecto de cada dashboard. */
export const DEFAULT_DASHBOARD_DIMENSIONS: Record<DashboardCode, readonly string[]> = {
  headcount: DEFAULT_DIMENSION_TYPES,
  absenteeism: DEFAULT_DIMENSION_TYPES,
  overtime: DEFAULT_DIMENSION_TYPES,
  turnover: DEFAULT_DIMENSION_TYPES,
  payroll: DEFAULT_DIMENSION_TYPES,
};

/**
 * Crea (idempotente) la configuración por defecto de unidades organizativas de un tenant.
 * Debe ejecutarse dentro de withTenantContext(tenantId, ...).
 */
export async function applyDefaultOrgConfig(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<void> {
  for (const t of ORG_UNIT_TYPES) {
    const enabled = (DEFAULT_ENABLED_TYPES as readonly string[]).includes(t.code);
    await tx.cfgTenantOrgUnitType.upsert({
      where: { uq_cfg_tenant_org_unit_types: { tenantId, orgUnitTypeCode: t.code } },
      update: {},
      create: { tenantId, orgUnitTypeCode: t.code, isEnabled: enabled, sortOrder: t.sortOrder },
    });
  }
  for (const dashboardCode of DASHBOARD_CODES) {
    for (const code of DEFAULT_DASHBOARD_DIMENSIONS[dashboardCode]) {
      const sortOrder = ORG_UNIT_TYPES.find((t) => t.code === code)!.sortOrder;
      await tx.dshDimension.upsert({
        where: { uq_dsh_dimensions: { tenantId, dashboardCode, orgUnitTypeCode: code } },
        update: {},
        create: { tenantId, dashboardCode, orgUnitTypeCode: code, sortOrder },
      });
    }
  }
}
