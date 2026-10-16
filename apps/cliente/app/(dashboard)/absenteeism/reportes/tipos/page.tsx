import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import { auth } from "@/auth";
import { Breadcrumb } from "../../../_dashboard-kit/breadcrumb";
import { DashboardShell } from "../../../_dashboard-kit/dashboard-shell";
import { DashboardEmpty, DashboardNoResults } from "../../../_dashboard-kit/dashboard-states";
import { filterTokens, NONE_TOKEN } from "../../../_dashboard-kit/dimension-filters";
import { getDashboardDimensions } from "../../../_dashboard-kit/dimensions";
import { ExportMenu } from "../../../_dashboard-kit/export-menu";
import { hasActiveFilters } from "../../_data/filters";
import { AbsenteeismFiltersBar } from "../../_components/absenteeism-filters";
import { fmtPct } from "../../_components/format";
import { fmtDec } from "../../../_dashboard-kit/format";
import { TypeReportControls } from "../_components/type-report-controls";
import { cellValue, loadTypeReport, parseTypeReportParams, per100, typeReportQuery, type Cell } from "../_data/by-type";

export const metadata = { title: "Ausentismos · Cuadro por tipo y unidad" };

const MEASURE_LABEL = { events: "eventos", days: "días", hours: "horas" } as const;

export default async function TypeReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const dimensions = await getDashboardDimensions(tenantId, "absenteeism");
  const params = parseTypeReportParams(await searchParams, dimensions);
  const data = await loadTypeReport(tenantId, dimensions, params);
  const crumbs = [{ label: "Ausentismos", href: "/absenteeism" }, { label: "Cuadro por tipo y unidad" }];

  if (data.status === "empty") {
    return (
      <DashboardShell>
        <Breadcrumb items={crumbs} />
        <DashboardEmpty title="Todavía no hay datos de ausentismo" text="Cargá el archivo de Ausentismo para ver el cuadro por tipo y unidad." />
      </DashboardShell>
    );
  }

  const { rows, columns, totals, people, groupName } = data;
  const m = params.measure;
  const fmt = (n: number) =>
    m === "events" ? new Intl.NumberFormat("es-AR").format(n) : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n);
  const show = (c: Cell | undefined) => (c && cellValue(c, m) > 0 ? fmt(cellValue(c, m)) : "—");
  const pct = (n: number | null) => (n === null ? "—" : fmtPct(n));
  /** Índice: cantidad cada 100 personas (puede superar 100 en períodos largos) */
  const idx = (n: number | null) => (n === null ? "—" : fmtDec(n));
  const grand = cellValue(totals.all, m);
  const exportHref = (format: "xlsx" | "pdf") => {
    const q = typeReportQuery(params, dimensions);
    q.set("format", format);
    return `/absenteeism/reportes/tipos/export?${q.toString()}`;
  };
  const noResults = hasActiveFilters(params.filters) && people === 0;
  const th = "px-2 py-1.5 text-right font-semibold text-foreground";
  const stickyL = "sticky left-0 z-10 bg-card";

  return (
    <DashboardShell>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Breadcrumb items={crumbs} />
          <h1 className="mt-1 text-lg font-bold leading-tight text-foreground">Cuadro por tipo de ausencia y unidad</h1>
          <p className="text-xs text-muted-foreground">
            {data.periodLabel} · {groupName ? `columnas por ${groupName.toLowerCase()}` : "total"} · cantidades en {MEASURE_LABEL[m]}
          </p>
        </div>
        <ExportMenu xlsxHref={exportHref("xlsx")} pdfHref={exportHref("pdf")} />
      </div>

      <AbsenteeismFiltersBar
        period={params.filters.p}
        dimensions={data.dimensionOptions.map((d) => ({
          ...d,
          options: [{ value: NONE_TOKEN, label: "Sin asignar" }, ...d.options],
          selected: filterTokens(params.filters.dims[d.code]),
        }))}
        classOptions={data.classOptions}
        typeOptions={data.typeOptions}
        selectedClasses={params.filters.classes}
        selectedTypes={params.filters.types}
      />
      <TypeReportControls
        groupSlug={dimensions.find((d) => d.code === params.groupBy)?.slug ?? "total"}
        groups={dimensions.map((d) => ({ slug: d.slug, name: d.name }))}
        measure={m}
        showAll={params.showAll}
      />

      {data.unclassifiedTypes > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Hay tipos de ausencia sin clasificar: cuentan como ausentismo hasta que se clasifiquen.</span>
          <Link href="/settings/absence-types" className="ml-auto shrink-0 font-medium underline">
            Revisar
          </Link>
        </p>
      )}

      {noResults ? (
        <DashboardNoResults clearHref={`/absenteeism/reportes/tipos${params.filters.p === "month" ? "" : `?p=${params.filters.p}`}`} />
      ) : rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-card p-8 text-sm text-muted-foreground">
          No hay ausencias que cuenten como ausentismo en el período con los filtros aplicados.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-xs" style={{ minWidth: 520 + columns.length * 96 }}>
              <caption className="sr-only">Ausencias por tipo y {groupName ?? "total"}, {data.periodLabel}, en {MEASURE_LABEL[m]}</caption>
              <thead className="sticky top-0 z-20 bg-muted/90 backdrop-blur">
                <tr className="border-b">
                  <th scope="col" className={`${stickyL} bg-muted px-2 py-1.5 text-left font-semibold`}>Tipo de ausencia</th>
                  <th scope="col" className="px-2 py-1.5 text-left font-semibold">Clase</th>
                  {columns.map((c) => (
                    <th key={c.key} scope="col" className={th}>{c.label}</th>
                  ))}
                  {groupName && <th scope="col" className={`${th} border-l`}>Total</th>}
                  <th scope="col" className={`${th} border-l`}>Incidencia</th>
                  <th scope="col" className={th}>Índice (c/100 pers.)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.code} className="hover:bg-muted/40">
                    <th scope="row" className={`${stickyL} whitespace-nowrap px-2 py-1.5 text-left font-medium text-foreground`}>{r.name}</th>
                    <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{r.className}</td>
                    {columns.map((c) => (
                      <td key={c.key} className="px-2 py-1.5 text-right tabular-nums">{show(r.cells[c.key])}</td>
                    ))}
                    {groupName && <td className="border-l px-2 py-1.5 text-right font-semibold tabular-nums">{show(r.total)}</td>}
                    <td className="border-l px-2 py-1.5 text-right tabular-nums">{pct(per100(cellValue(r.total, m), grand))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{idx(per100(cellValue(r.total, m), people))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 border-t-2 bg-muted/90 font-semibold backdrop-blur">
                <tr>
                  <th scope="row" className={`${stickyL} bg-muted px-2 py-1.5 text-left`}>Total ausencias</th>
                  <td />
                  {columns.map((c) => (
                    <td key={c.key} className="px-2 py-1.5 text-right tabular-nums">{show(totals.byUnit[c.key])}</td>
                  ))}
                  {groupName && <td className="border-l px-2 py-1.5 text-right tabular-nums">{show(totals.all)}</td>}
                  <td className="border-l px-2 py-1.5 text-right tabular-nums">{grand > 0 ? "100,0 %" : "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{idx(per100(grand, people))}</td>
                </tr>
                <tr className="font-normal">
                  <th scope="row" className={`${stickyL} bg-muted px-2 py-1.5 text-left`}>Dotación (personas)</th>
                  <td />
                  {columns.map((c) => (
                    <td key={c.key} className="px-2 py-1.5 text-right tabular-nums">{fmtInt(c.people)}</td>
                  ))}
                  {groupName && <td className="border-l px-2 py-1.5 text-right tabular-nums">{fmtInt(people)}</td>}
                  <td className="border-l" />
                  <td />
                </tr>
                {groupName && (
                  <>
                    <tr className="font-normal">
                      <th scope="row" className={`${stickyL} bg-muted px-2 py-1.5 text-left`}>Índice del grupo</th>
                      <td />
                      {columns.map((c) => (
                        <td key={c.key} className="px-2 py-1.5 text-right tabular-nums">
                          {idx(per100(cellValue(totals.byUnit[c.key] ?? { events: 0, days: 0, hours: 0 }, m), c.people))}
                        </td>
                      ))}
                      <td className="border-l" />
                      <td className="border-l" />
                      <td />
                    </tr>
                    <tr className="font-normal">
                      <th scope="row" className={`${stickyL} bg-muted px-2 py-1.5 text-left`}>Índice sobre la empresa</th>
                      <td />
                      {columns.map((c) => (
                        <td key={c.key} className="px-2 py-1.5 text-right tabular-nums">
                          {idx(per100(cellValue(totals.byUnit[c.key] ?? { events: 0, days: 0, hours: 0 }, m), people))}
                        </td>
                      ))}
                      <td className="border-l" />
                      <td className="border-l" />
                      <td />
                    </tr>
                  </>
                )}
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Solo tipos que cuentan como ausentismo. <strong>Índice</strong> = {MEASURE_LABEL[m]} cada 100 personas (sin signo %, puede superar 100 en períodos largos); <strong>Índice del grupo</strong> usa las personas
          de la unidad y <strong>sobre la empresa</strong> las de toda la empresa. <strong>Incidencia</strong> = peso del tipo sobre el total de ausencias. Una
          persona que cambió de unidad en el período figura en ambas, y un evento que cruza unidades se cuenta en cada una (el total no repite eventos).
        </span>
      </p>
    </DashboardShell>
  );
}

function fmtInt(n: number) {
  return new Intl.NumberFormat("es-AR").format(n);
}
