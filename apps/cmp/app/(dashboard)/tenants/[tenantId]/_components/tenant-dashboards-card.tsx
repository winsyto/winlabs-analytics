import Link from "next/link";
import { DASHBOARD_CATALOG, DASHBOARD_CODES, DATA_MODULES, missingModules } from "@wla/db";
import { DashboardToggle } from "../../../dashboards/_components/dashboard-toggle";

const moduleName = (code: string) => DATA_MODULES.find((m) => m.code === code)?.name ?? code;

/** Dashboards que ve el tenant. La misma matriz está en la página "Dashboards" del menú. */
export function TenantDashboardsCard({
  tenantId,
  tenantName,
  activeModules,
  enabled,
}: {
  tenantId: string;
  tenantName: string;
  activeModules: string[];
  enabled: string[];
}) {
  const codes = [...DASHBOARD_CODES].sort((a, b) => DASHBOARD_CATALOG[a].sortOrder - DASHBOARD_CATALOG[b].sortOrder);
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dashboards</h3>
        <Link href="/dashboards" className="text-xs text-primary hover:underline">
          Ver todos los tenants →
        </Link>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Los dashboards activos son los que aparecen en el menú de la empresa.</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {codes.map((c) => {
          const on = enabled.includes(c);
          const missing = missingModules(c, activeModules).map(moduleName);
          return (
            <div key={c} className={`flex items-center justify-between gap-3 rounded-md px-3 py-2.5 ${on ? "bg-green-50 dark:bg-green-950/30" : "bg-muted/40"}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{DASHBOARD_CATALOG[c].name}</p>
                <p className="truncate text-xs text-muted-foreground">Requiere {DASHBOARD_CATALOG[c].requiredModules.map(moduleName).join(" + ")}</p>
              </div>
              <DashboardToggle tenantId={tenantId} code={c} name={`${tenantName} · ${DASHBOARD_CATALOG[c].name}`} enabled={on} missing={missing} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
