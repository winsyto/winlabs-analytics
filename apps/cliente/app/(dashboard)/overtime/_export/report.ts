import { prisma } from "@wla/db/client";
import { filterTokens, NONE_TOKEN } from "../../_dashboard-kit/dimension-filters";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import { EXPORT_MAX_ROWS, loadDetail, type HoursRow, type PersonRow } from "../_data/detail-queries";
import type { OvertimeFilters } from "../_data/filters";
import { loadOvertime } from "../_data/queries";
import type { FilterOption, OvertimeData } from "../_data/types";

export type OverviewOk = Extract<OvertimeData, { status: "ok" }>;

export interface KpiRow {
  label: string;
  kind: "pct" | "hours" | "int";
  value: number | null;
  prev: number | null;
  /** Referencia secundaria (promedio 12m, % de las personas...) ya formateada */
  note: string;
}

export interface Report {
  tenantName: string;
  tenantSlug: string;
  exportedAt: string;
  overview: OverviewOk;
  dimensions: Dimension[];
  filterLines: { label: string; value: string }[];
  kpiRows: KpiRow[];
  hours: HoursRow[];
  people: PersonRow[];
  truncated: boolean;
}

const fmt1 = (n: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

export async function collectReport(
  tenantId: string,
  filters: OvertimeFilters,
  dimensions: Dimension[]
): Promise<Report | null> {
  const overview = await loadOvertime(tenantId, filters, dimensions);
  if (overview.status !== "ok") return null;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } });

  const dp = { page: 1, q: "" } as const;
  const [ho, pe] = [
    await loadDetail(tenantId, filters, dimensions, "horas", [], dp, { all: true }),
    await loadDetail(tenantId, filters, dimensions, "personas", [], dp, { all: true }),
  ];
  const hours = ho.status === "ok" && ho.kind === "hours" ? ho : null;
  const people = pe.status === "ok" && pe.kind === "people" ? pe : null;

  const names = (tokens: string[], opts: FilterOption[]) =>
    tokens.length
      ? tokens.map((t) => (t === NONE_TOKEN ? "Sin asignar" : (opts.find((o) => o.value === t)?.label ?? t))).join(", ")
      : "Todos";
  const { period, kpis } = overview;

  return {
    tenantName: tenant?.name ?? "",
    tenantSlug: tenant?.slug ?? "tenant",
    exportedAt: new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date()),
    overview,
    dimensions,
    filterLines: [
      { label: "Período", value: `${period.label} (comparado ${period.compareLabel})` },
      ...overview.dimensions.map((d) => ({ label: d.name, value: names(filterTokens(filters.dims[d.code]), d.options) })),
      { label: "Tipo de hora", value: names(filters.types, overview.typeOptions) },
      { label: "Meta de horas extra", value: `${fmt1(kpis.rate.target)} % mensual` },
      { label: "Base de la tasa", value: overview.base === "worked" ? "horas trabajadas" : "horas programadas" },
    ],
    kpiRows: [
      {
        label: "Tasa de horas extra (%)",
        kind: "pct",
        value: kpis.rate.value,
        prev: kpis.rate.prev,
        note: kpis.rate.avg === null ? "" : `Prom. 12m: ${fmt1(kpis.rate.avg)} %`,
      },
      { label: "Horas extra (horas)", kind: "hours", value: kpis.hours.value, prev: kpis.hours.prev, note: "" },
      {
        label: "Personas con horas extra",
        kind: "int",
        value: kpis.people.value,
        prev: kpis.people.prev,
        note: kpis.people.pct === null ? "" : `${fmt1(kpis.people.pct)} % de las personas con horas informadas (${kpis.people.covered})`,
      },
      { label: "Horas extra por persona (horas)", kind: "hours", value: kpis.perPerson.value, prev: kpis.perPerson.prev, note: "Entre quienes hicieron horas extra" },
    ],
    hours: hours?.rows ?? [],
    people: people?.rows ?? [],
    truncated: (hours?.total ?? 0) > EXPORT_MAX_ROWS || (people?.total ?? 0) > EXPORT_MAX_ROWS,
  };
}

export const NOTES = [
  "Tasa de horas extra = horas extra ÷ horas programadas (o trabajadas, según la configuración de la empresa). En períodos de varios meses se suman las horas.",
  "Entran en el denominador solo las personas con horas informadas en ese mes. Las horas programadas salen del turno de cada persona; sin turno se usa el horario de la empresa. No se descuentan feriados.",
  "Las horas extra son las de los tipos de categoría «Hora extra»; cada hora cuenta en la unidad que la persona tenía ese día. Las horas extra no autorizadas no entran en ninguna tasa y se informan aparte.",
  "Los listados muestran las horas dentro del período y de los filtros aplicados.",
];
