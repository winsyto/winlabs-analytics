import Link from "next/link";
import { ListTree } from "lucide-react";
import { auth } from "@/auth";
import { ChartCard } from "../_dashboard-kit/chart-card";
import { DashboardShell, PendingRegion } from "../_dashboard-kit/dashboard-shell";
import { DashboardEmpty, DashboardNoResults } from "../_dashboard-kit/dashboard-states";
import { filterTokens, NONE_TOKEN } from "../_dashboard-kit/dimension-filters";
import { getDashboardDimensions } from "../_dashboard-kit/dimensions";
import { fmtDec } from "../_dashboard-kit/format";
import { ExportMenu } from "../_dashboard-kit/export-menu";
import { MetricCard } from "../_dashboard-kit/metric-card";
import { CompositionPanel } from "./_components/composition-panel";
import { CostBarsChart, TabbedCostDimensions } from "./_components/cost-bars-chart";
import { EvolutionChart } from "./_components/evolution-chart";
import { fmtMoney, fmtMoneyDiff, fmtShare } from "./_components/format";
import { PayrollFiltersBar } from "./_components/payroll-filters";
import { PayrollFreshness } from "./_components/payroll-freshness";
import { hasActiveFilters, parseFilters } from "./_data/filters";
import { conceptsHref, detailHref, filtersQuery } from "./_data/hrefs";
import { loadPayroll } from "./_data/queries";
import { getCurrentUserRole } from "../settings/_lib/role";
import { MIN_PERSONS } from "./_data/types";

export const metadata = { title: "Payroll" };
const DASHBOARD_CODE = "payroll";

/** Máximo de paneles de dimensión en la segunda fila; si hay más, el último pasa a tener pestañas. */
const MAX_ROW_PANELS = 4;
const COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const tenantId = session!.user.tenantId;
  const dimensions = await getDashboardDimensions(tenantId, DASHBOARD_CODE);
  const filters = parseFilters(await searchParams, dimensions);
  const [data, role] = await Promise.all([loadPayroll(tenantId, filters, dimensions), getCurrentUserRole(tenantId, session!.user.id)]);

  if (data.status === "empty") {
    return (
      <DashboardShell>
        <h1 className="text-lg font-bold text-foreground">Payroll</h1>
        <DashboardEmpty
          title="Todavía no hay liquidaciones"
          text={
            data.hasConcepts
              ? "Hay conceptos cargados pero ninguna liquidación con importes. Cargá el archivo de Liquidaciones desde Integraciones."
              : "Cargá el archivo de Liquidaciones (una fila por persona, proceso y concepto) para ver la masa salarial, su evolución y su composición. Después clasificá los conceptos en Configuración."
          }
        />
      </DashboardShell>
    );
  }

  const { period, kpis, series, composition, freshness, currency, restricted } = data;
  const common = { compareLabel: period.compareLabel };
  const money = (n: number) => fmtMoney(n, currency);
  const diff = (n: number) => fmtMoneyDiff(n, currency);
  const subtitle = period.label;
  const dims = data.dimensions;
  const exportHref = (format: "xlsx" | "pdf") => {
    const q = filtersQuery(filters);
    q.set("format", format);
    return `/payroll/export?${q.toString()}`;
  };
  const panels = dims.length > MAX_ROW_PANELS ? dims.slice(0, MAX_ROW_PANELS - 1) : dims;
  const tabbed = dims.length > MAX_ROW_PANELS ? dims.slice(MAX_ROW_PANELS - 1) : [];
  const rowCols = panels.length + (tabbed.length ? 1 : 0);
  const noResults = hasActiveFilters(filters) && !restricted && (kpis.perPerson.avgPersons ?? 0) === 0;
  const processesHref = detailHref(filters, "procesos");

  return (
    <DashboardShell>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold leading-tight text-foreground">Payroll</h1>
          <p className="text-xs text-muted-foreground">
            {period.label} · comparado {period.compareLabel}
            {!freshness.comparisonAvailable && " (sin comparación: no hay liquidaciones del período anterior)"} · importes en {currency}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PayrollFreshness {...freshness} />
          <Link
            href={conceptsHref(filters)}
            className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            <ListTree className="h-3.5 w-3.5" aria-hidden />
            Detalle por concepto
          </Link>
          <ExportMenu xlsxHref={exportHref("xlsx")} pdfHref={exportHref("pdf")} />
        </div>
      </div>

      <PayrollFiltersBar
        period={filters.p}
        dimensions={dims.map((d) => ({
          code: d.code,
          name: d.name,
          slug: d.slug,
          options: [{ value: NONE_TOKEN, label: "Sin asignar" }, ...d.options],
          selected: filterTokens(filters.dims[d.code]),
        }))}
      />

      {restricted ? (
        <div role="status" className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Con estos filtros hay menos de {MIN_PERSONS} personas pagadas por mes: los importes se reservan por privacidad. Ampliá el período o quitá
          filtros.
        </div>
      ) : noResults ? (
        <DashboardNoResults clearHref={filters.p === "month" ? "/payroll" : `/payroll?p=${filters.p}`} />
      ) : (
        <PendingRegion className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Masa salarial bruta"
              href={processesHref}
              value={kpis.gross.value}
              prev={kpis.gross.prev}
              avg={kpis.gross.avg}
              avgLabel="Prom. 12m"
              formatValue={money}
              formatDiff={diff}
              formatAvg={money}
              {...common}
            >
              {kpis.gross.viaClasses && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Suma de las clases de haber (no hay un total bruto marcado en{" "}
                  <Link href="/settings/payroll-concepts" className="underline">
                    Configuración
                  </Link>
                  )
                </p>
              )}
            </MetricCard>
            <MetricCard
              label="Costo medio por persona"
              href={role === "admin" ? detailHref(filters, "personas") : undefined}
              value={kpis.perPerson.value}
              prev={kpis.perPerson.prev}
              avg={kpis.perPerson.avg}
              avgLabel="Prom. 12m"
              formatValue={money}
              formatDiff={diff}
              formatAvg={money}
              {...common}
            >
              <p className="mt-1 text-[11px] text-muted-foreground">
                Por mes · {kpis.perPerson.avgPersons === null ? "—" : fmtDec(kpis.perPerson.avgPersons)} personas pagadas por mes
              </p>
            </MetricCard>
            <MetricCard
              label="Neto pagado"
              href={kpis.net.value === null ? undefined : processesHref}
              value={kpis.net.value}
              prev={kpis.net.prev}
              avg={null}
              avgLabel=""
              formatValue={money}
              formatDiff={diff}
              {...common}
            >
              {freshness.missingNet && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Marcá el total neto en{" "}
                  <Link href="/settings/payroll-concepts" className="underline">
                    Configuración
                  </Link>
                </p>
              )}
            </MetricCard>
            <MetricCard
              label="Costo de horas extra"
              href={kpis.overtime.classId ? detailHref(filters, "clase", String(kpis.overtime.classId)) : undefined}
              value={kpis.overtime.value}
              prev={kpis.overtime.prev}
              avg={null}
              avgLabel=""
              formatValue={money}
              formatDiff={diff}
              {...common}
            >
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {!kpis.overtime.hasClass
                  ? "No hay una clase de horas extra"
                  : kpis.overtime.pctOfSalary === null
                    ? "Sin sueldo para comparar"
                    : `${fmtShare(kpis.overtime.pctOfSalary)} sobre el sueldo básico`}
              </p>
            </MetricCard>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3">
              <ChartCard title="Evolución de la masa salarial" subtitle="Últimos 12 meses" className="lg:col-span-2">
                <EvolutionChart series={series} currency={currency} hasNet={!freshness.missingNet} />
              </ChartCard>
              <CompositionPanel composition={composition} currency={currency} subtitle={subtitle} />
            </div>

            {rowCols > 0 && (
              <div className={`grid min-h-0 flex-1 grid-cols-1 gap-3 ${COLS[rowCols] ?? "lg:grid-cols-4"}`}>
                {panels.map((d) => (
                  <ChartCard key={d.code} title={`Costo medio por ${d.name.toLowerCase()}`} subtitle={subtitle}>
                    <CostBarsChart dim={d} currency={currency} valueLabel="Costo medio por persona" />
                  </ChartCard>
                ))}
                {tabbed.length > 0 && <TabbedCostDimensions dimensions={tabbed} currency={currency} subtitle={subtitle} valueLabel="Costo medio por persona" />}
              </div>
            )}
          </div>

          <footer className="flex items-start justify-between gap-3 text-[11px] text-muted-foreground">
            <p>
              Importes pagados en cada período, tal como vienen de la liquidación. Los períodos sin liquidación figuran como sin datos. Las celdas con
              menos de {MIN_PERSONS} personas se reservan por privacidad.
            </p>
            <details className="relative shrink-0">
              <summary className="cursor-pointer select-none font-medium text-foreground hover:underline">Cómo se calcula</summary>
              <div className="absolute bottom-6 right-0 z-10 w-[26rem] space-y-1.5 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-md">
                <p>
                  <strong>Masa salarial bruta</strong> = el concepto marcado como total bruto (o, si no hay, la suma de las clases de haber), sumando todos los
                  procesos del período (mensual, SAC, ajustes...). <strong>Neto pagado</strong> = el concepto marcado como total neto.
                </p>
                <p>
                  <strong>Costo medio por persona</strong> = masa bruta ÷ personas-mes pagadas: el costo mensual promedio de quien cobró en el período.
                </p>
                <p>
                  <strong>Costo de horas extra</strong> = importe de la clase «Horas extra»; el % es sobre el importe de la clase «Sueldo».
                </p>
                <p>
                  La composición por clase usa los importes tal como vienen (las retenciones se muestran en valor absoluto); los porcentajes son sobre el total
                  de haberes de las clases. Los conceptos sin clasificar figuran aparte.
                </p>
                <p>La unidad de cada persona es la vigente al fin del mes liquidado.</p>
                <p>
                  Los importes corresponden a lo <em>pagado</em> en cada mes: si el cliente paga horas extra o ausencias a mes vencido, no coinciden con las
                  horas del mismo mes en los otros dashboards.
                </p>
              </div>
            </details>
          </footer>
        </PendingRegion>
      )}
    </DashboardShell>
  );
}
