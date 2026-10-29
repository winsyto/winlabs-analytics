import { prisma } from "@wla/db/client";
import { TIME_ENTRY_CATEGORIES } from "@wla/db";
import { PageHeader } from "@wla/ui";
import { NewTimeEntryTypeDialog, TimeEntryTypesTable } from "./_components/time-entry-types-table";
import { Breadcrumb } from "../../_components/breadcrumb";
import { Pager, SearchForm, listHref, paginate } from "../../_components/list-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tipos de hora" };

export default async function TimeEntryTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const categories = TIME_ENTRY_CATEGORIES.map((c) => ({ code: c.code, name: c.name }));
  const categoryFilter = categories.some((c) => c.code === sp.category) ? (sp.category as string) : "";
  const where = {
    ...(categoryFilter ? { category: categoryFilter } : {}),
    ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }] } : {}),
  };

  const total = await prisma.cfgTimeEntryType.count({ where });
  const { page, pages, skip, take } = paginate(total, Math.max(1, Number(sp.page) || 1));
  const rows = await prisma.cfgTimeEntryType.findMany({ where, orderBy: [{ sortOrder: "asc" }, { code: "asc" }], skip, take });

  return (
    <div className="space-y-4 p-8">
      <Breadcrumb items={[{ label: "Configuración", href: "/settings" }, { label: "Tipos de hora" }]} />
      <PageHeader
        title="Tipos de hora por defecto"
        description="Catálogo global que reciben los tenants nuevos; cada tenant ajusta después la categoría de los suyos desde el portal. Los cambios no modifican a los tenants existentes."
        actions={<NewTimeEntryTypeDialog categories={categories} />}
      />

      <SearchForm action="/settings/time-entry-types" q={q} placeholder="Buscar por código o nombre">
        <select name="category" defaultValue={categoryFilter} aria-label="Categoría" className="rounded-md border bg-card px-2 py-1.5 text-sm">
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </SearchForm>

      {total === 0 ? (
        <p className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          {q || categoryFilter ? "Ningún tipo coincide con los filtros." : "Todavía no hay tipos de hora."}
        </p>
      ) : (
        <div className="rounded-md border bg-card">
          <TimeEntryTypesTable
            categories={categories}
            rows={rows.map((r) => ({ code: r.code, name: r.name, category: r.category, isActive: r.isActive }))}
          />
          <Pager
            page={page}
            pages={pages}
            total={total}
            noun={["tipo", "tipos"]}
            hrefFor={(p) => listHref("/settings/time-entry-types", { q, category: categoryFilter, page: p })}
          />
        </div>
      )}
    </div>
  );
}
