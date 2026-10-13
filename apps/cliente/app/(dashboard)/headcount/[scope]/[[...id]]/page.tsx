import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { Breadcrumb } from "../../../_dashboard-kit/breadcrumb";
import { DashboardEmpty } from "../../../_dashboard-kit/dashboard-states";
import { fmtDate, fmtInt, fmtTenure } from "../../../_dashboard-kit/format";
import { detailParamsSchema, loadDetail, PAGE_SIZE, type SortKey } from "../../_data/detail-queries";
import { parseFilters } from "../../_data/filters";
import { filtersQuery, overviewHref, type DetailScope } from "../../_data/hrefs";

const SCOPES = ["activos", "altas", "bajas", "area", "sede", "contrato"] as const;
const CONTRACTS: Record<string, string> = {
  indefinido: "Indefinido",
  plazo_fijo: "Plazo fijo",
  temporal: "Temporal",
  contractor: "Contratista",
};

type SP = Record<string, string | string[] | undefined>;

export const metadata = { title: "Headcount · Detalle" };

export default async function HeadcountDetailPage({
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
  const filters = parseFilters(sp);
  const dp = detailParamsSchema.parse({ page: first(sp.page), q: first(sp.q), s: first(sp.s), d: first(sp.d) });
  const key = id?.[0] ? decodeURIComponent(id[0]) : undefined;

  const session = await auth();
  const data = await loadDetail(session!.user.tenantId, filters, scope as DetailScope, key, dp);
  if (data.status === "notfound") notFound();

  const crumbs = (title: string) => [
    { label: "Headcount", href: overviewHref(filters) },
    { label: title },
  ];

  if (data.status === "empty") {
    return (
      <div className="flex h-full min-h-[640px] flex-col gap-3 p-4">
        <Breadcrumb items={crumbs("Detalle")} />
        <DashboardEmpty title="Todavía no hay datos de personas" text="Cuando haya un cierre mensual vas a poder ver el detalle acá." />
      </div>
    );
  }

  const { rows, total, title, demographics, showTermination, period } = data;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(dp.page, pages);

  const base = filtersQuery(filters);
  const pathBase = `/headcount/${scope}${key ? `/${encodeURIComponent(key)}` : ""}`;
  const link = (over: Partial<{ page: number; s: SortKey; d: "asc" | "desc"; q: string }>) => {
    const q = new URLSearchParams(base);
    const term = over.q ?? dp.q;
    if (term) q.set("q", term);
    const s = over.s ?? dp.s;
    const d = over.d ?? dp.d;
    if (s !== "name" || d !== "asc") {
      q.set("s", s);
      q.set("d", d);
    }
    if ((over.page ?? page) > 1) q.set("page", String(over.page ?? page));
    const str = q.toString();
    return str ? `${pathBase}?${str}` : pathBase;
  };
  const sortLink = (k: SortKey) => link({ s: k, d: dp.s === k && dp.d === "asc" ? "desc" : "asc", page: 1 });

  const columns: { key: SortKey | null; label: string; align?: "right" }[] = [
    { key: "name", label: "Nombre" },
    { key: "code", label: "Legajo" },
    { key: null, label: "Área" },
    { key: null, label: "Sede" },
    { key: null, label: "Cargo" },
    { key: null, label: "Contrato" },
    { key: "hire", label: "Ingreso" },
    ...(showTermination ? [{ key: "term" as const, label: "Baja" }, { key: null, label: "Motivo" }] : []),
    { key: "tenure", label: "Antigüedad" },
  ];

  const genderTotal = demographics.gender.reduce((s, g) => s + g.value, 0);
  const pct = (n: number, t: number) => (t ? `${Math.round((n / t) * 100)}%` : "0%");

  return (
    <div className="flex h-full min-h-[640px] flex-col gap-3 p-4">
      <div>
        <Breadcrumb items={crumbs(title)} />
        <h1 className="mt-1 text-lg font-bold leading-tight text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">
          {period.label} · {fmtInt(total)} {total === 1 ? "persona" : "personas"}
          {dp.q && ` · búsqueda: “${dp.q}”`}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
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

        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">Género:</dt>
            <dd>
              {demographics.gender.map((g) => `${g.label} ${fmtInt(g.value)} (${pct(g.value, genderTotal)})`).join(" · ") || "—"}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">Edad:</dt>
            <dd>
              {demographics.ageBands.map((b) => `${b.label}: ${fmtInt(b.value)}`).join(" · ")}
              {demographics.unknownAge > 0 && ` · sin dato: ${fmtInt(demographics.unknownAge)}`}
            </dd>
          </div>
        </dl>
      </div>

      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-card p-8 text-sm text-muted-foreground">
          No hay personas que coincidan con este detalle.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <caption className="sr-only">{title}: listado de personas</caption>
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  {columns.map((c) => {
                    const active = c.key === dp.s;
                    return (
                      <th
                        key={c.label}
                        scope="col"
                        aria-sort={active ? (dp.d === "asc" ? "ascending" : "descending") : undefined}
                        className="px-3 py-2 font-semibold text-foreground"
                      >
                        {c.key ? (
                          <Link href={sortLink(c.key)} className="inline-flex items-center gap-1 hover:underline">
                            {c.label}
                            {active && <span aria-hidden>{dp.d === "asc" ? "▲" : "▼"}</span>}
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
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <th scope="row" className="whitespace-nowrap px-3 py-1.5 font-medium text-foreground">{r.name}</th>
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{r.code}</td>
                    <td className="px-3 py-1.5">{r.area ?? "—"}</td>
                    <td className="px-3 py-1.5">{r.location ?? "—"}</td>
                    <td className="px-3 py-1.5">{r.position ?? "—"}</td>
                    <td className="px-3 py-1.5">{r.contract ? (CONTRACTS[r.contract] ?? r.contract) : "—"}</td>
                    <td className="px-3 py-1.5 tabular-nums">{fmtDate(r.hireDate)}</td>
                    {showTermination && (
                      <>
                        <td className="px-3 py-1.5 tabular-nums">{fmtDate(r.terminationDate)}</td>
                        <td className="px-3 py-1.5">{r.reason ?? "—"}</td>
                      </>
                    )}
                    <td className="px-3 py-1.5 tabular-nums">{fmtTenure(r.tenureMonths)}</td>
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
