import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import { auth } from "@/auth";
import { ChartCard } from "../_dashboard-kit/chart-card";
import { DashboardShell, PendingRegion } from "../_dashboard-kit/dashboard-shell";
import { DashboardEmpty, DashboardNoResults } from "../_dashboard-kit/dashboard-states";
import { filterTokens, NONE_TOKEN } from "../_dashboard-kit/dimension-filters";
import { getDashboardDimensions } from "../_dashboard-kit/dimensions";
import { fmtDec, fmtInt, monthLabel } from "../_dashboard-kit/format";
import { ExportMenu } from "../_dashboard-kit/export-menu";
import { MetricCard } from "../_dashboard-kit/metric-card";
import { TargetStatus } from "../_dashboard-kit/target-status";
import { fmtHours, fmtPct, fmtPp } from "./_components/format";
import { OvertimeFiltersBar } from "./_components/overtime-filters";
import { OvertimeFreshness } from "./_components/overtime-freshness";
import { RateBarsChart, TabbedRateDimensions } from "./_components/rate-bars-chart";
import { TrendChart } from "./_components/trend-chart";
import { TypePanel } from "./_components/type-panel";
import { hasActiveFilters, parseFilters } from "./_data/filters";
import { detailHref, filtersQuery } from "./_data/hrefs";
import { loadOvertime } from "./_data/queries";

export const metadata = { title: "Horas extras" };
const DASHBOARD_CODE = "overtime";

/** Máximo de paneles de dimensión en la segunda fila; si hay más, el último pasa a tener pestañas. */
const MAX_ROW_PANELS = 4;
const COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

const signed = (fmt: (n: number) => string) => (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;

export default async function OvertimePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const dimensions = await getDashboardDimensions(tenantId, DASHBOARD_CODE);
  const filters = parseFilters(await searchParams, dimensions);
  const data = await loadOvertime(tenantId, filters, dimensions);

  if (data.status === "empty") {
    return (
      <DashboardShell>
        <h1 className="text-lg font-bold text-foreground">Horas extras</h1>
        <DashboardEmpty
          title="Todavía no hay horas por tipo cargadas"
          text={
            data.hasPeople
              ? "Hay personas cargadas pero ninguna hora por tipo de hora con un mes cerrado. Cargá el archivo de Asistencia (o conectá una integración de tiempo y asistencia) para ver la tasa de horas extras, su evolución y la distribución por tipo y unidad."
              : "Primero cargá el archivo de Personas y después el de Asistencia (o conectá una integración de RRHH) para ver la tasa de horas extras, su evolución y la distribución por tipo y unidad."
          }
        />
      </DashboardShell>
    );
  }

  const { period, kpis, series, freshness, notices, coverage, base } = data;
  const common = { compareLabel: period.compareLabel };
  const target = kpis.rate.target;
  const subtitle = period.label;

  const dims = data.dimensions.map((d) => ({
    ...d,
    items: d.items.map((i) => ({ ...i, href: i.key === "others" ? undefined : detailHref(filters, "dim", d.slug, i.key) })),
  }));
  const byType = data.byType.map((i) => ({ ...i, href: detailHref(filters, "tipo", i.key) }));
  const horasHref = detailHref(filters, "horas");
  const personasHref = detailHref(filters, "personas");
  const exportHref = (format: "xlsx" | "pdf") => {
    const q = filtersQuery(filters);
    q.set("format", format);
    return `/overtime/export?${q.toString()}`;
  };
  const panels = dims.length > MAX_ROW_PANELS ? dims.slice(0, MAX_ROW_PANELS - 1) : dims;
  const tabbed = dims.length > MAX_ROW_PANELS ? dims.slice(MAX_ROW_PANELS - 1) : [];
  const rowCols = panels.length + (tabbed.length ? 1 : 0);

  const noResults = hasActiveFilters(filters) && coverage.covered === 0;
  const baseName = base === "worked" ? "horas trabajadas" : "horas programadas";

  return (
    <DashboardShell>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold leading-tight text-foreground">Horas extras</h1>
          <p className="text-xs text-muted-foreground">
            {period.label} · comparado {period.compareLabel}
            {!freshness.comparisonAvailable && " (sin comparación: no hay datos del período anterior)"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OvertimeFreshness {...freshness} />
          <ExportMenu xlsxHref={exportHref("xlsx")} pdfHref={exportHref("pdf")} />
        </div>
      </div>

      <OvertimeFiltersBar
        period={filters.p}
        dimensions={dims.map((d) => ({
          code: d.code,
          name: d.name,
          slug: d.slug,
          options: [{ value: NONE_TOKEN, label: "Sin asignar" }, ...d.options],
          selected: filterTokens(filters.dims[d.code]),
        }))}
        typeOptions={data.typeOptions}
        selectedTypes={filters.types}
      />

      {notices.unclassifiedTypes > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {notices.unclassifiedTypes === 1 ? "Hay 1 tipo de hora sin clasificar" : `Hay ${notices.unclassifiedTypes} tipos de hora sin clasificar`}
            : no cuentan como horas extra hasta que se clasifiquen.
          </span>
          <Link href="/settings/time-entry-types" className="ml-auto shrink-0 font-medium underline">
            Revisar
          </Link>
        </p>
      )}
      {base === "worked" && (
        <p role="status" className="flex items-center gap-2 rounded-md border bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
          La tasa de este tenant se calcula sobre las horas trabajadas (no sobre las programadas).
        </p>
      )}

      {noResults ? (
        <DashboardNoResults clearHref={filters.p === "month" ? "/overtime" : `/overtime?p=${filters.p}`} />
      ) : (
        <PendingRegion className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Tasa de horas extra"
              href={horasHref}
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
              <TargetStatus value={kpis.rate.value} target={target} />
              {kpis.rate.over && kpis.rate.over.total > 0 && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {kpis.rate.over.count} de {kpis.rate.over.total} {kpis.rate.over.total === 1 ? "unidad" : "unidades"} por{" "}
                  {kpis.rate.over.dimension.toLowerCase()} sobre la meta
                </p>
              )}
            </MetricCard>
            <MetricCard
              label="Horas extra"
              href={horasHref}
              value={kpis.hours.value}
              prev={kpis.hours.prev}
              avg={null}
              avgLabel=""
              formatValue={fmtHours}
              formatDiff={signed(fmtHours)}
              {...common}
            />
            <MetricCard
              label="Personas con horas extra"
              href={personasHref}
              value={kpis.people.value}
              prev={kpis.people.prev}
              avg={null}
              avgLabel=""
              {...common}
            >
              {kpis.people.pct !== null && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {fmtPct(kpis.people.pct)} de las personas con horas informadas ({fmtInt(kpis.people.covered)})
                </p>
              )}
            </MetricCard>
            <MetricCard
              label="Horas extra por persona"
              href={personasHref}
              value={kpis.perPerson.value}
              prev={kpis.perPerson.prev}
              avg={null}
              avgLabel=""
              formatValue={fmtHours}
              formatDiff={signed(fmtHours)}
              {...common}
            >
              <p className="mt-1 text-[11px] text-muted-foreground">Entre quienes hicieron horas extra</p>
            </MetricCard>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3">
              <ChartCard className="lg:col-span-2" title="Evolución de la tasa de horas extra" subtitle="Últimos 12 meses cerrados">
                <TrendChart series={series} target={target} />
              </ChartCard>
              <ChartCard title="Horas extra por tipo" subtitle={subtitle}>
                <TypePanel byType={byType} unauthorized={data.unauthorized} />
              </ChartCard>
            </div>

            {rowCols > 0 && (
              <div className={`grid min-h-0 flex-1 grid-cols-1 gap-3 ${COLS[rowCols] ?? "lg:grid-cols-4"}`}>
                {panels.map((d) => (
                  <ChartCard key={d.code} title={`Tasa por ${d.name.toLowerCase()}`} subtitle={subtitle}>
                    <RateBarsChart dim={d} target={target} />
                  </ChartCard>
                ))}
                {tabbed.length > 0 && <TabbedRateDimensions dimensions={tabbed} target={target} subtitle={subtitle} />}
              </div>
            )}
          </div>

          <footer className="flex items-start justify-between gap-3 text-[11px] text-muted-foreground">
            <p>
              Cobertura: {fmtInt(coverage.covered)} de {fmtInt(coverage.total)} {coverage.total === 1 ? "persona" : "personas"} con horas informadas
              en el período
              {coverage.covered < coverage.total && " (la tasa refleja solo ese grupo)"}.
              {data.unauthorized.hours > 0 && ` Horas extra no autorizadas: ${fmtHours(data.unauthorized.hours)}, fuera de la tasa.`}
            </p>
            <details className="relative shrink-0">
              <summary className="cursor-pointer select-none font-medium text-foreground hover:underline">Cómo se calcula</summary>
              <div className="absolute bottom-6 right-0 z-10 w-[26rem] space-y-1.5 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-md">
                <p>
                  <strong>Tasa = horas extra ÷ {baseName}.</strong> En períodos de varios meses se suman horas y no se promedian las tasas.
                </p>
                {base === "scheduled" ? (
                  <p>Las horas programadas salen del turno de cada persona (días laborables × horas por día) mientras estuvo activa; sin turno se usa el horario de la empresa.</p>
                ) : (
                  <p>Las horas trabajadas son la suma de las horas de la persona en cada día, según el archivo de Asistencia.</p>
                )}
                <p>Entran en el denominador solo las personas con horas informadas en ese mes. Las horas extra son las de los tipos de categoría «Hora extra»; cada hora cuenta en la unidad que la persona tenía ese día.</p>
                <p>Las horas extra no autorizadas no entran en ninguna tasa: se muestran aparte.</p>
                <p>No se descuentan feriados. Los meses anteriores a las primeras horas cargadas ({monthLabel(freshness.firstMonth)}) figuran como sin datos.</p>
                <p>Referencia de la tasa: {fmtDec(target)} % mensual (meta del tenant).</p>
              </div>
            </details>
          </footer>
        </PendingRegion>
      )}
    </DashboardShell>
  );
}
