import { prisma } from "@wla/db/client";
import { PageHeader } from "@wla/ui";
import { IntegrationsTable } from "../_components/integrations-table";
import { NewIntegrationDialog } from "../_components/new-integration-dialog";
import { loadActiveTemplates, loadIntegrations } from "../_data/load-integrations";
import { Breadcrumb } from "../../_components/breadcrumb";
import { Pager, SearchForm, listHref, paginate } from "../../_components/list-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integraciones activas" };

const STATUSES = [
  ["active", "Activas"],
  ["paused", "Pausadas"],
  ["error", "Con error"],
] as const;

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; tenant?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const tenantFilter = sp.tenant ?? "";
  const statusFilter = STATUSES.some(([s]) => s === sp.status) ? (sp.status as string) : "";

  const [tenants, templates] = await Promise.all([
    prisma.tenant.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
    loadActiveTemplates(),
  ]);

  const scope = tenantFilter ? tenants.filter((t) => t.id === tenantFilter) : tenants;
  const all = await loadIntegrations(scope);
  const needle = q.toLowerCase();
  const filtered = all.filter(
    (i) =>
      (!statusFilter || i.status === statusFilter) &&
      (!needle || i.name.toLowerCase().includes(needle) || i.tenantName.toLowerCase().includes(needle) || i.templateName.toLowerCase().includes(needle))
  );
  const { page, pages, skip, take } = paginate(filtered.length, Math.max(1, Number(sp.page) || 1));
  const rows = filtered.slice(skip, skip + take);
  const hrefFor = (p: number) => listHref("/integrations/active", { q, tenant: tenantFilter, status: statusFilter, page: p });
  const selectCls = "rounded-md border bg-card px-2 py-1.5 text-sm";

  return (
    <div className="space-y-4 p-8">
      <Breadcrumb items={[{ label: "Integraciones", href: "/integrations" }, { label: "Integraciones activas" }]} />
      <PageHeader title="Integraciones" description="Integraciones activas por tenant" actions={<NewIntegrationDialog tenants={tenants} templates={templates} />} />

      <SearchForm action="/integrations/active" q={q} placeholder="Buscar por integración, tenant o template">
        <select name="tenant" defaultValue={tenantFilter} aria-label="Tenant" className={selectCls}>
          <option value="">Todos los tenants</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select name="status" defaultValue={statusFilter} aria-label="Estado" className={selectCls}>
          <option value="">Todos los estados</option>
          {STATUSES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </SearchForm>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          {q || tenantFilter || statusFilter ? "Ninguna integración coincide con los filtros." : "Todavía no hay integraciones configuradas."}
        </p>
      ) : (
        <div className="rounded-md border bg-card">
          <IntegrationsTable integrations={rows} />
          <Pager page={page} pages={pages} total={filtered.length} noun={["integración", "integraciones"]} hrefFor={hrefFor} />
        </div>
      )}
    </div>
  );
}
