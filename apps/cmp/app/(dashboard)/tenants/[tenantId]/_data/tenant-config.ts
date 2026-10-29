import { withTenantContext } from "@wla/auth";
import { DASHBOARD_CATALOG, DASHBOARD_CODES, TENANT_SETTINGS_DEFAULTS } from "@wla/db";
import type { AttendanceSettings } from "../_components/tenant-attendance-card";

/** Dashboards del catálogo en orden (nombre para las tarjetas de dimensiones). */
export const DASHBOARDS = [...DASHBOARD_CODES]
  .sort((x, y) => DASHBOARD_CATALOG[x].sortOrder - DASHBOARD_CATALOG[y].sortOrder)
  .map((code) => ({ code, label: DASHBOARD_CATALOG[code].name }));

export async function getEnabledDashboards(tenantId: string): Promise<string[]> {
  const rows = await withTenantContext(tenantId, (tx) =>
    tx.dshTenantDashboard.findMany({ where: { tenantId, isEnabled: true }, select: { dashboardCode: true } })
  );
  return rows.map((r) => r.dashboardCode);
}

/** Tipos de unidad habilitados del tenant y dimensiones de cada dashboard activo */
export async function getOrgConfig(tenantId: string, enabledDashboards: string[]) {
  const [allTypes, tenantTypes, dims] = await withTenantContext(tenantId, (tx) =>
    Promise.all([
      tx.cfgOrgUnitType.findMany({ orderBy: { sortOrder: "asc" } }),
      tx.cfgTenantOrgUnitType.findMany({ where: { tenantId } }),
      tx.dshDimension.findMany({ where: { tenantId }, orderBy: { sortOrder: "asc" } }),
    ])
  );
  const enabled = new Map(tenantTypes.map((t) => [t.orgUnitTypeCode, t.isEnabled]));
  return {
    types: allTypes.map((t) => ({
      code: t.code,
      name: t.name,
      description: t.description,
      enabled: enabled.get(t.code) ?? false,
    })),
    dashboards: DASHBOARDS.filter((d) => enabledDashboards.includes(d.code)).map((d) => ({
      ...d,
      dimensions: dims.filter((x) => x.dashboardCode === d.code).map((x) => x.orgUnitTypeCode),
    })),
  };
}

export async function getAttendanceSettings(tenantId: string): Promise<AttendanceSettings> {
  const row = await withTenantContext(tenantId, (tx) => tx.cfgTenantSetting.findUnique({ where: { tenantId } }));
  if (!row) return { ...TENANT_SETTINGS_DEFAULTS };
  return {
    attendanceMode: row.attendanceMode as AttendanceSettings["attendanceMode"],
    defaultWorkWeek: row.defaultWorkWeek,
    defaultDailyHours: Number(row.defaultDailyHours),
    absenceDisplay: row.absenceDisplay as AttendanceSettings["absenceDisplay"],
    overtimeBase: row.overtimeBase as AttendanceSettings["overtimeBase"],
    currency: row.currency,
  };
}
