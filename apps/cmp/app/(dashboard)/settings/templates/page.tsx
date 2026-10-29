import { prisma } from "@wla/db/client";
import { PageHeader } from "@wla/ui";
import { TemplatesTable } from "./_components/templates-table";
import { loadIntegrations } from "../../integrations/_data/load-integrations";
import { Breadcrumb } from "../../_components/breadcrumb";
import { Pager, SearchForm, listHref, paginate } from "../../_components/list-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Templates de integración" };

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const needle = q.toLowerCase();

  const [templates, tenants] = await Promise.all([
    prisma.intTemplate.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { code: true, name: true, category: true, targetModel: true, isActive: true },
    }),
    prisma.tenant.findMany({ select: { id: true, name: true, slug: true } }),
  ]);
  const integrations = await loadIntegrations(tenants);
  const inUse = new Map<string, number>();
  for (const i of integrations) inUse.set(i.templateCode, (inUse.get(i.templateCode) ?? 0) + 1);

  const filtered = templates
    .filter((t) => !needle || t.code.toLowerCase().includes(needle) || t.name.toLowerCase().includes(needle))
    .map((t) => ({ ...t, inUse: inUse.get(t.code) ?? 0 }));
  const { page, pages, skip, take } = paginate(filtered.length, Math.max(1, Number(sp.page) || 1));

  return (
    <div className="space-y-4 p-8">
      <Breadcrumb items={[{ label: "Configuración", href: "/settings" }, { label: "Templates de integración" }]} />
      <PageHeader
        title="Templates de integración"
        description="Catálogo global de templates disponibles para los tenants, agrupados por categoría. «En uso» cuenta las integraciones activas que lo usan."
      />
      <SearchForm action="/settings/templates" q={q} placeholder="Buscar por código o nombre" />

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          {q ? `Ningún template coincide con “${q}”.` : "No hay templates registrados."}
        </p>
      ) : (
        <div className="rounded-md border bg-card">
          <TemplatesTable templates={filtered.slice(skip, skip + take)} />
          <Pager
            page={page}
            pages={pages}
            total={filtered.length}
            noun={["template", "templates"]}
            hrefFor={(p) => listHref("/settings/templates", { q, page: p })}
          />
        </div>
      )}
    </div>
  );
}
