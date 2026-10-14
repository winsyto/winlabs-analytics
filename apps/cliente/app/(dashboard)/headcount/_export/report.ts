import { prisma } from "@wla/db/client";
import { loadDetail, EXPORT_MAX_ROWS, type PersonRow } from "../_data/detail-queries";
import type { Dimension } from "../_data/dimensions";
import { filterTokens, NONE_TOKEN, type HeadcountFilters } from "../_data/filters";
import { loadHeadcount } from "../_data/queries";
import type { FilterOption, HeadcountData } from "../_data/types";

export type OverviewOk = Extract<HeadcountData, { status: "ok" }>;

export interface Report {
  tenantName: string;
  tenantSlug: string;
  exportedAt: string;
  overview: OverviewOk;
  dimensions: Dimension[];
  filterLines: { label: string; value: string }[];
  kpiRows: { label: string; value: number | null; prev: number | null; avg: number | null; avgLabel: string; signed?: boolean }[];
  activos: PersonRow[];
  altas: PersonRow[];
  bajas: PersonRow[];
  truncated: boolean;
}

export async function collectReport(
  tenantId: string,
  filters: HeadcountFilters,
  dimensions: Dimension[]
): Promise<Report | null> {
  const overview = await loadHeadcount(tenantId, filters, dimensions);
  if (overview.status !== "ok") return null;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true },
  });

  const dp = { page: 1, q: "", s: "name", d: "asc" } as const;
  const rowsOf = async (scope: "activos" | "altas" | "bajas") => {
    const d = await loadDetail(tenantId, filters, dimensions, scope, [], dp, { all: true });
    return d.status === "ok" ? { rows: d.rows, total: d.total } : { rows: [], total: 0 };
  };
  const [activos, altas, bajas] = [await rowsOf("activos"), await rowsOf("altas"), await rowsOf("bajas")];

  const names = (tokens: string[], opts: FilterOption[]) =>
    tokens.length
      ? tokens
          .map((t) => (t === NONE_TOKEN ? "Sin asignar" : (opts.find((o) => o.value === t)?.label ?? t)))
          .join(", ")
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
    ],
    kpiRows: [
      { label: "Headcount al cierre", ...kpis.headcount },
      { label: "Altas del período", ...kpis.altas },
      { label: "Bajas del período", ...kpis.bajas },
      { label: "Variación neta (altas − bajas)", ...kpis.neta, signed: true },
    ],
    activos: activos.rows,
    altas: altas.rows,
    bajas: bajas.rows,
    truncated: [activos, altas, bajas].some((r) => r.total > EXPORT_MAX_ROWS),
  };
}

export const NOTES = [
  "Altas y bajas se calculan por fecha de ingreso y egreso.",
  "Las unidades organizativas de cada persona corresponden a las vigentes en la fecha de referencia de cada listado: cierre del mes (activos), fecha de ingreso (altas) y fecha de baja (bajas).",
];
