import { auth } from "@/auth";
import { ChartCard } from "../_dashboard-kit/chart-card";
import { DashboardShell, PendingRegion } from "../_dashboard-kit/dashboard-shell";
import { DashboardEmpty, DashboardNoResults } from "../_dashboard-kit/dashboard-states";
import { filterTokens, NONE_TOKEN } from "../_dashboard-kit/dimension-filters";
import { getDashboardDimensions } from "../_dashboard-kit/dimensions";
import { fmtDec, fmtInt, fmtTenure, monthLabel } from "../_dashboard-kit/format";
import { ExportMenu } from "../_dashboard-kit/export-menu";
import { MetricCard } from "../_dashboard-kit/metric-card";
import { TargetStatus } from "../_dashboard-kit/target-status";
import { EvolutionPanel } from "./_components/evolution-panel";
import { fmtPct, fmtPp } from "./_components/format";
import { RateBarsChart, TabbedRateDimensions } from "./_components/rate-bars-chart";
import { ReasonPanel } from "./_components/reason-panel";
import { TurnoverFiltersBar } from "./_components/turnover-filters";
import { TurnoverFreshness } from "./_components/turnover-freshness";
import { hasActiveFilters, parseFilters } from "./_data/filters";
import { detailHref, filtersQuery } from "./_data/hrefs";
import { loadTurnover } from "./_data/queries";

export const metadata = { title: "Rotación" };
const DASHBOARD_CODE = "turnover";

/** Máximo de paneles de dimensión en la segunda fila; si hay más, el último pasa a tener pestañas. */
const MAX_ROW_PANELS = 4;
const COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

const signed = (fmt: (n: number) => string) => (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;

export default async function TurnoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const dimensions = await getDashboardDimensions(tenantId, DASHBOARD_CODE);
  const filters = parseFilters(await searchParams, dimensions);
  const data = await loadTurnover(tenantId, filters, dimensions);

  if (data.status === "empty") {
    return (
      <DashboardShell>
        <h1 className="text-lg font-bold text-foreground">Rotación de personal</h1>
        <DashboardEmpty
          title={data.needsHistory ? "Falta historia para calcular la rotación" : "Todavía no hay datos de personas"}
          text={
            data.needsHistory
              ? "La rotación necesita al menos dos cierres mensuales consecutivos (el de apertura y el de cierre de cada mes). Cargá el archivo de Personas con más historia o esperá al próximo cierre mensual."
              : data.hasPeople
                ? "Hay personas cargadas pero todavía no hay cierres mensuales. El worker los genera al terminar la carga de Personas o cada hora."
                : "Cargá el archivo de Personas (con las fechas de ingreso y baja y el motivo de cada baja) para ver la rotación, su evolución y la distribución por motivo y unidad."
          }
        />
      </DashboardShell>
    );
  }

  const { period, kpis, series, freshness } = data;
  const common = { compareLabel: period.compareLabel };
  const target = kpis.rate.target;
  const subtitle = period.label;
  const dims = data.dimensions.map((d) => ({
    ...d,
    items: d.items.map((i) => ({ ...i, href: i.key === "others" ? undefined : detailHref(filters, "dim", d.slug, i.key) })),
  }));
  const byCategory = data.byCategory.map((i) => ({ ...i, href: detailHref(filters, "categoria", i.key) }));
  const byReason = data.byReason.map((i) => ({ ...i, href: detailHref(filters, "motivo", i.key) }));
  const bajasHref = detailHref(filters, "bajas");
  const exportHref = (format: "xlsx" | "pdf") => {
    const q = filtersQuery(filters);
    q.set("format", format);
    return `/turnover/export?${q.toString()}`;
  };
  const panels = dims.length > MAX_ROW_PANELS ? dims.slice(0, MAX_ROW_PANELS - 1) : dims;
  const tabbed = dims.length > MAX_ROW_PANELS ? dims.slice(MAX_ROW_PANELS - 1) : [];
  const rowCols = panels.length + (tabbed.length ? 1 : 0);
  const noResults = hasActiveFilters(filters) && (data.avgHeadcount ?? 0) === 0 && kpis.bajas.value === 0;
  const targetNote = `(${fmtDec(kpis.rate.annualTarget)} % anual)`;
  const catSummary = kpis.bajas.byCategory.slice(0, 3).map((c) => `${c.label} ${c.count}`).join(" · ");

  return (
    <DashboardShell>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold leading-tight text-foreground">Rotación de personal</h1>
          <p className="text-xs text-muted-foreground">
            {period.label} · comparado {period.compareLabel}
            {!freshness.comparisonAvailable && " (sin comparación: no hay datos del período anterior)"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TurnoverFreshness {...freshness} />
          <ExportMenu xlsxHref={exportHref("xlsx")} pdfHref={exportHref("pdf")} />
        </div>
      </div>

      <TurnoverFiltersBar
        period={filters.p}
        dimensions={dims.map((d) => ({
          code: d.code,
          name: d.name,
          slug: d.slug,
          options: [{ value: NONE_TOKEN, label: "Sin asignar" }, ...d.options],
          selected: filterTokens(filters.dims[d.code]),
        }))}
        categoryOptions={data.categoryOptions}
        reasonOptions={data.reasonOptions}
        selectedCategories={filters.categories}
        selectedReasons={filters.reasons}
      />

      {noResults ? (
        <DashboardNoResults clearHref={filters.p === "month" ? "/turnover" : `/turnover?p=${filters.p}`} />
      ) : (
        <PendingRegion className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Rotación"
              href={bajasHref}
              value={kpis.rate.value}
              prev={kpis.rate.prev}
              avg={kpis.rate.avg}
              avgLabel="Prom. 12m"
              hidePct
              formatValue={fmtPct}
              formatDiff={fmtPp}
              formatAvg={fmtPct}
              {...common}
            >
              <TargetStatus value={kpis.rate.value} target={target} note={targetNote} />
              {kpis.rate.over && kpis.rate.over.total > 0 && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {kpis.rate.over.count} de {kpis.rate.over.total} {kpis.rate.over.total === 1 ? "unidad" : "unidades"} por{" "}
                  {kpis.rate.over.dimension.toLowerCase()} sobre la meta
                </p>
              )}
            </MetricCard>
            <MetricCard
              label="Rotación voluntaria"
              href={detailHref(filters, "categoria", "voluntary")}
              value={kpis.voluntary.value}
              prev={kpis.voluntary.prev}
              avg={kpis.voluntary.avg}
              avgLabel="Prom. 12m"
              hidePct
              formatValue={fmtPct}
              formatDiff={fmtPp}
              formatAvg={fmtPct}
              {...common}
            >
              <p className="mt-1 text-[11px] text-muted-foreground">Renuncias y mejores ofertas</p>
            </MetricCard>
            <MetricCard label="Bajas" href={bajasHref} value={kpis.bajas.value} prev={kpis.bajas.prev} avg={null} avgLabel="" {...common}>
              {catSummary && <p className="mt-1 truncate text-[11px] text-muted-foreground">{catSummary}</p>}
            </MetricCard>
            <MetricCard label="Bajas tempranas" href={detailHref(filters, "tempranas")} value={kpis.early.value} prev={kpis.early.prev} avg={null} avgLabel="" {...common}>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {kpis.early.pct !== null ? `${fmtPct(kpis.early.pct)} de las bajas (menos de 1 año)` : "Menos de 1 año de antigüedad"}
                {kpis.early.avgTenureMonths !== null && ` · antigüedad prom. al salir: ${fmtTenure(Math.round(kpis.early.avgTenureMonths))}`}
              </p>
            </MetricCard>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3">
              <EvolutionPanel series={series} monthlyTarget={data.kpis.rate.annualTarget / 12} subtitle="Últimos 12 meses cerrados" />
              <ReasonPanel byCategory={byCategory} byReason={byReason} subtitle={subtitle} />
            </div>

            {rowCols > 0 && (
              <div className={`grid min-h-0 flex-1 grid-cols-1 gap-3 ${COLS[rowCols] ?? "lg:grid-cols-4"}`}>
                {panels.map((d) => (
                  <ChartCard key={d.code} title={`Rotación por ${d.name.toLowerCase()}`} subtitle={subtitle}>
                    <RateBarsChart dim={d} target={target} />
                  </ChartCard>
                ))}
                {tabbed.length > 0 && <TabbedRateDimensions dimensions={tabbed} target={target} subtitle={subtitle} />}
              </div>
            )}
          </div>

          <footer className="flex items-start justify-between gap-3 text-[11px] text-muted-foreground">
            <p>
              Headcount promedio del período: {data.avgHeadcount === null ? "—" : fmtDec(data.avgHeadcount)}. Meta {fmtDec(kpis.rate.annualTarget)} % anual
              = {fmtDec(kpis.rate.annualTarget / 12)} % por mes.
            </p>
            <details className="relative shrink-0">
              <summary className="cursor-pointer select-none font-medium text-foreground hover:underline">Cómo se calcula</summary>
              <div className="absolute bottom-6 right-0 z-10 w-[26rem] space-y-1.5 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-md">
                <p>
                  <strong>Rotación = bajas ÷ headcount promedio.</strong> El headcount promedio es el promedio de los cierres mensuales del período más el
                  de apertura (el cierre del mes anterior). En períodos de varios meses se suman las bajas.
                </p>
                <p>
                  Entran todas las bajas (voluntaria, involuntaria, fin de contrato, jubilación y otra); la rotación voluntaria cuenta solo las de categoría
                  voluntaria. Los filtros por categoría y motivo afectan solo a las bajas.
                </p>
                <p>
                  La meta del tenant es anual: se prorratea al período ({fmtDec(kpis.rate.annualTarget)} % × {kpis.rate.months}/12 ={" "}
                  {fmtDec(kpis.rate.target)} %).
                </p>
                <p>Cada baja cuenta en la unidad vigente en la fecha de la baja; el headcount, en las unidades del cierre. Bajas tempranas: menos de 12 meses de antigüedad.</p>
                <p>El primer cierre ({monthLabel(freshness.firstMonth)}) no tiene apertura: su mes figura como sin datos.</p>
              </div>
            </details>
          </footer>
        </PendingRegion>
      )}
    </DashboardShell>
  );
}
