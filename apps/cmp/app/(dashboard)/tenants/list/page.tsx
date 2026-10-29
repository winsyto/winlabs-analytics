import { prisma } from "@wla/db/client";
import { PageHeader } from "@wla/ui";
import { TenantsTable } from "../_components/tenants-table";
import { CreateTenantDialog } from "../_components/create-tenant-dialog";
import { Breadcrumb } from "../../_components/breadcrumb";
import { Pager, SearchForm, listHref, listParams, paginate } from "../../_components/list-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tenants" };

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page: requested } = listParams(await searchParams);
  const where = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { slug: { contains: q, mode: "insensitive" as const } }] }
    : {};
  const total = await prisma.tenant.count({ where });
  const { page, pages, skip, take } = paginate(total, requested);
  const tenants = await prisma.tenant.findMany({ where, orderBy: { createdAt: "desc" }, skip, take });

  return (
    <div className="space-y-4 p-8">
      <Breadcrumb items={[{ label: "Tenants", href: "/tenants" }, { label: "Tenants" }]} />
      <PageHeader
        title="Tenants"
        description={`${total} tenant${total !== 1 ? "s" : ""} registrado${total !== 1 ? "s" : ""}${q ? ` · búsqueda: “${q}”` : ""}`}
        actions={<CreateTenantDialog />}
      />
      <SearchForm action="/tenants/list" q={q} placeholder="Buscar tenant por nombre o slug" />

      {tenants.length === 0 && q ? (
        <p className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Ningún tenant coincide con “{q}”.</p>
      ) : (
        <div className="rounded-md border bg-card">
          <TenantsTable tenants={tenants} />
          {total > 0 && (
            <Pager
              page={page}
              pages={pages}
              total={total}
              noun={["tenant", "tenants"]}
              hrefFor={(p) => listHref("/tenants/list", { q, page: p })}
            />
          )}
        </div>
      )}
    </div>
  );
}
