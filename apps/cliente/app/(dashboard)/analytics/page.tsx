import { auth } from "@/auth";
import { withTenantContext } from "@wla/auth";
import { DASHBOARD_CATEGORIES } from "@wla/db";
import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@wla/ui";
import { dashboardIcon } from "../_components/dashboard-icons";
import { HubCard, HubGroup } from "../_components/hub-card";
import { enabledDashboards } from "../_dashboard-kit/dashboard-access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analítica" };

export default async function AnalyticsHubPage() {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const enabled = await enabledDashboards(tenantId);
  const dashboards = await withTenantContext(tenantId, (tx) =>
    tx.cfgDashboard.findMany({ where: { isActive: true, code: { in: enabled } }, orderBy: { sortOrder: "asc" } })
  );
  const groups = DASHBOARD_CATEGORIES.map((c) => ({ ...c, items: dashboards.filter((d) => d.category === c.code) })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6 p-6">
      <PageHeader eyebrow="Analítica" title="Dashboards" description="Elegí el dashboard que querés ver. Los datos se actualizan al cargar archivos en Data." />
      {groups.length === 0 ? (
        <div role="status" className="flex flex-col items-center rounded-xl border border-dashed bg-card p-12 text-center">
          <LayoutDashboard className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold text-foreground">Todavía no hay dashboards habilitados</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">Pedile a tu administrador de WinLabs que habilite los dashboards de tu empresa.</p>
        </div>
      ) : (
        groups.map((g) => (
          <HubGroup key={g.code} title={g.name}>
            {g.items.map((d) => (
              <HubCard key={d.code} href={d.route} icon={dashboardIcon(d.icon)} title={d.name} description={d.description ?? ""} />
            ))}
          </HubGroup>
        ))
      )}
    </div>
  );
}
