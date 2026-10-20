import { withTenantContext } from "@wla/auth";
import { METRIC_TARGET_DEFAULTS, Prisma } from "@wla/db";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import { addMonths, buildPeriod, lastClosedMonth, monthEnd } from "../../_dashboard-kit/period";
import { engineCtes } from "./engine";
import { CLASS_LABELS, hasActiveFilters, type AbsenteeismFilters } from "./filters";
import {
  SMALL_SAMPLE,
  type AbsenceDisplay,
  type AbsenteeismData,
  type Amount,
  type BreakdownItem,
  type DimensionData,
  type UnitRateItem,
} from "./types";

/** El motor trabaja sobre todo el historial: las consultas pesadas necesitan más que los 5 s por defecto. */
const TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 };

export { lastClosedMonth };

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null);

interface MonthRow { m: string; sched: number; h: number; d: number }
interface DistinctRow { ev_cur: number; ev_prev: number; ppl_cur: number; ppl_prev: number; exp_cur: number; exp_prev: number }
interface BreakRow { class: string; type_code: string; h: number; d: number; ev: number }
interface ExclRow { class: string; h: number; d: number; ev: number }
interface DimRow { g: number | null; sched: number; people: number; h: number; d: number }
interface EngineResult {
  monthly: MonthRow[];
  distinct: DistinctRow;
  breakdown: BreakRow[];
  excluded: ExclRow[];
  dims: DimRow[][];
}

const sumMonths = (rows: MonthRow[], from: string, to: string) => {
  let sched = 0, h = 0, d = 0;
  for (const r of rows) {
    if (r.m >= from && r.m <= to) {
      sched += r.sched;
      h += r.h;
      d += r.d;
    }
  }
  return { sched, h, d };
};

export interface DataRange {
  refMonth: string;
  firstMonth: string;
  lastLoad: string | null;
  period: ReturnType<typeof buildPeriod>;
  /** Primer mes con datos dentro del período (el período puede empezar antes de la primera carga) */
  curStart: string;
  curEnd: string;
  prevCovered: boolean;
}

/** Último mes cerrado, cobertura de datos y rango del período. null = no hay ausencias cargadas con un mes cerrado. */
export async function resolveRange(
  tx: Prisma.TransactionClient,
  tenantId: string,
  filters: Pick<AbsenteeismFilters, "p">
): Promise<DataRange | null> {
  const [cov] = await tx.$queryRaw<{ n: number; first: string | null; last: string | null }[]>`
    SELECT count(*)::int AS n,
           to_char(min(start_date), 'YYYY-MM-DD') AS first,
           to_char(max(updated_at), 'YYYY-MM-DD') AS last
    FROM att_absenteeism_events WHERE tenant_id = ${tenantId}::uuid`;
  if (!cov || cov.n === 0 || !cov.first) return null;
  const refMonth = lastClosedMonth();
  const firstMonth = `${cov.first.slice(0, 7)}-01`;
  if (firstMonth > refMonth) return null;
  const period = buildPeriod(filters.p, refMonth);
  return {
    refMonth,
    firstMonth,
    lastLoad: cov.last,
    period,
    curStart: period.start > firstMonth ? period.start : firstMonth,
    curEnd: monthEnd(refMonth),
    prevCovered: period.prevStart >= firstMonth,
  };
}

export async function loadAbsenteeism(
  tenantId: string,
  filters: AbsenteeismFilters,
  dimensions: Dimension[]
): Promise<AbsenteeismData> {
  return withTenantContext(tenantId, async (tx) => {
    const rng = await resolveRange(tx, tenantId, filters);
    if (!rng) {
      const people = await tx.hrPerson.count({ where: { tenantId, deletedAt: null } });
      return { status: "empty", hasPeople: people > 0 } as const;
    }
    const { refMonth, firstMonth, period, curStart, curEnd, prevCovered } = rng;
    const trendStart = addMonths(refMonth, -11);
    const to = curEnd;
    const windowStart = [period.prevStart, trendStart].reduce((a, b) => (a < b ? a : b));
    const from = windowStart > firstMonth ? windowStart : firstMonth;

    // ── Una sola evaluación del motor; todos los agregados salen de ella ──────
    const inCur = Prisma.sql`month_start BETWEEN ${curStart}::date AND ${curEnd}::date`;
    const inPrev = Prisma.sql`month_start BETWEEN ${period.prevStart}::date AND ${period.prevEnd}::date`;
    const counted = Prisma.sql`counts AND in_scope`;
    const dimSelects = dimensions.map(
      (_, i) => Prisma.sql`,
        (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
           SELECT COALESCE(s.g, a.g) AS g, COALESCE(s.sched, 0)::float8 AS sched, COALESCE(s.people, 0)::int AS people,
                  COALESCE(a.h, 0)::float8 AS h, COALESCE(a.d, 0)::float8 AS d
           FROM (SELECT ${Prisma.raw(`g${i}`)} AS g, SUM(wd * dh) AS sched, count(DISTINCT person_id) FILTER (WHERE wd > 0) AS people
                 FROM expo WHERE ${inCur} GROUP BY 1) s
           FULL JOIN (SELECT ${Prisma.raw(`g${i}`)} AS g, SUM(hours) AS h, SUM(hours / dh) AS d
                      FROM absn WHERE ${counted} AND ${inCur} GROUP BY 1) a ON COALESCE(a.g, -1) = COALESCE(s.g, -1)
         ) x) AS ${Prisma.raw(`dim${i}`)}`
    );

    const [row] = await tx.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      ${engineCtes({
        tenantId,
        from,
        to,
        dims: filters.dims,
        classes: filters.classes,
        types: filters.types,
        groupTypes: dimensions.map((d) => d.code),
      })}
      SELECT
        (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
           SELECT to_char(s.m, 'YYYY-MM-DD') AS m, s.sched::float8 AS sched,
                  COALESCE(a.h, 0)::float8 AS h, COALESCE(a.d, 0)::float8 AS d
           FROM (SELECT month_start AS m, SUM(wd * dh) AS sched FROM expo GROUP BY 1) s
           LEFT JOIN (SELECT month_start AS m, SUM(hours) AS h, SUM(hours / dh) AS d
                      FROM absn WHERE ${counted} GROUP BY 1) a ON a.m = s.m
           ORDER BY 1) x) AS monthly,
        (SELECT row_to_json(x) FROM (SELECT
           (SELECT count(DISTINCT event_id) FROM absn WHERE ${counted} AND hours > 0 AND ${inCur})::int AS ev_cur,
           (SELECT count(DISTINCT event_id) FROM absn WHERE ${counted} AND hours > 0 AND ${inPrev})::int AS ev_prev,
           (SELECT count(DISTINCT person_id) FROM absn WHERE ${counted} AND hours > 0 AND ${inCur})::int AS ppl_cur,
           (SELECT count(DISTINCT person_id) FROM absn WHERE ${counted} AND hours > 0 AND ${inPrev})::int AS ppl_prev,
           (SELECT count(DISTINCT person_id) FROM expo WHERE wd > 0 AND ${inCur})::int AS exp_cur,
           (SELECT count(DISTINCT person_id) FROM expo WHERE wd > 0 AND ${inPrev})::int AS exp_prev) x) AS distinct_counts,
        (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
           SELECT class, type_code, SUM(hours)::float8 AS h, SUM(hours / dh)::float8 AS d,
                  count(DISTINCT event_id) FILTER (WHERE hours > 0)::int AS ev
           FROM absn WHERE ${counted} AND ${inCur} GROUP BY 1, 2) x) AS breakdown,
        (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
           SELECT class, SUM(hours)::float8 AS h, SUM(hours / dh)::float8 AS d,
                  count(DISTINCT event_id) FILTER (WHERE hours > 0)::int AS ev
           FROM absn WHERE NOT counts AND ${inCur} GROUP BY 1) x) AS excluded
        ${Prisma.join(dimSelects, "")}`);

    const r = row as Record<string, unknown>;
    const result: EngineResult = {
      monthly: r.monthly as MonthRow[],
      distinct: r.distinct_counts as DistinctRow,
      breakdown: r.breakdown as BreakRow[],
      excluded: r.excluded as ExclRow[],
      dims: dimensions.map((_, i) => r[`dim${i}`] as DimRow[]),
    };
    const { monthly, distinct: d0, breakdown, excluded: excludedRows } = result;

    const [settings, target, unclassified, typeRows] = await Promise.all([
      tx.cfgTenantSetting.findUnique({ where: { tenantId } }),
      tx.cfgTenantMetricTarget.findUnique({
        where: { uq_cfg_tenant_metric_targets: { tenantId, metricCode: "absenteeism_rate" } },
      }),
      tx.cfgAbsenteeismType.count({ where: { tenantId, isClassified: false } }),
      tx.cfgAbsenteeismType.findMany({
        where: { tenantId },
        select: { code: true, name: true, class: true, countsAsAbsence: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const display = (settings?.absenceDisplay ?? "both") as AbsenceDisplay;
    const targetValue = target ? Number(target.targetValue) : METRIC_TARGET_DEFAULTS.absenteeism_rate.value;

    // ── KPIs ────────────────────────────────────────────────────────────────
    const cur = sumMonths(monthly, curStart, curEnd);
    const prev = prevCovered ? sumMonths(monthly, period.prevStart, period.prevEnd) : null;
    const last12 = Array.from({ length: 12 }, (_, i) => addMonths(refMonth, i - 11));
    const coveredLast12 = monthly.filter((m) => m.m >= firstMonth && last12.includes(m.m) && m.sched > 0);
    const l12 = sumMonths(monthly, last12[0]! < firstMonth ? firstMonth : last12[0]!, refMonth);
    const avg = filters.p !== "12m" && coveredLast12.length >= 6 ? pct(l12.h, l12.sched) : null;

    const rateCur = pct(cur.h, cur.sched);
    const ratePrev = prev ? pct(prev.h, prev.sched) : null;
    const amount = (x: { h: number; d: number }): Amount => ({ hours: x.h, days: x.d });
    const evCur = d0.ev_cur;

    const kpis = {
      rate: { value: rateCur, prev: ratePrev, avg, target: targetValue },
      absence: { cur: amount(cur), prev: prev ? amount(prev) : null },
      events: { value: evCur, prev: prevCovered ? d0.ev_prev : null, avgDays: evCur > 0 ? cur.d / evCur : null },
      people: {
        value: d0.ppl_cur,
        prev: prevCovered ? d0.ppl_prev : null,
        pct: pct(d0.ppl_cur, d0.exp_cur),
        exposed: d0.exp_cur,
      },
    };

    const byMonth = new Map(monthly.map((m) => [m.m, m]));
    const series = last12.map((m) => {
      const x = byMonth.get(m);
      const covered = m >= firstMonth && x !== undefined && x.sched > 0;
      return { month: m, rate: covered ? pct(x.h, x.sched) : null, hours: covered ? x.h : null, days: covered ? x.d : null };
    });

    // ── Por clase y por tipo ────────────────────────────────────────────────
    const typeName = new Map(typeRows.map((t) => [t.code, t.name]));
    const totalH = breakdown.reduce((s, x) => s + x.h, 0);
    const toItem = (key: string, label: string, x: { h: number; d: number; ev: number }): BreakdownItem => ({
      key, label, hours: x.h, days: x.d, events: x.ev, share: totalH > 0 ? (x.h / totalH) * 100 : 0,
    });
    const group = (rows: BreakRow[], keyOf: (x: BreakRow) => string, labelOf: (k: string) => string) => {
      const acc = new Map<string, { h: number; d: number; ev: number }>();
      for (const x of rows) {
        const k = keyOf(x);
        const a = acc.get(k) ?? { h: 0, d: 0, ev: 0 };
        a.h += x.h; a.d += x.d; a.ev += x.ev;
        acc.set(k, a);
      }
      return [...acc].map(([k, v]) => toItem(k, labelOf(k), v)).sort((a, b) => b.hours - a.hours);
    };
    const byClass = group(breakdown, (x) => x.class, (k) => CLASS_LABELS[k] ?? k);
    const byType = group(breakdown, (x) => x.type_code, (k) => typeName.get(k) ?? k);

    const exTotal = excludedRows.reduce((s, x) => ({ hours: s.hours + x.h, days: s.days + x.d }), { hours: 0, days: 0 });
    const excludedItems: BreakdownItem[] = excludedRows
      .map((x) => ({
        key: x.class, label: CLASS_LABELS[x.class] ?? x.class, hours: x.h, days: x.d, events: x.ev,
        share: exTotal.hours > 0 ? (x.h / exTotal.hours) * 100 : 0,
      }))
      .sort((a, b) => b.hours - a.hours);

    // ── Por dimensión ───────────────────────────────────────────────────────
    const codes = dimensions.map((d) => d.code);
    const units = codes.length
      ? await tx.hrOrgUnit.findMany({
          where: { tenantId, deletedAt: null, orgUnitTypeCode: { in: codes } },
          select: { id: true, name: true, orgUnitTypeCode: true, isActive: true },
          orderBy: { name: "asc" },
        })
      : [];

    const dimensionData: DimensionData[] = dimensions.map((d, i) => {
      const names = new Map(units.filter((u) => u.orgUnitTypeCode === d.code).map((u) => [u.id, u.name]));
      const items: UnitRateItem[] = result.dims[i]!
        .filter((x) => x.sched > 0 || x.h > 0)
        .map((x) => ({
          key: x.g === null ? "none" : String(x.g),
          label: x.g === null ? "Sin asignar" : (names.get(x.g) ?? `Unidad ${x.g}`),
          rate: pct(x.h, x.sched),
          hours: x.h,
          days: x.d,
          sched: x.sched,
          people: x.people,
          small: x.people < SMALL_SAMPLE,
        }))
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
      };
    });

    const classCodes = [...new Set(typeRows.filter((t) => t.countsAsAbsence).map((t) => t.class))];
    const classOptions = classCodes.map((c) => ({ value: c, label: CLASS_LABELS[c] ?? c }));
    const typeOptions = typeRows.filter((t) => t.countsAsAbsence).map((t) => ({ value: t.code, label: t.name }));

    const lastLoad = rng.lastLoad;
    const staleDays = lastLoad ? Math.floor((Date.now() - Date.parse(`${lastLoad}T00:00:00Z`)) / 86400000) : 0;

    return {
      status: "ok",
      period,
      filters,
      display,
      kpis,
      series,
      byClass,
      byType,
      excluded: { items: excludedItems, total: exTotal },
      dimensions: dimensionData,
      classOptions,
      typeOptions,
      freshness: {
        refMonth,
        firstMonth,
        lastLoad,
        staleDays,
        isStale: staleDays > 45,
        partialFrom: period.start < firstMonth ? firstMonth : null,
        comparisonAvailable: prevCovered && ratePrev !== null,
      },
      notices: {
        unclassifiedTypes: unclassified,
        attendanceMode: (settings?.attendanceMode ?? "basic") as "basic" | "detailed",
      },
    } as const;
  }, TX_OPTIONS);
}

export { hasActiveFilters };
