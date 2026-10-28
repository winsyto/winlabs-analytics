import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Breadcrumb } from "../../_dashboard-kit/breadcrumb";
import { ChartCard } from "../../_dashboard-kit/chart-card";
import { DashboardShell, PendingRegion } from "../../_dashboard-kit/dashboard-shell";
import { DashboardEmpty, DashboardNoResults } from "../../_dashboard-kit/dashboard-states";
import { filterTokens, NONE_TOKEN } from "../../_dashboard-kit/dimension-filters";
import { getDashboardDimensions } from "../../_dashboard-kit/dimensions";
import { ExportMenu } from "../../_dashboard-kit/export-menu";
import { fmtDec, fmtInt, monthLabel } from "../../_dashboard-kit/format";
import { MetricCard } from "../../_dashboard-kit/metric-card";
import { getCurrentUserRole } from "../../settings/_lib/role";
import { ConceptEvolutionChart } from "../_components/concept-evolution-chart";
import { ConceptSelect } from "../_components/concept-select";
import { CostBarsChart, TabbedCostDimensions } from "../_components/cost-bars-chart";
import { fmtMoney, fmtMoneyDiff, fmtShare } from "../_components/format";
import { PayrollFiltersBar } from "../_components/payroll-filters";
import { PROCESS_TYPE_LABELS } from "../_data/detail-queries";
import { loadConceptDetail } from "../_data/concept-queries";
import { hasActiveFilters, parseFilters } from "../_data/filters";
import { conceptsHref, filtersQuery, overviewHref } from "../_data/hrefs";
import { MIN_PERSONS } from "../_data/types";

export const metadata = { title: "Payroll · Detalle por concepto" };
const PRIVATE = `reservado (menos de ${MIN_PERSONS} personas)`;
const MAX_ROW_PANELS = 3;
const COLS: Record<number, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3" };

export default async function PayrollConceptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const [dimensions, role] = await Promise.all([
    getDashboardDimensions(tenantId, "payroll"),
    getCurrentUserRole(tenantId, session!.user.id),
  ]);
  const filters = parseFilters(sp, dimensions);
  const raw = Array.isArray(sp.c) ? sp.c[0] : sp.c;
  const conceptId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  const data = await loadConceptDetail(tenantId, filters, dimensions, conceptId, { admin: role === "admin" });
  if (data.status === "notfound") notFound();

  const crumbs = [{ label: "Analítica", href: "/analytics" }, { label: "Payroll", href: overviewHref(filters) }, { label: "Detalle por concepto" }];
  if (data.status === "empty") {
    return (
      <DashboardShell>
        <Breadcrumb items={crumbs} />
        <DashboardEmpty title="Todavía no hay liquidaciones" text="Cargá el archivo de Liquidaciones para ver el detalle por concepto." />
      </DashboardShell>
    );
  }

  const { period, currency, options, dimensionOptions, overview, detail, freshness } = data;
  const money = (n: number) => fmtMoney(n, currency);
  const diff = (n: number) => fmtMoneyDiff(n, currency);
  const common = { compareLabel: period.compareLabel };
  const exportHref = (format: "xlsx" | "pdf") => {
    const q = filtersQuery(filters);
    if (conceptId !== null) q.set("c", String(conceptId));
    q.set("format", format);
    return `/payroll/conceptos/export?${q.toString()}`;
  };
  const dims = detail?.dimensions ?? [];
  const panels = dims.length > MAX_ROW_PANELS ? dims.slice(0, MAX_ROW_PANELS - 1) : dims;
  const tabbed = dims.length > MAX_ROW_PANELS ? dims.slice(MAX_ROW_PANELS - 1) : [];
  const rowCols = panels.length + (tabbed.length ? 1 : 0);
  const th = "px-3 py-2 font-semibold text-foreground";

  return (
    <DashboardShell>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Breadcrumb items={crumbs} />
          <h1 className="mt-1 text-lg font-bold leading-tight text-foreground">
            {detail ? `${detail.concept.code} · ${detail.concept.name}` : "Detalle por concepto"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {period.label}
            {detail && ` · comparado ${period.compareLabel}`}
            {detail?.concept.className && ` · ${detail.concept.className}`} · importes en {currency}
          </p>
        </div>
        <ExportMenu xlsxHref={exportHref("xlsx")} pdfHref={exportHref("pdf")} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PayrollFiltersBar
          period={filters.p}
          dimensions={dimensionOptions.map((d) => ({
            ...d,
            options: [{ value: NONE_TOKEN, label: "Sin asignar" }, ...d.options],
            selected: filterTokens(filters.dims[d.code]),
          }))}
        />
        <span className="h-5 w-px bg-border" aria-hidden />
        <ConceptSelect options={options} value={conceptId} />
      </div>

      {overview ? (
        overview.length === 0 ? (
          hasActiveFilters(filters) ? (
            <DashboardNoResults clearHref={`/payroll/conceptos${filters.p === "month" ? "" : `?p=${filters.p}`}`} />
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-card p-8 text-sm text-muted-foreground">
              No hay importes en el período.
            </div>
          )
        ) : (
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <caption className="sr-only">Conceptos con importes en {period.label}</caption>
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr>
                    {["Código", "Concepto", "Clase", "Personas", "Importe"].map((c, i) => (
                      <th key={c} scope="col" className={`${th} ${i >= 3 ? "text-right" : ""}`}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {overview.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.code}</td>
                      <th scope="row" className="px-3 py-1.5 font-medium text-foreground">
                        <Link href={conceptsHref(filters, r.id)} className="hover:underline">
                          {r.name}
                        </Link>
                      </th>
                      <td className="px-3 py-1.5">{r.className ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtInt(r.persons)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.amount === null ? PRIVATE : money(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : detail ? (
        detail.restricted ? (
          <div role="status" className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            Este concepto tiene menos de {MIN_PERSONS} personas por mes con los filtros aplicados: los importes se reservan por privacidad.
          </div>
        ) : (
          <PendingRegion className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                label="Importe del período"
                value={detail.kpis.amount.value}
                prev={detail.kpis.amount.prev}
                avg={null}
                avgLabel=""
                formatValue={money}
                formatDiff={diff}
                {...common}
              >
                <p className="mt-1 text-[11px] text-muted-foreground">Con el signo con el que viene de la liquidación</p>
              </MetricCard>
              <MetricCard
                label="Personas por mes"
                value={detail.kpis.persons.value}
                prev={detail.kpis.persons.prev}
                avg={null}
                avgLabel=""
                formatValue={(n) => fmtDec(n)}
                formatDiff={(n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtDec(Math.abs(n))}`}
                {...common}
              >
                <p className="mt-1 text-[11px] text-muted-foreground">Promedio de los meses con liquidación</p>
              </MetricCard>
              <MetricCard
                label="Importe medio por persona"
                value={detail.kpis.perPerson.value}
                prev={detail.kpis.perPerson.prev}
                avg={null}
                avgLabel=""
                formatValue={money}
                formatDiff={diff}
                {...common}
              >
                <p className="mt-1 text-[11px] text-muted-foreground">Por mes, entre quienes lo cobran</p>
              </MetricCard>
              {detail.kpis.quantity.hasQuantity ? (
                <MetricCard
                  label="Cantidad pagada"
                  value={detail.kpis.quantity.value}
                  prev={detail.kpis.quantity.prev}
                  avg={null}
                  avgLabel=""
                  formatValue={(n) => fmtDec(n)}
                  formatDiff={(n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtDec(Math.abs(n))}`}
                  {...common}
                >
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Horas, días o unidades · {detail.kpis.perUnit === null ? "—" : `${money(detail.kpis.perUnit)} por unidad`}
                  </p>
                </MetricCard>
              ) : (
                <MetricCard
                  label={detail.kpis.pctClass !== null ? "Peso en su clase" : "Peso sobre la masa bruta"}
                  value={detail.kpis.pctClass ?? detail.kpis.pctGross}
                  prev={null}
                  avg={null}
                  avgLabel=""
                  formatValue={fmtShare}
                  {...common}
                >
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {detail.kpis.pctClass !== null && detail.kpis.pctGross !== null
                      ? `${fmtShare(detail.kpis.pctGross)} de la masa bruta`
                      : detail.concept.className ?? "No pertenece a una clase"}
                  </p>
                </MetricCard>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3">
                <ChartCard title="Evolución del importe" subtitle="Últimos 12 meses" className="lg:col-span-2">
                  <ConceptEvolutionChart series={detail.series} currency={currency} name={detail.concept.name} />
                </ChartCard>
                <section className="flex min-h-0 flex-col rounded-lg border bg-card p-3">
                  <header className="mb-1 flex items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold text-foreground">Por proceso</h2>
                    <p className="truncate text-[11px] text-muted-foreground">{period.label}</p>
                  </header>
                  <div className="min-h-0 flex-1 overflow-auto">
                    {detail.processes.length === 0 ? (
                      <p className="py-6 text-center text-xs text-muted-foreground">Sin importes en el período.</p>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <caption className="sr-only">Importe del concepto por proceso</caption>
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th scope="col" className="py-1 pr-2 font-medium">Proceso</th>
                            <th scope="col" className="py-1 pr-2 text-right font-medium">Pers.</th>
                            <th scope="col" className="py-1 text-right font-medium">Importe</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {detail.processes.map((r) => (
                            <tr key={r.id}>
                              <th scope="row" className="py-1 pr-2 font-medium text-foreground">
                                {r.code}
                                <span className="block text-[10px] font-normal text-muted-foreground">
                                  {PROCESS_TYPE_LABELS[r.type] ?? r.type} · {monthLabel(r.month)}
                                </span>
                              </th>
                              <td className="py-1 pr-2 text-right tabular-nums">{fmtInt(r.persons)}</td>
                              <td className="py-1 text-right tabular-nums">{r.amount === null ? "reservado" : money(r.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </section>
              </div>

              {rowCols > 0 && (
                <div className={`grid min-h-0 flex-1 grid-cols-1 gap-3 ${COLS[rowCols] ?? "lg:grid-cols-3"}`}>
                  {panels.map((d) => (
                    <ChartCard key={d.code} title={`Importe medio por ${d.name.toLowerCase()}`} subtitle={period.label}>
                      <CostBarsChart dim={d} currency={currency} valueLabel="Importe medio" totalLabel="Importe total" />
                    </ChartCard>
                  ))}
                  {tabbed.length > 0 && (
                    <TabbedCostDimensions dimensions={tabbed} currency={currency} subtitle={period.label} valueLabel="Importe medio" totalLabel="Importe total" />
                  )}
                </div>
              )}

              {detail.persons && (
                <details className="rounded-lg border bg-card p-3 text-xs">
                  <summary className="cursor-pointer select-none font-semibold text-foreground">
                    Personas con este concepto (visible solo para administradores)
                  </summary>
                  <div className="mt-2 max-h-64 overflow-auto">
                    <table className="w-full text-left">
                      <caption className="sr-only">Personas por importe del concepto</caption>
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th scope="col" className="py-1 pr-3 font-medium">Nombre</th>
                          <th scope="col" className="py-1 pr-3 font-medium">Legajo</th>
                          {detail.hasQuantity && <th scope="col" className="py-1 pr-3 text-right font-medium">Cantidad</th>}
                          <th scope="col" className="py-1 text-right font-medium">Importe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {detail.persons.map((p) => (
                          <tr key={p.id}>
                            <th scope="row" className="py-1 pr-3 font-medium text-foreground">{p.name}</th>
                            <td className="py-1 pr-3 text-muted-foreground">{p.code}</td>
                            {detail.hasQuantity && <td className="py-1 pr-3 text-right tabular-nums">{p.quantity === null ? "—" : fmtDec(p.quantity)}</td>}
                            <td className="py-1 text-right tabular-nums">{money(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          </PendingRegion>
        )
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        {freshness.comparisonAvailable ? "" : "Sin comparación: no hay liquidaciones del período anterior. "}
        Importes pagados en cada período, tal como vienen de la liquidación; los períodos sin liquidación figuran como sin datos. Las celdas con menos de{" "}
        {MIN_PERSONS} personas se reservan por privacidad. Última liquidación: {monthLabel(freshness.refMonth, "long")}.
      </p>
    </DashboardShell>
  );
}
