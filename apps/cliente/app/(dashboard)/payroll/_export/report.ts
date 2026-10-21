import { prisma } from "@wla/db/client";
import { filterTokens, NONE_TOKEN } from "../../_dashboard-kit/dimension-filters";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import { loadDetail, type ProcessRow } from "../_data/detail-queries";
import type { PayrollFilters } from "../_data/filters";
import { loadPayroll } from "../_data/queries";
import type { FilterOption, PayrollData } from "../_data/types";

export type OverviewOk = Extract<PayrollData, { status: "ok" }>;

export interface KpiRow {
  label: string;
  kind: "money";
  value: number | null;
  prev: number | null;
  /** Referencia secundaria (promedio 12m, % sobre sueldo...) ya formateada */
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
  processes: ProcessRow[];
}

const fmt1 = (n: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);
  }
};

export async function collectReport(tenantId: string, filters: PayrollFilters, dimensions: Dimension[]): Promise<Report | null> {
  const overview = await loadPayroll(tenantId, filters, dimensions);
  if (overview.status !== "ok") return null;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } });
  const detail = overview.restricted ? null : await loadDetail(tenantId, filters, dimensions, "procesos", [], { page: 1, q: "" });
  const processes = detail && detail.status === "ok" && detail.kind === "procesos" ? detail.rows : [];

  const names = (tokens: string[], opts: FilterOption[]) =>
    tokens.length
      ? tokens.map((t) => (t === NONE_TOKEN ? "Sin asignar" : (opts.find((o) => o.value === t)?.label ?? t))).join(", ")
      : "Todos";
  const { period, kpis, currency } = overview;

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
      { label: "Moneda", value: currency },
      ...overview.dimensions.map((d) => ({ label: d.name, value: names(filterTokens(filters.dims[d.code]), d.options) })),
    ],
    kpiRows: [
      {
        label: "Masa salarial bruta",
        kind: "money",
        value: kpis.gross.value,
        prev: kpis.gross.prev,
        note: [kpis.gross.avg === null ? "" : `Prom. 12m: ${money(kpis.gross.avg, currency)}`, kpis.gross.viaClasses ? "suma de las clases de haber" : ""]
          .filter(Boolean)
          .join(" · "),
      },
      {
        label: "Costo medio por persona (mensual)",
        kind: "money",
        value: kpis.perPerson.value,
        prev: kpis.perPerson.prev,
        note: [
          kpis.perPerson.avg === null ? "" : `Prom. 12m: ${money(kpis.perPerson.avg, currency)}`,
          kpis.perPerson.avgPersons === null ? "" : `${fmt1(kpis.perPerson.avgPersons)} personas pagadas por mes`,
        ]
          .filter(Boolean)
          .join(" · "),
      },
      {
        label: "Neto pagado",
        kind: "money",
        value: kpis.net.value,
        prev: kpis.net.prev,
        note: overview.freshness.missingNet ? "falta marcar el total neto" : "",
      },
      {
        label: "Costo de horas extra",
        kind: "money",
        value: kpis.overtime.value,
        prev: kpis.overtime.prev,
        note: kpis.overtime.pctOfSalary === null ? "" : `${fmt1(kpis.overtime.pctOfSalary)} % sobre el sueldo básico`,
      },
    ],
    processes,
  };
}

export const NOTES = [
  "Importes pagados en cada período, tal como vienen de la liquidación (wlA no recalcula nada). La masa bruta es el concepto marcado como total bruto o, si no hay, la suma de las clases de haber; incluye todos los procesos del período (mensual, SAC, ajustes...).",
  "Costo medio por persona = masa bruta ÷ personas-mes pagadas. Costo de horas extra = importe de la clase Horas extra; el % es sobre la clase Sueldo.",
  "Las retenciones se muestran en valor absoluto. Los % de la composición son sobre el total de haberes de las clases. Los conceptos sin clasificar figuran aparte.",
  "Las celdas con menos de 3 personas se reservan por privacidad. La unidad de cada persona es la vigente al fin del mes liquidado.",
  "Los importes corresponden a lo pagado en cada mes: si el cliente paga horas extra o ausencias a mes vencido, no coinciden con las horas del mismo mes en los otros dashboards.",
];
