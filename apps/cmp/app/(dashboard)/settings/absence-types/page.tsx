import { prisma } from "@wla/db/client";
import { ABSENTEEISM_CLASSES } from "@wla/db";
import { PageHeader } from "@wla/ui";
import { AbsenceTypesTable, NewAbsenceTypeDialog } from "./_components/absence-types-table";
import { Breadcrumb } from "../../_components/breadcrumb";
import { Pager, SearchForm, listHref, paginate } from "../../_components/list-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tipos de ausencia" };

export default async function AbsenceTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; class?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const classes = ABSENTEEISM_CLASSES.map((c) => ({ code: c.code, name: c.name }));
  const classFilter = classes.some((c) => c.code === sp.class) ? (sp.class as string) : "";
  const where = {
    ...(classFilter ? { class: classFilter } : {}),
    ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }] } : {}),
  };

  const total = await prisma.cfgAbsenteeismTypeDefault.count({ where });
  const { page, pages, skip, take } = paginate(total, Math.max(1, Number(sp.page) || 1));
  const rows = await prisma.cfgAbsenteeismTypeDefault.findMany({ where, orderBy: [{ sortOrder: "asc" }, { code: "asc" }], skip, take });

  return (
    <div className="space-y-4 p-8">
      <Breadcrumb items={[{ label: "Configuración", href: "/settings" }, { label: "Tipos de ausencia" }]} />
      <PageHeader
        title="Tipos de ausencia por defecto"
        description="Catálogo global que reciben los tenants nuevos; cada tenant ajusta después los suyos desde el portal. Los cambios no modifican a los tenants existentes."
        actions={<NewAbsenceTypeDialog classes={classes} />}
      />

      <SearchForm action="/settings/absence-types" q={q} placeholder="Buscar por código o nombre">
        <select name="class" defaultValue={classFilter} aria-label="Clase" className="rounded-md border bg-card px-2 py-1.5 text-sm">
          <option value="">Todas las clases</option>
          {classes.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </SearchForm>

      {total === 0 ? (
        <p className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          {q || classFilter ? "Ningún tipo coincide con los filtros." : "Todavía no hay tipos de ausencia."}
        </p>
      ) : (
        <div className="rounded-md border bg-card">
          <AbsenceTypesTable
            classes={classes}
            rows={rows.map((r) => ({ id: r.id, code: r.code, name: r.name, class: r.class, countsAsAbsence: r.countsAsAbsence, isActive: r.isActive }))}
          />
          <Pager
            page={page}
            pages={pages}
            total={total}
            noun={["tipo", "tipos"]}
            hrefFor={(p) => listHref("/settings/absence-types", { q, class: classFilter, page: p })}
          />
        </div>
      )}
    </div>
  );
}
