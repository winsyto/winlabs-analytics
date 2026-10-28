import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { withTenantContext } from "@wla/auth";
import { DASHBOARD_CATALOG, DASHBOARD_CODES, DATA_MODULES, missingModules, type DashboardCode } from "@wla/db";
import { prisma } from "@wla/db/client";
import { PageHeader } from "@wla/ui";
import { DashboardToggle } from "./_components/dashboard-toggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboards por tenant" };

/** Estándar de grillas: filas por página que entran de un vistazo en una pantalla de 15,6" sin scroll. */
const PAGE_SIZE = 12;

const moduleName = (code: string) => DATA_MODULES.find((m) => m.code === code)?.name ?? code;

export default async function DashboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const where = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { slug: { contains: q, mode: "insensitive" as const } }] }
    : {};
  const total = await prisma.tenant.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), pages);
  const tenants = await prisma.tenant.findMany({
    where,
    orderBy: { name: "asc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { id: true, slug: true, name: true, isActive: true, activeModules: true },
  });

  // La tabla tiene RLS: se lee dentro del contexto de cada tenant
  const enabledByTenant = new Map(
    await Promise.all(
      tenants.map(async (t) => {
        const rows = await withTenantContext(t.id, (tx) => tx.dshTenantDashboard.findMany({ where: { tenantId: t.id, isEnabled: true }, select: { dashboardCode: true } }));
        return [t.id, new Set(rows.map((r) => r.dashboardCode))] as const;
      })
    )
  );

  const codes = [...DASHBOARD_CODES].sort((a, b) => DASHBOARD_CATALOG[a].sortOrder - DASHBOARD_CATALOG[b].sortOrder);
  const link = (p: number) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `/dashboards?${s}` : "/dashboards";
  };

  return (
    <div className="flex min-h-0 flex-col gap-4 p-8">
      <PageHeader
        title="Dashboards por tenant"
        description="Qué dashboards ve cada empresa. Para activar uno, el tenant tiene que tener activos los módulos de datos que requiere."
      />

      <form method="get" action="/dashboards" role="search" className="flex items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar tenant por nombre o slug"
          aria-label="Buscar tenant por nombre o slug"
          className="w-72 rounded-md border bg-card px-2.5 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background">
          Buscar
        </button>
        {q && (
          <Link href="/dashboards" className="text-sm text-muted-foreground hover:text-foreground">
            Limpiar
          </Link>
        )}
      </form>

      {tenants.length === 0 ? (
        <p className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          {q ? `Ningún tenant coincide con “${q}”.` : "Todavía no hay tenants."}
        </p>
      ) : (
        <div className="rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Dashboards activos por tenant</caption>
              <thead>
                <tr className="border-b bg-muted/50">
                  <th scope="col" className="h-10 px-4 text-left font-medium text-muted-foreground">Tenant</th>
                  {codes.map((c) => (
                    <th key={c} scope="col" className="h-10 px-3 text-center font-medium text-muted-foreground">
                      {DASHBOARD_CATALOG[c].name}
                      <span className="block text-[10px] font-normal">
                        requiere {DASHBOARD_CATALOG[c].requiredModules.map(moduleName).join(" + ")}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {tenants.map((t) => (
                  <tr key={t.id} className={t.isActive ? "" : "opacity-60"}>
                    <th scope="row" className="px-4 py-2 text-left font-medium text-foreground">
                      <Link href={`/tenants/${t.id}`} className="hover:underline">
                        {t.name}
                      </Link>
                      <span className="block font-mono text-xs font-normal text-muted-foreground">
                        {t.slug}
                        {!t.isActive && " · inactivo"}
                      </span>
                    </th>
                    {codes.map((c: DashboardCode) => (
                      <td key={c} className="px-3 py-2 align-top">
                        <div className="flex justify-center">
                          <DashboardToggle
                            tenantId={t.id}
                            code={c}
                            name={`${t.name} · ${DASHBOARD_CATALOG[c].name}`}
                            enabled={enabledByTenant.get(t.id)?.has(c) ?? false}
                            missing={missingModules(c, t.activeModules).map(moduleName)}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Paginación" className="flex items-center justify-between border-t px-4 py-2 text-xs">
            <span className="text-muted-foreground">
              Página {page} de {pages} · {total} {total === 1 ? "tenant" : "tenants"}
              {q && ` · búsqueda: “${q}”`}
            </span>
            <span className="flex items-center gap-2">
              {page > 1 ? (
                <Link href={link(page - 1)} className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-muted">
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Anterior
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded border px-2 py-1 text-muted-foreground opacity-50">
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Anterior
                </span>
              )}
              {page < pages ? (
                <Link href={link(page + 1)} className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-muted">
                  Siguiente <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded border px-2 py-1 text-muted-foreground opacity-50">
                  Siguiente <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              )}
            </span>
          </nav>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Los módulos de datos (Personas, Asistencia, Liquidaciones) se activan en «Modelos de datos». Si se desactiva un módulo, se apagan los dashboards que lo requieren.
      </p>
    </div>
  );
}
