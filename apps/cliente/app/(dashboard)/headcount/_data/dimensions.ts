import { getDashboardDimensions, type Dimension } from "../../_dashboard-kit/dimensions";

export type { Dimension };

export const DASHBOARD_CODE = "headcount";

/** Dimensiones configuradas para el dashboard de headcount del tenant, en orden. */
export const getDimensions = (tenantId: string) => getDashboardDimensions(tenantId, DASHBOARD_CODE);
