import { prisma } from "@wla/db/client";
import { filterTokens, NONE_TOKEN } from "../../_dashboard-kit/dimension-filters";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import { EXPORT_MAX_ROWS, loadDetail, type EventRow, type PersonRow } from "../_data/detail-queries";
import type { AbsenteeismFilters } from "../_data/filters";
import { loadAbsenteeism } from "../_data/queries";
import type { AbsenteeismData, FilterOption } from "../_data/types";

export type OverviewOk = Extract<AbsenteeismData, { status: "ok" }>;

export interface KpiRow {
  label: string;
  kind: "pct" | "days" | "hours" | "int";
  value: number | null;
  prev: number | null;
  /** Referencia secundaria (promedio 12m, meta, duración promedio...) ya formateada */
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
  events: EventRow[];
  people: PersonRow[];
  truncated: boolean;
}

const fmt1 = (n: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

export async function collectReport(
  tenantId: string,
  filters: AbsenteeismFilters,
  dimensions: Dimension[]
): Promise<Report | null> {
  const overview = await loadAbsenteeism(tenantId, filters, dimensions);
  if (overview.status !== "ok") return null;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } });

  const dp = { page: 1, q: "" } as const;
  const [ev, pe] = [
    await loadDetail(tenantId, filters, dimensions, "eventos", [], dp, { all: true }),
    await loadDetail(tenantId, filters, dimensions, "personas", [], dp, { all: true }),
  ];
  const events = ev.status === "ok" && ev.kind === "events" ? ev : null;
  const people = pe.status === "ok" && pe.kind === "people" ? pe : null;

  const names = (tokens: string[], opts: FilterOption[]) =>
    tokens.length
      ? tokens.map((t) => (t === NONE_TOKEN ? "Sin asignar" : (opts.find((o) => o.value === t)?.label ?? t))).join(", ")
      : "Todos";
  const { period, kpis } = overview;
  const display = { hours: "horas", days: "días", both: "horas y días" }[overview.display];

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
      { label: "Clase de ausencia", value: names(filters.classes, overview.classOptions) },
      { label: "Tipo de ausencia", value: names(filters.types, overview.typeOptions) },
      { label: "Meta de ausentismo", value: `${fmt1(kpis.rate.target)} % mensual` },
      { label: "Formato de ausencias", value: display },
    ],
    kpiRows: [
      {
        label: "Tasa de ausentismo (%)",
        kind: "pct",
        value: kpis.rate.value,
        prev: kpis.rate.prev,
        note: kpis.rate.avg === null ? "" : `Prom. 12m: ${fmt1(kpis.rate.avg)} %`,
      },
      { label: "Ausencia total (días)", kind: "days", value: kpis.absence.cur.days, prev: kpis.absence.prev?.days ?? null, note: "" },
      { label: "Ausencia total (horas)", kind: "hours", value: kpis.absence.cur.hours, prev: kpis.absence.prev?.hours ?? null, note: "" },
      {
        label: "Eventos",
        kind: "int",
        value: kpis.events.value,
        prev: kpis.events.prev,
        note: kpis.events.avgDays === null ? "" : `Duración prom.: ${fmt1(kpis.events.avgDays)} días`,
      },
      {
        label: "Personas afectadas",
        kind: "int",
        value: kpis.people.value,
        prev: kpis.people.prev,
        note: kpis.people.pct === null ? "" : `${fmt1(kpis.people.pct)} % de la dotación (${kpis.people.exposed})`,
      },
    ],
    events: events?.rows ?? [],
    people: people?.rows ?? [],
    truncated: (events?.total ?? 0) > EXPORT_MAX_ROWS || (people?.total ?? 0) > EXPORT_MAX_ROWS,
  };
}

export const NOTES = [
  "Tasa de ausentismo = horas de ausencia ÷ horas programadas. En períodos de varios meses se suman las horas.",
  "Las horas programadas salen del turno de cada persona mientras estuvo activa; sin turno se usa el horario de la empresa. No se descuentan feriados.",
  "Solo cuentan los tipos de ausencia marcados como ausentismo y los eventos no cancelados. La unidad de cada persona es la vigente cada día.",
  "Los listados de eventos y personas muestran las horas y los días dentro del período y de los filtros aplicados. No incluyen observaciones.",
];
