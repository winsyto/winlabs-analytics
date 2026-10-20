import { withTenantContext } from "@wla/auth";
import { METRIC_TARGET_DEFAULTS, Prisma } from "@wla/db";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import { addMonths, buildPeriod, monthEnd } from "../../_dashboard-kit/period";
import { eventFilter, SNAP_ARR, snapFilter } from "../../_dashboard-kit/snapshot-filters";
import { CATEGORY_LABELS, hasActiveFilters, UNSPECIFIED_LABEL, type TurnoverFilters } from "./filters";
import {
  SMALL_SAMPLE,
  type DimensionData,
  type ReasonItem,
  type SeriesPoint,
  type TurnoverData,
  type UnitRateItem,
} from "./types";

export const TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 };

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null);

/** Antigüedad en meses cumplidos entre el ingreso y la baja (p = hr_people). */
export const TENURE_MONTHS = Prisma.sql`(EXTRACT(YEAR FROM age(p.termination_date, p.hire_date)) * 12 + EXTRACT(MONTH FROM age(p.termination_date, p.hire_date)))::int`;

/** Bajas con menos de estos meses de antigüedad son "tempranas" */
export const EARLY_MONTHS = 12;

/** Filtros de categoría y motivo sobre las bajas (usan r = cfg_termination_reasons y p = hr_people). */
export function reasonFilters(f: Pick<TurnoverFilters, "categories" | "reasons">): Prisma.Sql {
  return Prisma.sql`
    ${f.categories.length ? Prisma.sql`AND r.category IN (${Prisma.join(f.categories)})` : Prisma.empty}
    ${f.reasons.length ? Prisma.sql`AND p.termination_reason_code IN (${Prisma.join(f.reasons)})` : Prisma.empty}`;
}

const monthsBetween = (a: string, b: string) =>
  (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));

export interface DataRange {
  /** Último cierre mensual */
  refMonth: string;
  /** Primer cierre mensual */
  firstMonth: string;
  period: ReturnType<typeof buildPeriod>;
  /** Primer mes del período con apertura (cierre del mes anterior) */
  effStart: string;
  /** Cierres mensuales cargados (primer día del mes) */
  covered: Set<string>;
  prevCovered: boolean;
}

/**
 * Cierres mensuales disponibles y rango del período. null = no hay cierres, o hay uno solo (la rotación
 * necesita la apertura de cada mes, es decir, al menos dos cierres consecutivos).
 */
export async function resolveRange(
  tx: Prisma.TransactionClient,
  tenantId: string,
  filters: Pick<TurnoverFilters, "p">
): Promise<{ range: DataRange | null; closings: number }> {
  const cov = await tx.$queryRaw<{ month: string }[]>`
    SELECT DISTINCT to_char(snapshot_date, 'YYYY-MM-DD') AS month
    FROM hr_people_history WHERE tenant_id = ${tenantId}::uuid ORDER BY 1`;
  if (cov.length < 2) return { range: null, closings: cov.length };
  const covered = new Set(cov.map((r) => r.month));
  const firstMonth = cov[0]!.month;
  const refMonth = cov[cov.length - 1]!.month;
  const period = buildPeriod(filters.p, refMonth);
  const firstWithOpening = addMonths(firstMonth, 1);
  const effStart = period.start > firstWithOpening ? period.start : firstWithOpening;
  return {
    closings: cov.length,
    range: {
      refMonth,
      firstMonth,
      period,
      effStart,
      covered,
      prevCovered: addMonths(period.prevStart, -1) >= firstMonth,
    },
  };
}

interface BajaRow { m: string; cat: string | null; reason: string | null; n: number; ten: number; early: number }
interface UnitCount { g: number | null; n: number }

export async function loadTurnover(
  tenantId: string,
  filters: TurnoverFilters,
  dimensions: Dimension[]
): Promise<TurnoverData> {
  return withTenantContext(tenantId, async (tx) => {
    const { range, closings } = await resolveRange(tx, tenantId, filters);
    if (!range) {
      const people = await tx.hrPerson.count({ where: { tenantId, deletedAt: null } });
      return { status: "empty", hasPeople: people > 0, needsHistory: closings === 1 } as const;
    }
    const { refMonth, firstMonth, period, effStart, covered, prevCovered } = range;
    const end = monthEnd(refMonth);
    const f = { dims: filters.dims };

    const [hcRows, altasRows, bajaRows] = await Promise.all([
      tx.$queryRaw<{ m: string; n: number }[]>(Prisma.sql`
        SELECT to_char(h.snapshot_date, 'YYYY-MM-DD') AS m, count(*)::int AS n
        FROM hr_people_history h
        WHERE h.tenant_id = ${tenantId}::uuid
          AND h.snapshot_date BETWEEN ${firstMonth}::date AND ${refMonth}::date
          ${snapFilter(f)}
        GROUP BY 1`),
      tx.$queryRaw<{ m: string; n: number }[]>(Prisma.sql`
        SELECT to_char(date_trunc('month', p.hire_date), 'YYYY-MM-DD') AS m, count(*)::int AS n
        FROM hr_people p
        WHERE p.tenant_id = ${tenantId}::uuid AND p.deleted_at IS NULL
          AND p.hire_date BETWEEN ${firstMonth}::date AND ${end}::date
          ${eventFilter(f, "p.hire_date")}
        GROUP BY 1`),
      tx.$queryRaw<BajaRow[]>(Prisma.sql`
        SELECT to_char(date_trunc('month', p.termination_date), 'YYYY-MM-DD') AS m,
               r.category AS cat, p.termination_reason_code AS reason,
               count(*)::int AS n,
               COALESCE(SUM(${TENURE_MONTHS}), 0)::float8 AS ten,
               (count(*) FILTER (WHERE ${TENURE_MONTHS} < ${EARLY_MONTHS}))::int AS early
        FROM hr_people p
        LEFT JOIN cfg_termination_reasons r ON r.code = p.termination_reason_code
        WHERE p.tenant_id = ${tenantId}::uuid AND p.deleted_at IS NULL
          AND p.termination_date BETWEEN ${firstMonth}::date AND ${end}::date
          ${eventFilter(f, "p.termination_date")}
          ${reasonFilters(filters)}
        GROUP BY 1, 2, 3`),
    ]);

    const hc = new Map(hcRows.map((r) => [r.m, r.n]));
    const altasMap = new Map(altasRows.map((r) => [r.m, r.n]));

    const sumBajas = (from: string, to: string, pick: (r: BajaRow) => number) =>
      bajaRows.reduce((s, r) => (r.m >= from && r.m <= to ? s + pick(r) : s), 0);
    const bajasMonth = (m: string, pick: (r: BajaRow) => number = (r) => r.n) => sumBajas(m, m, pick);

    /** Headcount promedio de los cierres de [from-1 mes, to]. null si falta la apertura o no hay cierres. */
    const avgHeadcount = (from: string, to: string): number | null => {
      const open = addMonths(from, -1);
      if (!covered.has(open)) return null;
      const months = Array.from({ length: monthsBetween(open, to) + 1 }, (_, i) => addMonths(open, i)).filter((m) => covered.has(m));
      if (months.length === 0) return null;
      return months.reduce((s, m) => s + (hc.get(m) ?? 0), 0) / months.length;
    };
    const rateOf = (from: string, to: string, pick: (r: BajaRow) => number = (r) => r.n): number | null => {
      if (from > to) return null;
      const avg = avgHeadcount(from, to);
      return avg === null ? null : pct(sumBajas(from, to, pick), avg);
    };
    const isVoluntary = (r: BajaRow) => (r.cat === "voluntary" ? r.n : 0);

    // ── Meta prorrateada al período ─────────────────────────────────────────
    const target = await tx.cfgTenantMetricTarget.findUnique({
      where: { uq_cfg_tenant_metric_targets: { tenantId, metricCode: "turnover_rate" } },
    });
    const annualTarget = target ? Number(target.targetValue) : METRIC_TARGET_DEFAULTS.turnover_rate.value;
    const months = monthsBetween(effStart, refMonth) + 1;
    const periodTarget = (annualTarget * months) / 12;

    // ── KPIs ────────────────────────────────────────────────────────────────
    const prevFrom = period.prevStart;
    const prevTo = period.prevRefMonth;
    const prevOk = prevCovered;

    // Referencia: tasa de los últimos 12 meses (con al menos 6 meses con apertura), llevada al largo del período
    const last12From = addMonths(refMonth, -11);
    const l12Start = last12From > addMonths(firstMonth, 1) ? last12From : addMonths(firstMonth, 1);
    const l12Months = monthsBetween(l12Start, refMonth) + 1;
    const avg12 = (pick?: (r: BajaRow) => number) => {
      if (filters.p === "12m" || l12Months < 6) return null;
      const r = rateOf(l12Start, refMonth, pick);
      return r === null ? null : (r / l12Months) * months;
    };

    const rateKpi = (pick?: (r: BajaRow) => number) => ({
      value: rateOf(effStart, refMonth, pick),
      prev: prevOk ? rateOf(prevFrom, prevTo, pick) : null,
      avg: avg12(pick),
    });

    const bajasCur = sumBajas(effStart, refMonth, (r) => r.n);
    const bajasPrev = prevOk ? sumBajas(prevFrom, prevTo, (r) => r.n) : null;
    const earlyCur = sumBajas(effStart, refMonth, (r) => r.early);
    const earlyPrev = prevOk ? sumBajas(prevFrom, prevTo, (r) => r.early) : null;
    const tenureSum = sumBajas(effStart, refMonth, (r) => r.ten);

    const catCounts = new Map<string, number>();
    const reasonCounts = new Map<string, number>();
    for (const r of bajaRows) {
      if (r.m < effStart || r.m > refMonth) continue;
      const cat = r.cat && CATEGORY_LABELS[r.cat] ? r.cat : "unspecified";
      catCounts.set(cat, (catCounts.get(cat) ?? 0) + r.n);
      const key = r.reason ?? "unspecified";
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + r.n);
    }

    // ── Evolución de 12 meses ───────────────────────────────────────────────
    const last12 = Array.from({ length: 12 }, (_, i) => addMonths(refMonth, i - 11));
    const series: SeriesPoint[] = last12.map((m) => ({
      month: m,
      rate: m >= addMonths(firstMonth, 1) && covered.has(m) ? rateOf(m, m) : null,
      altas: m >= firstMonth ? (altasMap.get(m) ?? 0) : 0,
      bajas: m >= firstMonth ? bajasMonth(m) : 0,
    }));

    // ── Motivos ─────────────────────────────────────────────────────────────
    const [reasonCatalog, units] = await Promise.all([
      tx.cfgTerminationReason.findMany({ where: { isActive: true }, select: { code: true, name: true, category: true }, orderBy: { name: "asc" } }),
      dimensions.length
        ? tx.hrOrgUnit.findMany({
            where: { tenantId, deletedAt: null, orgUnitTypeCode: { in: dimensions.map((d) => d.code) } },
            select: { id: true, name: true, orgUnitTypeCode: true, isActive: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
    ]);
    const reasonName = new Map(reasonCatalog.map((r) => [r.code, r.name]));
    const toItems = (map: Map<string, number>, label: (k: string) => string): ReasonItem[] =>
      [...map]
        .map(([key, count]) => ({ key, label: label(key), count, share: bajasCur > 0 ? (count / bajasCur) * 100 : 0 }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
    const byCategory = toItems(catCounts, (k) => (k === "unspecified" ? UNSPECIFIED_LABEL : (CATEGORY_LABELS[k] ?? k)));
    const byReason = toItems(reasonCounts, (k) => (k === "unspecified" ? UNSPECIFIED_LABEL : (reasonName.get(k) ?? k)));

    // ── Por dimensión: bajas por la unidad vigente en la fecha de baja ÷ headcount promedio de la unidad ──────────
    const open = addMonths(effStart, -1);
    const closeMonths = Array.from({ length: monthsBetween(open, refMonth) + 1 }, (_, i) => addMonths(open, i)).filter((m) => covered.has(m));
    const nClose = closeMonths.length;
    const totalHcSum = closeMonths.reduce((s, m) => s + (hc.get(m) ?? 0), 0);

    const dimData = await Promise.all(
      dimensions.map(async (d) => {
        const [bajasUnit, hcUnit] = await Promise.all([
          tx.$queryRaw<UnitCount[]>(Prisma.sql`
            SELECT (SELECT a.org_unit_id FROM hr_people_org_assignments a
                    WHERE a.person_id = p.id AND a.org_unit_type_code = ${d.code}
                      AND a.valid_from <= p.termination_date AND (a.valid_to IS NULL OR a.valid_to >= p.termination_date)
                    ORDER BY a.valid_from DESC LIMIT 1) AS g,
                   count(*)::int AS n
            FROM hr_people p
            LEFT JOIN cfg_termination_reasons r ON r.code = p.termination_reason_code
            WHERE p.tenant_id = ${tenantId}::uuid AND p.deleted_at IS NULL
              AND p.termination_date BETWEEN ${effStart}::date AND ${end}::date
              ${eventFilter(f, "p.termination_date")}
              ${reasonFilters(filters)}
            GROUP BY 1`),
          tx.$queryRaw<UnitCount[]>(Prisma.sql`
            SELECT (e->>'orgUnitId')::int AS g, count(*)::int AS n
            FROM hr_people_history h
            CROSS JOIN LATERAL jsonb_array_elements(${SNAP_ARR}) AS e
            WHERE h.tenant_id = ${tenantId}::uuid
              AND h.snapshot_date BETWEEN ${open}::date AND ${refMonth}::date
              AND e->>'orgUnitTypeCode' = ${d.code}
              ${snapFilter(f)}
            GROUP BY 1`),
        ]);
        const bajasBy = new Map(bajasUnit.map((r) => [r.g === null ? "none" : String(r.g), r.n]));
        const hcBy = new Map(hcUnit.map((r) => [String(r.g), r.n]));
        const assigned = hcUnit.reduce((s, r) => s + r.n, 0);
        const noneSum = Math.max(0, totalHcSum - assigned);
        const names = new Map(units.filter((u) => u.orgUnitTypeCode === d.code).map((u) => [String(u.id), u.name]));
        const keys = new Set([...bajasBy.keys(), ...hcBy.keys(), ...(noneSum > 0 ? ["none"] : [])]);
        const items: UnitRateItem[] = [...keys]
          .map((key) => {
            const sum = key === "none" ? noneSum : (hcBy.get(key) ?? 0);
            const avg = nClose > 0 ? sum / nClose : 0;
            const bajas = bajasBy.get(key) ?? 0;
            return {
              key,
              label: key === "none" ? "Sin asignar" : (names.get(key) ?? `Unidad ${key}`),
              rate: pct(bajas, avg),
              bajas,
              avgHeadcount: avg,
              small: avg < SMALL_SAMPLE,
            };
          })
          .filter((i) => i.avgHeadcount > 0 || i.bajas > 0)
          .sort((a, b) => {
            if ((a.key === "none") !== (b.key === "none")) return a.key === "none" ? 1 : -1;
            return (b.rate ?? -1) - (a.rate ?? -1) || a.label.localeCompare(b.label, "es");
          });
        return {
          code: d.code,
          name: d.name,
          slug: d.slug,
          items,
          options: units.filter((u) => u.orgUnitTypeCode === d.code && u.isActive).map((u) => ({ value: String(u.id), label: u.name })),
        } satisfies DimensionData;
      })
    );

    // Alertas: unidades de la primera dimensión con tasa sobre la meta del período (sin "Sin asignar")
    const first = dimData[0];
    const rated = first ? first.items.filter((x) => x.key !== "none" && x.rate !== null) : [];
    const over = first
      ? { count: rated.filter((x) => (x.rate ?? 0) > periodTarget).length, total: rated.length, dimension: first.name }
      : null;

    const rate = rateKpi();
    const staleDays = Math.floor((Date.now() - Date.parse(`${end}T00:00:00Z`)) / 86400000);

    return {
      status: "ok",
      period,
      filters,
      kpis: {
        rate: { ...rate, target: periodTarget, annualTarget, months, over },
        voluntary: rateKpi(isVoluntary),
        bajas: {
          value: bajasCur,
          prev: bajasPrev,
          byCategory: byCategory.map((i) => ({ label: i.label, count: i.count })),
        },
        early: {
          value: earlyCur,
          prev: earlyPrev,
          pct: pct(earlyCur, bajasCur),
          avgTenureMonths: bajasCur > 0 ? tenureSum / bajasCur : null,
        },
      },
      series,
      byCategory,
      byReason,
      dimensions: dimData,
      categoryOptions: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
      reasonOptions: reasonCatalog.map((r) => ({ value: r.code, label: r.name })),
      avgHeadcount: avgHeadcount(effStart, refMonth),
      freshness: {
        refMonth,
        firstMonth,
        staleDays,
        isStale: staleDays > 45,
        partialFrom: period.start < effStart ? effStart : null,
        comparisonAvailable: prevOk && rate.prev !== null,
      },
    } as const;
  }, TX_OPTIONS);
}

export { hasActiveFilters };
