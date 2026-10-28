import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { Breadcrumb } from "../../../_dashboard-kit/breadcrumb";
import { DashboardEmpty } from "../../../_dashboard-kit/dashboard-states";
import { getDashboardDimensions } from "../../../_dashboard-kit/dimensions";
import { fmtDate, fmtInt, fmtDec } from "../../../_dashboard-kit/format";
import { getCurrentUserRole } from "../../../settings/_lib/role";
import { fmtMoney, fmtShare } from "../../_components/format";
import { conceptsHref } from "../../_data/hrefs";
import { detailParamsSchema, loadDetail, PAGE_SIZE, PROCESS_TYPE_LABELS } from "../../_data/detail-queries";
import { parseFilters } from "../../_data/filters";
import { detailHref, filtersQuery, overviewHref, type DetailScope } from "../../_data/hrefs";
import { MIN_PERSONS, type ClassItem } from "../../_data/types";

const SCOPES = ["procesos", "clase", "dim", "personas"] as const;
const PRIVATE = `reservado (menos de ${MIN_PERSONS} personas)`;

type SP = Record<string, string | string[] | undefined>;

export const metadata = { title: "Payroll · Detalle" };

const TH = "px-3 py-2 font-semibold text-foreground";

export default async function PayrollDetailPage({
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
  const segments = (id ?? []).map((seg) => decodeURIComponent(seg));
  if ((scope === "procesos" || scope === "personas") && segments.length > 0) notFound();
  // El listado de personas muestra el importe de cada una: solo lo ve un admin
  if (scope === "personas") {
    const role = await getCurrentUserRole(tenantId, session!.user.id);
    if (role !== "admin") notFound();
  }

  const dimensions = await getDashboardDimensions(tenantId, "payroll");
  const filters = parseFilters(sp, dimensions);
  const dp = detailParamsSchema.parse({ page: first(sp.page), q: first(sp.q) });
  const data = await loadDetail(tenantId, filters, dimensions, scope as DetailScope, segments, dp);
  if (data.status === "notfound") notFound();

  const crumbs = (title: string) => [{ label: "Analítica", href: "/analytics" }, { label: "Payroll", href: overviewHref(filters) }, { label: title }];

  if (data.status === "empty") {
    return (
      <div className="flex h-full min-h-[640px] flex-col gap-3 p-4">
        <Breadcrumb items={crumbs("Detalle")} />
        <DashboardEmpty title="Todavía no hay liquidaciones" text="Cuando se cargue el archivo de Liquidaciones vas a ver el detalle acá." />
      </div>
    );
  }

  const { period, title, currency } = data;
  const money = (n: number | null) => (n === null ? PRIVATE : fmtMoney(n, currency));
  const header = (subtitle: string) => (
    <div>
      <Breadcrumb items={crumbs(title)} />
      <h1 className="mt-1 text-lg font-bold leading-tight text-foreground">{title}</h1>
      <p className="text-xs text-muted-foreground">
        {period.label} · {subtitle}
      </p>
    </div>
  );
  const empty = (text: string) => (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-card p-8 text-sm text-muted-foreground">{text}</div>
  );
  const shell = (children: React.ReactNode) => <div className="flex h-full min-h-[640px] flex-col gap-3 p-4">{children}</div>;

  if (data.kind === "procesos") {
    return shell(
      <>
        {header(`${fmtInt(data.rows.length)} ${data.rows.length === 1 ? "proceso" : "procesos"}`)}
        {data.rows.length === 0 ? (
          empty("No hay procesos con estos filtros.")
        ) : (
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
            <table className="w-full min-w-[820px] text-left text-xs">
              <caption className="sr-only">Procesos de liquidación del período</caption>
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  {["Mes", "Proceso", "Tipo", "Desde", "Hasta", "Personas", "Masa bruta", "Neto"].map((c, i) => (
                    <th key={c} scope="col" className={`${TH} ${i >= 5 ? "text-right" : ""}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-3 py-1.5 tabular-nums">{r.month.slice(0, 7)}</td>
                    <th scope="row" className="px-3 py-1.5 font-medium text-foreground">
                      {r.code}
                      {r.description && <span className="block text-[11px] font-normal text-muted-foreground">{r.description}</span>}
                    </th>
                    <td className="px-3 py-1.5">{PROCESS_TYPE_LABELS[r.type] ?? r.type}</td>
                    <td className="px-3 py-1.5 tabular-nums">{fmtDate(r.from)}</td>
                    <td className="px-3 py-1.5 tabular-nums">{fmtDate(r.to)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(r.persons)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.gross === null ? "—" : money(r.gross)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.net === null ? "—" : money(r.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  if (data.kind === "clase") {
    return shell(
      <>
        {header(`${fmtInt(data.rows.length)} ${data.rows.length === 1 ? "concepto" : "conceptos"}${data.total === null ? "" : ` · ${money(data.total)}`}`)}
        {data.rows.length === 0 ? (
          empty("No hay importes de esta clase con estos filtros.")
        ) : (
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
            <table className="w-full min-w-[640px] text-left text-xs">
              <caption className="sr-only">{title}: conceptos</caption>
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  {["Código", "Concepto", "Personas", "Importe", "% de la clase"].map((c, i) => (
                    <th key={c} scope="col" className={`${TH} ${i >= 2 ? "text-right" : ""}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.code}</td>
                    <th scope="row" className="px-3 py-1.5 font-medium text-foreground">
                      <Link href={conceptsHref(filters, r.id)} className="hover:underline">
                        {r.name}
                      </Link>
                    </th>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(r.persons)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{money(r.amount)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.share === null ? "—" : fmtShare(r.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  if (data.kind === "dim") {
    if (data.restricted) {
      return shell(
        <>
          {header("importes reservados")}
          {empty(`Esta unidad tiene menos de ${MIN_PERSONS} personas pagadas por mes: los importes se reservan por privacidad.`)}
        </>
      );
    }
    const { composition } = data;
    const rows: ClassItem[] = [...composition.earnings, ...(composition.unclassified ? [composition.unclassified] : []), ...composition.deductions];
    return shell(
      <>
        {header(`${money(data.gross)} de masa bruta · costo medio ${data.costPerPerson === null ? "—" : money(data.costPerPerson)} · ${data.avgPersons === null ? "—" : fmtDec(data.avgPersons)} personas por mes`)}
        {rows.length === 0 ? (
          empty("No hay importes clasificados para esta unidad.")
        ) : (
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
            <table className="w-full min-w-[560px] text-left text-xs">
              <caption className="sr-only">{title}: composición por clase</caption>
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  {["Clase", "Lado", "Importe", "% de los haberes"].map((c, i) => (
                    <th key={c} scope="col" className={`${TH} ${i >= 2 ? "text-right" : ""}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.key} className="hover:bg-muted/40">
                    <th scope="row" className="px-3 py-1.5 font-medium text-foreground">
                      <Link href={detailHref(filters, "clase", r.key)} className="hover:underline">
                        {r.label}
                      </Link>
                    </th>
                    <td className="px-3 py-1.5">{r.side === "earning" ? "Haber" : r.side === "deduction" ? "Retención" : "Sin clasificar"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{money(Math.abs(r.amount))}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtShare(r.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  // personas
  const { rows, total } = data;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(dp.page, pages);
  const base = filtersQuery(filters);
  const pathBase = "/payroll/personas";
  const link = (over: { page?: number; q?: string }) => {
    const q = new URLSearchParams(base);
    const term = over.q ?? dp.q;
    if (term) q.set("q", term);
    if ((over.page ?? page) > 1) q.set("page", String(over.page ?? page));
    const str = q.toString();
    return str ? `${pathBase}?${str}` : pathBase;
  };
  const dimCols = dimensions.map((d) => d.name);

  return shell(
    <>
      {header(`${fmtInt(total)} ${total === 1 ? "persona" : "personas"}${dp.q ? ` · búsqueda: “${dp.q}”` : ""} · visible solo para administradores`)}
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
        empty("No hay personas que coincidan con este detalle.")
      ) : (
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left text-xs" style={{ minWidth: `${520 + dimCols.length * 120}px` }}>
              <caption className="sr-only">{title}: listado</caption>
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  {["Nombre", "Legajo", ...dimCols, "Masa bruta", ...(data.hasNet ? ["Neto"] : [])].map((c, i, all) => (
                    <th key={c} scope="col" className={`${TH} ${i >= all.length - (data.hasNet ? 2 : 1) ? "text-right" : ""}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <th scope="row" className="whitespace-nowrap px-3 py-1.5 font-medium text-foreground">{r.name}</th>
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{r.code}</td>
                    {dimensions.map((d) => (
                      <td key={d.code} className="px-3 py-1.5">{r.units[d.code] ?? "—"}</td>
                    ))}
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(r.gross, currency)}</td>
                    {data.hasNet && <td className="px-3 py-1.5 text-right tabular-nums">{r.net === null ? "—" : fmtMoney(r.net, currency)}</td>}
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
    </>
  );
}
