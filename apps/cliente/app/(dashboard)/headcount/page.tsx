import { auth } from "@/auth";
import { ChartCard } from "../_dashboard-kit/chart-card";
import { Breadcrumb } from "../_dashboard-kit/breadcrumb";
import { DashboardShell, PendingRegion } from "../_dashboard-kit/dashboard-shell";
import { DashboardEmpty, DashboardNoResults } from "../_dashboard-kit/dashboard-states";
import { ExportMenu } from "../_dashboard-kit/export-menu";
import { FreshnessBadge } from "../_dashboard-kit/freshness-badge";
import { monthLabel } from "../_dashboard-kit/format";
import { MetricCard } from "../_dashboard-kit/metric-card";
import { DimensionChart } from "./_components/dimension-chart";
import { EvolutionChart } from "./_components/evolution-chart";
import { HeadcountFiltersBar } from "./_components/headcount-filters";
import { TabbedDimensions } from "./_components/tabbed-dimensions";
import { getDimensions } from "./_data/dimensions";
import { filterTokens, hasActiveFilters, NONE_TOKEN, parseFilters } from "./_data/filters";
import { detailHref, filtersQuery } from "./_data/hrefs";
import { loadHeadcount } from "./_data/queries";

export const metadata = { title: "Headcount" };

/** Máximo de paneles en la segunda fila; si hay más dimensiones, el último panel pasa a tener pestañas. */
const MAX_ROW_PANELS = 4;
const COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

export default async function HeadcountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const dimensions = await getDimensions(tenantId);
  const filters = parseFilters(await searchParams, dimensions);
  const data = await loadHeadcount(tenantId, filters, dimensions);

  if (data.status === "empty") {
    return (
      <DashboardShell>
        <Breadcrumb items={[{ label: "Analítica", href: "/analytics" }, { label: "Headcount" }]} />
        <h1 className="mt-1 text-lg font-bold text-foreground">Headcount</h1>
        <DashboardEmpty
          title="Todavía no hay datos de personas"
          text="Cuando se cargue el archivo de personas (o se conecte una integración de RRHH) y se genere el primer cierre mensual, vas a ver acá la dotación, las altas, las bajas y su distribución."
        />
      </DashboardShell>
    );
  }

  const { period, kpis, series, freshness } = data;
  const common = { compareLabel: period.compareLabel };
  const dims = data.dimensions.map((d) => ({
    ...d,
    items: d.items.map((i) => ({
      ...i,
      href: i.key === "others" ? undefined : detailHref(filters, "dim", d.slug, i.key),
    })),
  }));

  const [first, ...rest] = dims;
  const rowPanels = rest.length > MAX_ROW_PANELS ? rest.slice(0, MAX_ROW_PANELS - 1) : rest;
  const tabbed = rest.length > MAX_ROW_PANELS ? rest.slice(MAX_ROW_PANELS - 1) : [];
  const rowCols = rowPanels.length + (tabbed.length ? 1 : 0);
  const subtitle = `Cierre de ${monthLabel(period.refMonth)}`;

  const exportHref = (format: "xlsx" | "pdf") => {
    const q = filtersQuery(filters);
    q.set("format", format);
    return `/headcount/export?${q.toString()}`;
  };
  const noResults =
    hasActiveFilters(filters) &&
    kpis.headcount.value === 0 &&
    kpis.altas.value === 0 &&
    kpis.bajas.value === 0;

  return (
    <DashboardShell>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Breadcrumb items={[{ label: "Analítica", href: "/analytics" }, { label: "Headcount" }]} />
          <h1 className="mt-1 text-lg font-bold leading-tight text-foreground">Headcount</h1>
          <p className="text-xs text-muted-foreground">
            {period.label} · comparado {period.compareLabel}
            {!freshness.comparisonAvailable && " (sin comparación: el historial no cubre el período anterior)"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FreshnessBadge {...freshness} />
          <ExportMenu xlsxHref={exportHref("xlsx")} pdfHref={exportHref("pdf")} />
        </div>
      </div>

      <HeadcountFiltersBar
        period={filters.p}
        dimensions={dims.map((d) => ({
          code: d.code,
          name: d.name,
          slug: d.slug,
          options: [{ value: NONE_TOKEN, label: "Sin asignar" }, ...d.options],
          selected: filterTokens(filters.dims[d.code]),
        }))}
      />

      {noResults ? (
        <DashboardNoResults clearHref={filters.p === "month" ? "/headcount" : `/headcount?p=${filters.p}`} />
      ) : (
        <PendingRegion className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Headcount al cierre" polarity="up-good" href={detailHref(filters, "activos")} {...kpis.headcount} {...common} />
            <MetricCard label="Altas del período" polarity="up-good" href={detailHref(filters, "altas")} {...kpis.altas} {...common} />
            <MetricCard label="Bajas del período" polarity="down-good" href={detailHref(filters, "bajas")} {...kpis.bajas} {...common} />
            <MetricCard label="Variación neta (altas − bajas)" polarity="up-good" signed hidePct {...kpis.neta} {...common} />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3">
              <ChartCard
                className={first ? "lg:col-span-2" : "lg:col-span-3"}
                title="Evolución del headcount"
                subtitle="Últimos 12 cierres mensuales"
              >
                <EvolutionChart series={series} />
              </ChartCard>
              {first && (
                <ChartCard title={`Por ${first.name.toLowerCase()}`} subtitle={subtitle}>
                  <DimensionChart dim={first} />
                </ChartCard>
              )}
            </div>

            {rowCols > 0 && (
              <div className={`grid min-h-0 flex-1 grid-cols-1 gap-3 ${COLS[rowCols] ?? "lg:grid-cols-4"}`}>
                {rowPanels.map((d) => (
                  <ChartCard key={d.code} title={`Por ${d.name.toLowerCase()}`} subtitle={subtitle}>
                    <DimensionChart dim={d} />
                  </ChartCard>
                ))}
                {tabbed.length > 0 && <TabbedDimensions dimensions={tabbed} refMonth={period.refMonth} />}
              </div>
            )}
          </div>
        </PendingRegion>
      )}
    </DashboardShell>
  );
}
