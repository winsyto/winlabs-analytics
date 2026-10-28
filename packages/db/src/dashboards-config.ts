import type { Prisma } from "@prisma/client";
import type { DashboardCode } from "./org-config";

/** Módulos de datos que activa un tenant (tenants.active_modules). */
export const DATA_MODULES = [
  { code: "people", name: "Personas" },
  { code: "time", name: "Asistencia" },
  { code: "payroll", name: "Liquidaciones" },
] as const;

export type DataModuleCode = (typeof DATA_MODULES)[number]["code"];

/** Agrupaciones del hub de dashboards (cfg_dashboards.category). */
export const DASHBOARD_CATEGORIES = [
  { code: "hr", name: "RRHH" },
  { code: "finance", name: "Finanzas" },
  { code: "other", name: "Otras" },
] as const;

export type DashboardCategory = (typeof DASHBOARD_CATEGORIES)[number]["code"];

/** Catálogo de dashboards (cfg_dashboards) y los módulos de datos que requiere cada uno. */
export const DASHBOARD_CATALOG: Record<
  DashboardCode,
  {
    name: string;
    description: string;
    route: string;
    requiredModules: readonly DataModuleCode[];
    sortOrder: number;
    category: DashboardCategory;
    /** Ícono lucide en kebab-case (lo traduce la app del cliente) */
    icon: string;
  }
> = {
  headcount: { name: "Headcount", description: "Dotación, altas, bajas y distribución por unidad", route: "/headcount", requiredModules: ["people"], sortOrder: 1, category: "hr", icon: "users-round" },
  absenteeism: { name: "Ausentismos", description: "Tasa de ausentismo contra la meta, por clase, tipo y unidad", route: "/absenteeism", requiredModules: ["people", "time"], sortOrder: 2, category: "hr", icon: "calendar-off" },
  overtime: { name: "Horas extras", description: "Tasa de horas extra contra la meta, por tipo y unidad", route: "/overtime", requiredModules: ["people", "time"], sortOrder: 3, category: "hr", icon: "timer" },
  turnover: { name: "Rotación", description: "Rotación contra la meta anual, por motivo, antigüedad y unidad", route: "/turnover", requiredModules: ["people"], sortOrder: 4, category: "hr", icon: "user-minus" },
  payroll: { name: "Payroll", description: "Masa salarial, costo por persona, composición por clase y por concepto", route: "/payroll", requiredModules: ["people", "payroll"], sortOrder: 5, category: "hr", icon: "wallet" },
};

/** Módulos que requiere un dashboard y el tenant no tiene activos. */
export function missingModules(code: DashboardCode, activeModules: readonly string[]): DataModuleCode[] {
  return DASHBOARD_CATALOG[code].requiredModules.filter((m) => !activeModules.includes(m));
}

/** Inserta o actualiza (idempotente) el catálogo global. Lo usan el seed de catálogo y el de desarrollo. */
export async function upsertDashboardCatalog(client: { cfgDashboard: Prisma.TransactionClient["cfgDashboard"] }): Promise<void> {
  for (const [code, d] of Object.entries(DASHBOARD_CATALOG)) {
    const data = { name: d.name, description: d.description, route: d.route, requiredModules: [...d.requiredModules], sortOrder: d.sortOrder, category: d.category, icon: d.icon, isActive: true };
    await client.cfgDashboard.upsert({ where: { code }, update: data, create: { code, ...data } });
  }
}

/**
 * Activa (idempotente) los dashboards cuyos módulos de datos están activos en el tenant. No apaga ni toca los que
 * ya existen. Debe ejecutarse dentro de withTenantContext(tenantId, ...).
 */
export async function applyDefaultDashboards(
  tx: Prisma.TransactionClient,
  tenantId: string,
  activeModules: readonly string[]
): Promise<void> {
  for (const code of Object.keys(DASHBOARD_CATALOG) as DashboardCode[]) {
    if (missingModules(code, activeModules).length > 0) continue;
    await tx.dshTenantDashboard.upsert({
      where: { uq_dsh_tenant_dashboards: { tenantId, dashboardCode: code } },
      update: {},
      create: { tenantId, dashboardCode: code, isEnabled: true },
    });
  }
}
