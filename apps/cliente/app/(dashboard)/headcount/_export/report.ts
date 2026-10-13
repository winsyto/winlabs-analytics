import { prisma } from "@wla/db/client";
import { loadDetail, EXPORT_MAX_ROWS, type PersonRow } from "../_data/detail-queries";
import type { HeadcountFilters } from "../_data/filters";
import { loadHeadcount } from "../_data/queries";
import type { HeadcountData } from "../_data/types";

export type OverviewOk = Extract<HeadcountData, { status: "ok" }>;

export interface Report {
  tenantName: string;
  tenantSlug: string;
  exportedAt: string;
  overview: OverviewOk;
  filterLines: { label: string; value: string }[];
  kpiRows: { label: string; value: number | null; prev: number | null; avg: number | null; avgLabel: string; signed?: boolean }[];
  activos: PersonRow[];
  altas: PersonRow[];
  bajas: PersonRow[];
  truncated: boolean;
}

export const CONTRACT_LABELS: Record<string, string> = {
  indefinido: "Indefinido",
  plazo_fijo: "Plazo fijo",
  temporal: "Temporal",
  contractor: "Contratista",
};

export async function collectReport(
  tenantId: string,
  filters: HeadcountFilters
): Promise<Report | null> {
  const overview = await loadHeadcount(tenantId, filters);
  if (overview.status !== "ok") return null;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true },
  });

  const dp = { page: 1, q: "", s: "name", d: "asc" } as const;
  const rowsOf = async (scope: "activos" | "altas" | "bajas") => {
    const d = await loadDetail(tenantId, filters, scope, undefined, dp, { all: true });
    return d.status === "ok" ? { rows: d.rows, total: d.total } : { rows: [], total: 0 };
  };
  const [activos, altas, bajas] = [await rowsOf("activos"), await rowsOf("altas"), await rowsOf("bajas")];

  const names = (ids: (string | number)[], opts: { value: string; label: string }[]) =>
    ids.length ? ids.map((id) => opts.find((o) => o.value === String(id))?.label ?? String(id)).join(", ") : "Todos";
  const { options, period } = overview;

  const { kpis } = overview;
  return {
    tenantName: tenant?.name ?? "",
    tenantSlug: tenant?.slug ?? "tenant",
    exportedAt: new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date()),
    overview,
    filterLines: [
      { label: "Período", value: `${period.label} (comparado ${period.compareLabel})` },
      { label: "Área", value: names(filters.area, options.areas) },
      { label: "Sede", value: names(filters.loc, options.locations) },
      { label: "Cargo", value: names(filters.pos, options.positions) },
      { label: "Contrato", value: names(filters.ct, options.contracts) },
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
  "Área, sede y cargo corresponden a la asignación actual de cada persona.",
  "El tipo de contrato corresponde al contrato actual de cada persona.",
];
