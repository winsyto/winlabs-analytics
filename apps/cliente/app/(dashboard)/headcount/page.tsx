import { auth } from "@/auth";
import { ChartCard } from "../_dashboard-kit/chart-card";
import { DashboardShell, PendingRegion } from "../_dashboard-kit/dashboard-shell";
import { DashboardEmpty, DashboardNoResults } from "../_dashboard-kit/dashboard-states";
import { FreshnessBadge } from "../_dashboard-kit/freshness-badge";
import { monthLabel } from "../_dashboard-kit/format";
import { ExportMenu } from "../_dashboard-kit/export-menu";
import { MetricCard } from "../_dashboard-kit/metric-card";
import { BarDistributionChart } from "./_components/bar-distribution-chart";
import { ContractDonut } from "./_components/contract-donut";
import { EvolutionChart } from "./_components/evolution-chart";
import { HeadcountFiltersBar } from "./_components/headcount-filters";
import { hasActiveFilters, parseFilters } from "./_data/filters";
import { detailHref, filtersQuery } from "./_data/hrefs";
import { loadHeadcount } from "./_data/queries";

export const metadata = { title: "Headcount" };

export default async function HeadcountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const filters = parseFilters(await searchParams);
  const data = await loadHeadcount(tenantId, filters);

  if (data.status === "empty") {
    return (
      <DashboardShell>
        <h1 className="text-lg font-bold text-foreground">Headcount</h1>
        <DashboardEmpty
          title="Todavía no hay datos de personas"
          text="Cuando se cargue el archivo de personas (o se conecte una integración de RRHH) y se genere el primer cierre mensual, vas a ver acá la dotación, las altas, las bajas y su distribución."
        />
      </DashboardShell>
    );
  }

  const { period, kpis, series, byArea, byLocation, byContract, options, freshness } = data;
  const common = { compareLabel: period.compareLabel };
  const withHref = (items: typeof byArea, scope: "area" | "sede" | "contrato") =>
    items.map((i) => ({
      ...i,
      href: i.key === "others" || (i.key === "none" && scope === "contrato") ? undefined : detailHref(filters, scope, i.key),
    }));
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
          <h1 className="text-lg font-bold leading-tight text-foreground">Headcount</h1>
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

      <HeadcountFiltersBar filters={filters} options={options} />

      {noResults ? (
        <DashboardNoResults clearHref={filters.p === "month" ? "/headcount" : `/headcount?p=${filters.p}`} />
      ) : (
        <PendingRegion className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Headcount al cierre" href={detailHref(filters, "activos")} {...kpis.headcount} {...common} />
            <MetricCard label="Altas del período" href={detailHref(filters, "altas")} {...kpis.altas} {...common} />
            <MetricCard label="Bajas del período" href={detailHref(filters, "bajas")} {...kpis.bajas} {...common} />
            <MetricCard label="Variación neta (altas − bajas)" signed hidePct {...kpis.neta} {...common} />
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3 lg:grid-rows-2">
            <ChartCard
              className="lg:col-span-2"
              title="Evolución del headcount"
              subtitle="Últimos 12 cierres mensuales"
            >
              <EvolutionChart series={series} />
            </ChartCard>
            <ChartCard
              title="Por tipo de contrato"
              subtitle={`Cierre de ${monthLabel(period.refMonth)}`}
              footnote="Según el contrato actual de cada persona."
            >
              <ContractDonut items={withHref(byContract, "contrato")} />
            </ChartCard>
            <ChartCard
              className="lg:col-span-2"
              title="Por área"
              subtitle={`Cierre de ${monthLabel(period.refMonth)}`}
            >
              <BarDistributionChart items={withHref(byArea, "area")} name="Área" />
            </ChartCard>
            <ChartCard title="Por sede" subtitle={`Cierre de ${monthLabel(period.refMonth)}`}>
              <BarDistributionChart items={withHref(byLocation, "sede")} name="Sede" />
            </ChartCard>
          </div>
        </PendingRegion>
      )}
    </DashboardShell>
  );
}
