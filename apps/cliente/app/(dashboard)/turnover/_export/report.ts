import { prisma } from "@wla/db/client";
import { filterTokens, NONE_TOKEN } from "../../_dashboard-kit/dimension-filters";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import { fmtTenure } from "../../_dashboard-kit/format";
import { EXPORT_MAX_ROWS, loadDetail, type BajaRow } from "../_data/detail-queries";
import type { TurnoverFilters } from "../_data/filters";
import { loadTurnover } from "../_data/queries";
import type { FilterOption, TurnoverData } from "../_data/types";

export type OverviewOk = Extract<TurnoverData, { status: "ok" }>;

export interface KpiRow {
  label: string;
  kind: "pct" | "int";
  value: number | null;
  prev: number | null;
  /** Referencia secundaria (promedio 12m, meta, % de las bajas...) ya formateada */
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
  bajas: BajaRow[];
  truncated: boolean;
}

const fmt1 = (n: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

export async function collectReport(
  tenantId: string,
  filters: TurnoverFilters,
  dimensions: Dimension[]
): Promise<Report | null> {
  const overview = await loadTurnover(tenantId, filters, dimensions);
  if (overview.status !== "ok") return null;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } });
  const detail = await loadDetail(tenantId, filters, dimensions, "bajas", [], { page: 1, q: "" }, { all: true });
  const bajas = detail.status === "ok" ? detail : null;

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
      { label: "Categoría de baja", value: names(filters.categories, overview.categoryOptions) },
      { label: "Motivo de baja", value: names(filters.reasons, overview.reasonOptions) },
      { label: "Meta de rotación", value: `${fmt1(kpis.rate.annualTarget)} % anual (${fmt1(kpis.rate.target)} % para este período)` },
    ],
    kpiRows: [
      {
        label: "Rotación (%)",
        kind: "pct",
        value: kpis.rate.value,
        prev: kpis.rate.prev,
        note: kpis.rate.avg === null ? "" : `Prom. 12m: ${fmt1(kpis.rate.avg)} %`,
      },
      {
        label: "Rotación voluntaria (%)",
        kind: "pct",
        value: kpis.voluntary.value,
        prev: kpis.voluntary.prev,
        note: kpis.voluntary.avg === null ? "" : `Prom. 12m: ${fmt1(kpis.voluntary.avg)} %`,
      },
      {
        label: "Bajas",
        kind: "int",
        value: kpis.bajas.value,
        prev: kpis.bajas.prev,
        note: kpis.bajas.byCategory.map((c) => `${c.label} ${c.count}`).join(" · "),
      },
      {
        label: "Bajas tempranas (menos de 1 año)",
        kind: "int",
        value: kpis.early.value,
        prev: kpis.early.prev,
        note: [
          kpis.early.pct === null ? "" : `${fmt1(kpis.early.pct)} % de las bajas`,
          kpis.early.avgTenureMonths === null ? "" : `antigüedad prom. al salir: ${fmtTenure(Math.round(kpis.early.avgTenureMonths))}`,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    ],
    bajas: bajas?.rows ?? [],
    truncated: (bajas?.total ?? 0) > EXPORT_MAX_ROWS,
  };
}

export const NOTES = [
  "Rotación = bajas ÷ headcount promedio. El headcount promedio es el promedio de los cierres mensuales del período más el cierre de apertura (el del mes anterior). En períodos de varios meses se suman las bajas.",
  "Entran todas las bajas (voluntaria, involuntaria, fin de contrato, jubilación y otra); la rotación voluntaria cuenta solo las de categoría voluntaria. Los filtros por categoría y motivo afectan solo a las bajas.",
  "La meta del tenant es anual y se prorratea al período. Cada baja cuenta en la unidad vigente en la fecha de la baja; el headcount, en las unidades del cierre.",
  "Bajas tempranas: menos de 12 meses de antigüedad entre el ingreso y la baja. El primer cierre mensual no tiene apertura: su mes figura como sin datos.",
];
