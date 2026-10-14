import { withTenantContext } from "@wla/auth";

export interface Dimension {
  /** Código del tipo de unidad organizativa (AREA, LOCATION, ...) */
  code: string;
  /** Nombre legible (Área, Sucursal, ...) */
  name: string;
  /** Código en minúsculas para URLs y parámetros */
  slug: string;
}

/** Mismo default que applyDefaultOrgConfig (@wla/db) y el worker, para tenants sin configuración. */
const DEFAULT_CODES = ["COMPANY", "LOCATION", "AREA", "POSITION", "CONTRACT"];

export const DASHBOARD_CODE = "headcount";

const toDimension = (code: string, name: string): Dimension => ({
  code,
  name,
  slug: code.toLowerCase(),
});

/** Dimensiones configuradas para el dashboard de headcount del tenant, en orden. */
export async function getDimensions(tenantId: string): Promise<Dimension[]> {
  return withTenantContext(tenantId, async (tx) => {
    const rows = await tx.dshDimension.findMany({
      where: { tenantId, dashboardCode: DASHBOARD_CODE },
      orderBy: { sortOrder: "asc" },
      select: { orgUnitTypeCode: true, unitType: { select: { name: true } } },
    });
    if (rows.length > 0) return rows.map((r) => toDimension(r.orgUnitTypeCode, r.unitType.name));

    const types = await tx.cfgOrgUnitType.findMany({
      where: { code: { in: DEFAULT_CODES } },
      orderBy: { sortOrder: "asc" },
      select: { code: true, name: true },
    });
    return types.map((t) => toDimension(t.code, t.name));
  });
}
