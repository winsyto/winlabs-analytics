import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { Breadcrumb } from "../../../_dashboard-kit/breadcrumb";
import { DashboardEmpty } from "../../../_dashboard-kit/dashboard-states";
import { getDashboardDimensions } from "../../../_dashboard-kit/dimensions";
import { fmtDec, fmtInt } from "../../../_dashboard-kit/format";
import { fmtHours } from "../../_components/format";
import { detailParamsSchema, effectiveSort, loadDetail, PAGE_SIZE, type SortKey } from "../../_data/detail-queries";
import { parseFilters } from "../../_data/filters";
import { filtersQuery, overviewHref, type DetailScope } from "../../_data/hrefs";

const SCOPES = ["horas", "personas", "tipo", "dim"] as const;

type SP = Record<string, string | string[] | undefined>;

export const metadata = { title: "Horas extras · Detalle" };

export default async function OvertimeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ scope: string; id?: string[] }>;
  searchParams: Promise<SP>;
}) {
  const { scope, id } = await params;
  if (!(SCOPES as readonly string[]).includes(scope)) notFound();
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const dimensions = await getDashboardDimensions(tenantId, "overtime");
  const filters = parseFilters(sp, dimensions);
  const dp = detailParamsSchema.parse({ page: first(sp.page), q: first(sp.q), s: first(sp.s), d: first(sp.d) });
  const segments = (id ?? []).map((seg) => decodeURIComponent(seg));
  if ((scope === "horas" || scope === "personas") && segments.length > 0) notFound();

  const data = await loadDetail(tenantId, filters, dimensions, scope as DetailScope, segments, dp);
  if (data.status === "notfound") notFound();

  const crumbs = (title: string) => [{ label: "Horas extras", href: overviewHref(filters) }, { label: title }];

  if (data.status === "empty") {
    return (
      <div className="flex h-full min-h-[640px] flex-col gap-3 p-4">
        <Breadcrumb items={crumbs("Detalle")} />
        <DashboardEmpty title="Todavía no hay horas por tipo cargadas" text="Cuando se cargue el archivo de Asistencia vas a poder ver el detalle acá." />
      </div>
    );
  }

  const { kind, total, totalHours, title, period } = data;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(dp.page, pages);
  const { s: sortKey, d: sortDir } = effectiveSort(dp);

  const base = filtersQuery(filters);
  const pathBase = `/overtime/${scope}${segments.map((seg) => `/${encodeURIComponent(seg)}`).join("")}`;
  const link = (over: Partial<{ page: number; s: SortKey; d: "asc" | "desc"; q: string }>) => {
    const q = new URLSearchParams(base);
    const term = over.q ?? dp.q;
    if (term) q.set("q", term);
    const s = over.s ?? sortKey;
    const d = over.d ?? sortDir;
    const defaults = effectiveSort({ page: 1, q: "" });
    if (s !== defaults.s || d !== defaults.d) {
      q.set("s", s);
      q.set("d", d);
    }
    if ((over.page ?? page) > 1) q.set("page", String(over.page ?? page));
    const str = q.toString();
    return str ? `${pathBase}?${str}` : pathBase;
  };
  const sortLink = (k: SortKey) =>
    link({ s: k, d: sortKey === k ? (sortDir === "asc" ? "desc" : "asc") : k === "hours" ? "desc" : "asc", page: 1 });

  const columns: { key: SortKey | null; label: string }[] = [
    { key: "name", label: "Nombre" },
    { key: "code", label: "Legajo" },
    ...dimensions.map((d) => ({ key: null, label: d.name })),
    ...(kind === "hours" ? [{ key: null, label: "Tipo de hora" }] : []),
    { key: "hours", label: "Horas extra" },
    ...(kind === "people" ? [{ key: null, label: "Por tipo de hora" }] : []),
  ];
  const noun = total === 1 ? "persona" : "personas";
  const nounRows = kind === "hours" ? (total === 1 ? "fila" : "filas") : noun;

  return (
    <div className="flex h-full min-h-[640px] flex-col gap-3 p-4">
      <div>
        <Breadcrumb items={crumbs(title)} />
        <h1 className="mt-1 text-lg font-bold leading-tight text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">
          {period.label} · {fmtInt(total)} {nounRows} · {fmtHours(totalHours)} de horas extra
          {dp.q && ` · búsqueda: “${dp.q}”`}
        </p>
      </div>

      <form method="get" action={pathBase} className="flex items-center gap-2" role="search">
        {[...base].map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input
          type="search"
          name="q"
          defaultValue={dp.q}
          placeholder="Buscar por nombre o legajo"
          aria-label="Buscar por nombre o legajo"
          className="w-64 rounded-md border bg-card px-2.5 py-1 text-xs"
        />
        <button type="submit" className="rounded-md bg-foreground px-3 py-1 text-xs font-medium text-background">
          Buscar
        </button>
        {dp.q && (
          <Link href={link({ page: 1, q: "" })} className="text-xs text-muted-foreground hover:text-foreground">
            Limpiar búsqueda
          </Link>
        )}
      </form>

      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-card p-8 text-sm text-muted-foreground">
          No hay personas con horas extra que coincidan con este detalle.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left text-xs" style={{ minWidth: `${620 + dimensions.length * 110}px` }}>
              <caption className="sr-only">{title}: listado</caption>
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  {columns.map((c) => {
                    const active = c.key === sortKey;
                    return (
                      <th
                        key={c.label}
                        scope="col"
                        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                        className={`px-3 py-2 font-semibold text-foreground ${c.key === "hours" ? "text-right" : ""}`}
                      >
                        {c.key ? (
                          <Link href={sortLink(c.key)} className="inline-flex items-center gap-1 hover:underline">
                            {c.label}
                            {active && <span aria-hidden>{sortDir === "asc" ? "▲" : "▼"}</span>}
                          </Link>
                        ) : (
                          c.label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.kind === "hours"
                  ? data.rows.map((r) => (
                      <tr key={`${r.id}-${r.typeCode}`} className="hover:bg-muted/40">
                        <th scope="row" className="whitespace-nowrap px-3 py-1.5 font-medium text-foreground">{r.name}</th>
                        <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{r.code}</td>
                        {dimensions.map((d) => (
                          <td key={d.code} className="px-3 py-1.5">{r.units[d.code] ?? "—"}</td>
                        ))}
                        <td className="px-3 py-1.5">{r.typeName}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmtHours(r.hours)}</td>
                      </tr>
                    ))
                  : data.rows.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/40">
                        <th scope="row" className="whitespace-nowrap px-3 py-1.5 font-medium text-foreground">{r.name}</th>
                        <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{r.code}</td>
                        {dimensions.map((d) => (
                          <td key={d.code} className="px-3 py-1.5">{r.units[d.code] ?? "—"}</td>
                        ))}
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmtHours(r.hours)}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {r.byType.map((t) => `${t.name} ${fmtDec(t.hours)} h`).join(" · ")}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Paginación" className="flex items-center justify-between border-t px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              Página {page} de {pages} · mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {fmtInt(total)}
            </span>
            <span className="flex items-center gap-2">
              {page > 1 ? (
                <Link href={link({ page: page - 1 })} className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-muted">
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Anterior
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded border px-2 py-1 text-muted-foreground opacity-50">
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Anterior
                </span>
              )}
              {page < pages ? (
                <Link href={link({ page: page + 1 })} className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-muted">
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
    </div>
  );
}
