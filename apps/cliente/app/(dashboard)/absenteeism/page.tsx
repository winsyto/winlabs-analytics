import Link from "next/link";
import { AlertTriangle, CalendarDays, Info, Table2 } from "lucide-react";
import { auth } from "@/auth";
import { ChartCard } from "../_dashboard-kit/chart-card";
import { DashboardShell, PendingRegion } from "../_dashboard-kit/dashboard-shell";
import { DashboardEmpty, DashboardNoResults } from "../_dashboard-kit/dashboard-states";
import { filterTokens, NONE_TOKEN } from "../_dashboard-kit/dimension-filters";
import { getDashboardDimensions } from "../_dashboard-kit/dimensions";
import { fmtInt, monthLabel } from "../_dashboard-kit/format";
import { ExportMenu } from "../_dashboard-kit/export-menu";
import { MetricCard } from "../_dashboard-kit/metric-card";
import { TargetStatus } from "../_dashboard-kit/target-status";
import { AbsenteeismFiltersBar } from "./_components/absenteeism-filters";
import { AbsenteeismFreshness } from "./_components/absenteeism-freshness";
import { BreakdownPanel } from "./_components/breakdown-panel";
import { amountMain, fmtDays, fmtHours, fmtPct, fmtPp } from "./_components/format";
import { RateBarsChart, TabbedRateDimensions } from "./_components/rate-bars-chart";
import { TrendChart } from "./_components/trend-chart";
import { hasActiveFilters, parseFilters } from "./_data/filters";
import { detailHref, filtersQuery } from "./_data/hrefs";
import { loadAbsenteeism } from "./_data/queries";
import type { Amount } from "./_data/types";

export const metadata = { title: "Ausentismos" };
const DASHBOARD_CODE = "absenteeism";

/** Máximo de paneles de dimensión en la segunda fila; si hay más, el último pasa a tener pestañas. */
const MAX_ROW_PANELS = 4;
const COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

const signed = (fmt: (n: number) => string) => (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;

export default async function AbsenteeismPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const dimensions = await getDashboardDimensions(tenantId, DASHBOARD_CODE);
  const filters = parseFilters(await searchParams, dimensions);
  const data = await loadAbsenteeism(tenantId, filters, dimensions);

  if (data.status === "empty") {
    return (
      <DashboardShell>
        <h1 className="text-lg font-bold text-foreground">Ausentismos</h1>
        <DashboardEmpty
          title="Todavía no hay datos de ausentismo"
          text={
            data.hasPeople
              ? "Hay personas cargadas pero ningún evento de ausencia con un mes cerrado. Cargá el archivo de Ausentismo (o conectá una integración) para ver la tasa, su evolución y la distribución por clase y unidad."
              : "Primero cargá el archivo de Personas y después el de Ausentismo (o conectá una integración de RRHH) para ver la tasa de ausentismo, su evolución y la distribución por clase y unidad."
          }
        />
      </DashboardShell>
    );
  }

  const { period, kpis, series, freshness, display, notices } = data;
  const common = { compareLabel: period.compareLabel };
  const target = kpis.rate.target;
  const subtitle = period.label;

  const dims = data.dimensions.map((d) => ({
    ...d,
    items: d.items.map((i) => ({ ...i, href: i.key === "others" ? undefined : detailHref(filters, "dim", d.slug, i.key) })),
  }));
  const withHref = (scope: "clase" | "tipo") => (items: typeof data.byClass) =>
    items.map((i) => ({ ...i, href: detailHref(filters, scope, i.key) }));
  const byClass = withHref("clase")(data.byClass);
  const byType = withHref("tipo")(data.byType);
  const eventosHref = detailHref(filters, "eventos");
  const panels = dims.length > MAX_ROW_PANELS ? dims.slice(0, MAX_ROW_PANELS - 1) : dims;
  const tabbed = dims.length > MAX_ROW_PANELS ? dims.slice(MAX_ROW_PANELS - 1) : [];
  const rowCols = panels.length + (tabbed.length ? 1 : 0);

  const noResults = hasActiveFilters(filters) && kpis.people.exposed === 0;
  const amt = (a: Amount) => (display === "hours" ? a.hours : a.days);
  const amtFmt = display === "hours" ? fmtHours : fmtDays;
  const exItems = data.excluded.items;
  const exportHref = (format: "xlsx" | "pdf") => {
    const q = filtersQuery(filters);
    q.set("format", format);
    return `/absenteeism/export?${q.toString()}`;
  };

  return (
    <DashboardShell>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold leading-tight text-foreground">Ausentismos</h1>
          <p className="text-xs text-muted-foreground">
            {period.label} · comparado {period.compareLabel}
            {!freshness.comparisonAvailable && " (sin comparación: no hay datos del período anterior)"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AbsenteeismFreshness {...freshness} />
          <Link
            href="/absenteeism/reportes/fecha"
            className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            Resumen por fecha
          </Link>
          <Link
            href="/absenteeism/reportes/tipos"
            className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            <Table2 className="h-3.5 w-3.5" aria-hidden />
            Cuadro por tipo
          </Link>
          <ExportMenu xlsxHref={exportHref("xlsx")} pdfHref={exportHref("pdf")} />
        </div>
      </div>

      <AbsenteeismFiltersBar
        period={filters.p}
        dimensions={dims.map((d) => ({
          code: d.code,
          name: d.name,
          slug: d.slug,
          options: [{ value: NONE_TOKEN, label: "Sin asignar" }, ...d.options],
          selected: filterTokens(filters.dims[d.code]),
        }))}
        classOptions={data.classOptions}
        typeOptions={data.typeOptions}
        selectedClasses={filters.classes}
        selectedTypes={filters.types}
      />

      {notices.unclassifiedTypes > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {notices.unclassifiedTypes === 1 ? "Hay 1 tipo de ausencia sin clasificar" : `Hay ${notices.unclassifiedTypes} tipos de ausencia sin clasificar`}
            : cuentan como ausentismo hasta que se clasifiquen y pueden alterar la tasa.
          </span>
          <Link href="/settings/absence-types" className="ml-auto shrink-0 font-medium underline">
            Revisar
          </Link>
        </p>
      )}
      {notices.attendanceMode === "detailed" && (
        <p role="status" className="flex items-center gap-2 rounded-md border bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Este tenant usa asistencia detallada (integración por API), todavía pendiente: la tasa se calcula con los turnos y el horario de la empresa.
        </p>
      )}

      {noResults ? (
        <DashboardNoResults clearHref={filters.p === "month" ? "/absenteeism" : `/absenteeism?p=${filters.p}`} />
      ) : (
        <PendingRegion className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Tasa de ausentismo"
              href={eventosHref}
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
            </MetricCard>
            <MetricCard
              label="Ausencia total"
              href={eventosHref}
              value={amt(kpis.absence.cur)}
              prev={kpis.absence.prev ? amt(kpis.absence.prev) : null}
              avg={null}
              avgLabel=""
              formatValue={amtFmt}
              formatDiff={signed(amtFmt)}
              {...common}
            >
              {display === "both" && <p className="mt-1 text-[11px] text-muted-foreground">{fmtHours(kpis.absence.cur.hours)} de ausencia</p>}
            </MetricCard>
            <MetricCard
              label="Eventos"
              href={eventosHref}
              value={kpis.events.value}
              prev={kpis.events.prev}
              avg={null}
              avgLabel=""
              {...common}
            >
              {kpis.events.value > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Duración prom.: {display === "hours" ? fmtHours(kpis.absence.cur.hours / kpis.events.value) : fmtDays(kpis.absence.cur.days / kpis.events.value)}
                </p>
              )}
            </MetricCard>
            <MetricCard
              label="Personas afectadas"
              href={detailHref(filters, "personas")}
              value={kpis.people.value}
              prev={kpis.people.prev}
              avg={null}
              avgLabel=""
              {...common}
            >
              {kpis.people.pct !== null && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {fmtPct(kpis.people.pct)} de la dotación ({fmtInt(kpis.people.exposed)})
                </p>
              )}
            </MetricCard>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3">
              <ChartCard className="lg:col-span-2" title="Evolución de la tasa de ausentismo" subtitle="Últimos 12 meses cerrados">
                <TrendChart series={series} target={target} display={display} />
              </ChartCard>
              <BreakdownPanel byClass={byClass} byType={byType} display={display} subtitle={subtitle} />
            </div>

            {rowCols > 0 && (
              <div className={`grid min-h-0 flex-1 grid-cols-1 gap-3 ${COLS[rowCols] ?? "lg:grid-cols-4"}`}>
                {panels.map((d) => (
                  <ChartCard key={d.code} title={`Tasa por ${d.name.toLowerCase()}`} subtitle={subtitle}>
                    <RateBarsChart dim={d} target={target} display={display} />
                  </ChartCard>
                ))}
                {tabbed.length > 0 && <TabbedRateDimensions dimensions={tabbed} target={target} display={display} subtitle={subtitle} />}
              </div>
            )}
          </div>

          <footer className="flex items-start justify-between gap-3 text-[11px] text-muted-foreground">
            <p>
              Fuera de la tasa:{" "}
              {exItems.length === 0
                ? "sin vacaciones, licencias ni francos en el período."
                : exItems.map((i) => `${i.label.toLowerCase()} ${amountMain({ hours: i.hours, days: i.days }, display)}`).join(" · ")}
            </p>
            <details className="relative shrink-0">
              <summary className="cursor-pointer select-none font-medium text-foreground hover:underline">Cómo se calcula</summary>
              <div className="absolute bottom-6 right-0 z-10 w-[26rem] space-y-1.5 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-md">
                <p>
                  <strong>Tasa = horas de ausencia ÷ horas programadas.</strong> En períodos de varios meses se suman horas y no se promedian las tasas.
                </p>
                <p>Las horas programadas salen del turno de cada persona (días laborables × horas por día) mientras estuvo activa; sin turno se usa el horario de la empresa.</p>
                <p>Solo cuentan los tipos de ausencia marcados como ausentismo y los eventos no cancelados. La unidad de cada persona es la vigente cada día.</p>
                <p>No se descuentan feriados: las horas programadas pueden estar levemente sobreestimadas (alrededor del 4 % en un año).</p>
                <p>Los meses anteriores al primer evento cargado ({monthLabel(freshness.firstMonth)}) figuran como sin datos.</p>
              </div>
            </details>
          </footer>
        </PendingRegion>
      )}
    </DashboardShell>
  );
}
