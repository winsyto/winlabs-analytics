import { withTenantContext } from "@wla/auth";
import { Prisma } from "@wla/db";
import type { Dimension } from "./dimensions";
import type { HeadcountFilters } from "./filters";
import { addMonths, buildPeriod, monthEnd } from "./period";
import type { DimensionData, DistItem, HeadcountData, KpiValue, SeriesPoint } from "./types";

export const SNAP_ARR = Prisma.raw(
  "CASE WHEN jsonb_typeof(h.org_assignments_snapshot) = 'array' THEN h.org_assignments_snapshot ELSE '[]'::jsonb END"
);

/** Une condiciones con OR y las envuelve para usarlas como `AND (...)`. */
const orGroup = (conds: Prisma.Sql[]): Prisma.Sql => Prisma.sql`AND (${Prisma.join(conds, " OR ")})`;

/**
 * Filtros sobre hr_people_history (alias h). Entre dimensiones AND; dentro de una dimensión OR
 * (unidades elegidas y/o "Sin asignar" = sin ninguna unidad de ese tipo). Usa las unidades del cierre.
 */
export function snapFilter(f: HeadcountFilters): Prisma.Sql {
  const parts = Object.entries(f.dims).map(([type, sel]) => {
    const conds: Prisma.Sql[] = [];
    if (sel.ids.length) {
      conds.push(Prisma.sql`EXISTS (
        SELECT 1 FROM jsonb_array_elements(${SNAP_ARR}) fe
        WHERE fe->>'orgUnitTypeCode' = ${type} AND (fe->>'orgUnitId')::int IN (${Prisma.join(sel.ids)}))`);
    }
    if (sel.none) {
      conds.push(Prisma.sql`NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(${SNAP_ARR}) fe WHERE fe->>'orgUnitTypeCode' = ${type})`);
    }
    return conds.length ? orGroup(conds) : Prisma.empty;
  });
  return parts.length ? Prisma.join(parts, " ") : Prisma.empty;
}

/**
 * Filtros para altas y bajas sobre hr_people (alias p): la unidad se evalúa vigente en la fecha del evento
 * (fecha de ingreso para altas, fecha de baja para bajas). "Sin asignar" = sin unidad de ese tipo vigente ese día.
 */
export function eventFilter(f: HeadcountFilters, dateCol: "p.hire_date" | "p.termination_date"): Prisma.Sql {
  const col = Prisma.raw(dateCol);
  const parts = Object.entries(f.dims).map(([type, sel]) => {
    const conds: Prisma.Sql[] = [];
    if (sel.ids.length) {
      conds.push(Prisma.sql`EXISTS (
        SELECT 1 FROM hr_people_org_assignments fa
        WHERE fa.person_id = p.id
          AND fa.org_unit_type_code = ${type}
          AND fa.org_unit_id IN (${Prisma.join(sel.ids)})
          AND fa.valid_from <= ${col}
          AND (fa.valid_to IS NULL OR fa.valid_to >= ${col}))`);
    }
    if (sel.none) {
      conds.push(Prisma.sql`NOT EXISTS (
        SELECT 1 FROM hr_people_org_assignments fa
        WHERE fa.person_id = p.id
          AND fa.org_unit_type_code = ${type}
          AND fa.valid_from <= ${col}
          AND (fa.valid_to IS NULL OR fa.valid_to >= ${col}))`);
    }
    return conds.length ? orGroup(conds) : Prisma.empty;
  });
  return parts.length ? Prisma.join(parts, " ") : Prisma.empty;
}

const sumRange = (map: Map<string, number>, from: string, to: string) => {
  let total = 0;
  for (const [k, v] of map) if (k >= from && k <= to) total += v;
  return total;
};

const monthDiff = (a: string, b: string) =>
  (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));

export async function loadHeadcount(
  tenantId: string,
  filters: HeadcountFilters,
  dimensions: Dimension[]
): Promise<HeadcountData> {
  return withTenantContext(tenantId, async (tx) => {
    const cov = await tx.$queryRaw<{ month: string }[]>`
      SELECT DISTINCT to_char(snapshot_date, 'YYYY-MM-DD') AS month
      FROM hr_people_history
      WHERE tenant_id = ${tenantId}::uuid
      ORDER BY 1`;
    if (cov.length === 0) return { status: "empty" } as const;

    const covered = new Set(cov.map((r) => r.month));
    const firstMonth = cov[0]!.month;
    const refMonth = cov[cov.length - 1]!.month;
    const from = addMonths(refMonth, -23);
    const to = monthEnd(refMonth);
    const period = buildPeriod(filters.p, refMonth);

    const [headcountRows, altasRows, bajasRows] = await Promise.all([
      tx.$queryRaw<{ m: string; n: number }[]>(Prisma.sql`
        SELECT to_char(h.snapshot_date, 'YYYY-MM-DD') AS m, count(*)::int AS n
        FROM hr_people_history h
        WHERE h.tenant_id = ${tenantId}::uuid
          AND h.snapshot_date BETWEEN ${from}::date AND ${refMonth}::date
          ${snapFilter(filters)}
        GROUP BY 1`),
      flowQuery(tx, tenantId, "p.hire_date", from, to, filters),
      flowQuery(tx, tenantId, "p.termination_date", from, to, filters),
    ]);

    const hcMap = new Map(headcountRows.map((r) => [r.m, r.n]));
    const altasMap = new Map(altasRows.map((r) => [r.m, r.n]));
    const bajasMap = new Map(bajasRows.map((r) => [r.m, r.n]));
    const headcountAt = (m: string) => (covered.has(m) ? (hcMap.get(m) ?? 0) : null);

    const last12 = Array.from({ length: 12 }, (_, i) => addMonths(refMonth, i - 11));
    const coveredLast12 = last12.filter((m) => covered.has(m));
    const hcAvg =
      coveredLast12.length >= 6
        ? coveredLast12.reduce((s, m) => s + (hcMap.get(m) ?? 0), 0) / coveredLast12.length
        : null;

    const prevCovered = period.prevStart >= firstMonth;
    const fullYearCovered = last12[0]! >= firstMonth;
    const isMonth = period.key === "month";

    const flowKpi = (map: Map<string, number>): KpiValue => {
      const value = sumRange(map, period.start, refMonth);
      return {
        value,
        prev: prevCovered ? sumRange(map, period.prevStart, period.prevRefMonth) : null,
        avg: isMonth
          ? fullYearCovered
            ? sumRange(map, last12[0]!, refMonth) / 12
            : null
          : value / period.months,
        avgLabel: isMonth ? "Prom. 12m" : "Por mes",
      };
    };

    const altas = flowKpi(altasMap);
    const bajas = flowKpi(bajasMap);
    const neta: KpiValue = {
      value: altas.value! - bajas.value!,
      prev: altas.prev !== null && bajas.prev !== null ? altas.prev - bajas.prev : null,
      avg: altas.avg !== null && bajas.avg !== null ? altas.avg - bajas.avg : null,
      avgLabel: altas.avgLabel,
    };
    const headcount: KpiValue = {
      value: headcountAt(refMonth),
      prev: headcountAt(period.prevRefMonth),
      avg: hcAvg,
      avgLabel: "Prom. 12m",
    };

    const series: SeriesPoint[] = last12.map((m) => ({
      month: m,
      headcount: headcountAt(m),
      altas: altasMap.get(m) ?? 0,
      bajas: bajasMap.get(m) ?? 0,
    }));

    const total = headcount.value ?? 0;
    const codes = dimensions.map((d) => d.code);
    const [distributions, units] = await Promise.all([
      Promise.all(dimensions.map((d) => orgDistribution(tx, tenantId, d.code, refMonth, filters, total))),
      codes.length
        ? tx.hrOrgUnit.findMany({
            where: { tenantId, isActive: true, deletedAt: null, orgUnitTypeCode: { in: codes } },
            select: { id: true, name: true, orgUnitTypeCode: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
    ]);

    const dimensionData: DimensionData[] = dimensions.map((d, i) => ({
      code: d.code,
      name: d.name,
      slug: d.slug,
      items: distributions[i]!,
      options: units
        .filter((u) => u.orgUnitTypeCode === d.code)
        .map((u) => ({ value: String(u.id), label: u.name })),
    }));

    const staleDays = Math.floor((Date.now() - Date.parse(`${to}T00:00:00Z`)) / 86400000);

    return {
      status: "ok",
      period,
      filters,
      kpis: { headcount, altas, bajas, neta },
      series,
      dimensions: dimensionData,
      freshness: {
        refMonth,
        firstMonth,
        staleDays,
        isStale: staleDays > 45,
        hasGaps: monthDiff(firstMonth, refMonth) + 1 !== covered.size,
        comparisonAvailable: prevCovered && headcount.prev !== null,
      },
    } as const;
  });
}

function flowQuery(
  tx: Prisma.TransactionClient,
  tenantId: string,
  col: "p.hire_date" | "p.termination_date",
  from: string,
  to: string,
  filters: HeadcountFilters
) {
  const c = Prisma.raw(col);
  return tx.$queryRaw<{ m: string; n: number }[]>(Prisma.sql`
    SELECT to_char(date_trunc('month', ${c}), 'YYYY-MM-DD') AS m, count(*)::int AS n
    FROM hr_people p
    WHERE p.tenant_id = ${tenantId}::uuid
      AND p.deleted_at IS NULL
      AND ${c} BETWEEN ${from}::date AND ${to}::date
      ${eventFilter(filters, col)}
    GROUP BY 1`);
}

async function orgDistribution(
  tx: Prisma.TransactionClient,
  tenantId: string,
  type: string,
  refMonth: string,
  filters: HeadcountFilters,
  total: number
): Promise<DistItem[]> {
  const rows = await tx.$queryRaw<{ key: string; label: string; value: number }[]>(Prisma.sql`
    SELECT ou.id::text AS key, ou.name AS label, count(DISTINCT h.person_id)::int AS value
    FROM hr_people_history h
    CROSS JOIN LATERAL jsonb_array_elements(${SNAP_ARR}) AS e
    JOIN hr_org_units ou
      ON ou.id = (e->>'orgUnitId')::int AND ou.org_unit_type_code = ${type}
    WHERE h.tenant_id = ${tenantId}::uuid
      AND h.snapshot_date = ${refMonth}::date
      ${snapFilter(filters)}
    GROUP BY ou.id, ou.name
    ORDER BY value DESC, ou.name`);
  const assigned = rows.reduce((s, r) => s + r.value, 0);
  if (total > assigned) rows.push({ key: "none", label: "Sin asignar", value: total - assigned });
  return rows;
}
