import { auth } from "@/auth";
import { withTenantContext } from "@wla/auth";
import type { DashboardCode } from "@wla/db";
import { LockKeyhole } from "lucide-react";

/** Códigos de los dashboards activos del tenant (hub de dashboards, administrado desde el CMP). */
export async function enabledDashboards(tenantId: string): Promise<string[]> {
  const rows = await withTenantContext(tenantId, (tx) =>
    tx.dshTenantDashboard.findMany({
      where: { tenantId, isEnabled: true, dashboard: { isActive: true } },
      select: { dashboardCode: true },
    })
  );
  return rows.map((r) => r.dashboardCode);
}

export async function isDashboardEnabled(tenantId: string, code: DashboardCode): Promise<boolean> {
  return (await enabledDashboards(tenantId)).includes(code);
}

/**
 * Envuelve un dashboard: si no está activo para el tenant muestra un aviso en lugar de su contenido, aunque se
 * llegue por la URL. Se usa en el layout de cada dashboard.
 */
export async function DashboardGuard({ code, children }: { code: DashboardCode; children: React.ReactNode }) {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (tenantId && !(await isDashboardEnabled(tenantId, code))) {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center p-8">
        <div role="status" className="max-w-md rounded-lg border bg-card p-8 text-center">
          <LockKeyhole className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
          <h1 className="text-lg font-bold text-foreground">Dashboard no habilitado</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este dashboard no está activo para tu empresa. Si lo necesitás, pedile a tu administrador de WinLabs que lo habilite.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
