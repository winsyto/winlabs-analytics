import { prisma } from "@wla/db/client";
import { filterTokens, NONE_TOKEN } from "../../_dashboard-kit/dimension-filters";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import { loadConceptDetail, type ConceptData } from "../_data/concept-queries";
import type { PayrollFilters } from "../_data/filters";

export type ConceptOk = Extract<ConceptData, { status: "ok" }>;

export interface ConceptKpiRow {
  label: string;
  /** money = importe en la moneda del tenant; number = cantidad o personas; pct = porcentaje */
  kind: "money" | "number" | "pct";
  value: number | null;
  prev: number | null;
  note: string;
}

export interface ConceptReport {
  tenantName: string;
  tenantSlug: string;
  exportedAt: string;
  data: ConceptOk;
  filterLines: { label: string; value: string }[];
  kpiRows: ConceptKpiRow[];
}

const fmt1 = (n: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

export async function collectConceptReport(
  tenantId: string,
  filters: PayrollFilters,
  dimensions: Dimension[],
  conceptId: number | null
): Promise<ConceptReport | null> {
  const data = await loadConceptDetail(tenantId, filters, dimensions, conceptId, { admin: false });
  if (data.status !== "ok") return null;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } });
  const names = (tokens: string[], opts: { value: string; label: string }[]) =>
    tokens.length ? tokens.map((t) => (t === NONE_TOKEN ? "Sin asignar" : (opts.find((o) => o.value === t)?.label ?? t))).join(", ") : "Todos";
  const { period, currency, detail } = data;
  const k = detail?.kpis;

  return {
    tenantName: tenant?.name ?? "",
    tenantSlug: tenant?.slug ?? "tenant",
    exportedAt: new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()),
    data,
    filterLines: [
      { label: "Concepto", value: detail ? `${detail.concept.code} · ${detail.concept.name}` : "Todos (cuadro de conceptos)" },
      { label: "Período", value: `${period.label} (comparado ${period.compareLabel})` },
      { label: "Moneda", value: currency },
      ...data.dimensionOptions.map((d) => ({ label: d.name, value: names(filterTokens(filters.dims[d.code]), d.options) })),
    ],
    kpiRows: k
      ? [
          { label: "Importe del período", kind: "money", value: k.amount.value, prev: k.amount.prev, note: "con el signo de origen" },
          { label: "Personas por mes (promedio)", kind: "number", value: k.persons.value, prev: k.persons.prev, note: "" },
          { label: "Importe medio por persona (mensual)", kind: "money", value: k.perPerson.value, prev: k.perPerson.prev, note: "" },
          ...(k.quantity.hasQuantity
            ? [{ label: "Cantidad pagada", kind: "number" as const, value: k.quantity.value, prev: k.quantity.prev, note: k.perUnit === null ? "" : `${k.perUnit.toFixed(2)} por unidad` }]
            : []),
          ...(k.pctClass !== null ? [{ label: "Peso en su clase (%)", kind: "pct" as const, value: k.pctClass, prev: null, note: "" }] : []),
          ...(k.pctGross !== null ? [{ label: "Peso sobre la masa bruta (%)", kind: "pct" as const, value: k.pctGross, prev: null, note: `${fmt1(k.pctGross)} %` }] : []),
        ]
      : [],
  };
}

export const CONCEPT_NOTES = [
  "Importes pagados en cada período, tal como vienen de la liquidación (wlA no recalcula nada), con el signo de origen. Los períodos sin liquidación figuran como sin datos.",
  "Importe medio por persona = importe ÷ personas-mes que lo cobraron. El % de la clase y de la masa bruta es del período actual.",
  "Las celdas con menos de 3 personas se reservan por privacidad. La unidad de cada persona es la vigente al fin del mes liquidado. No se exporta el importe por persona.",
];
