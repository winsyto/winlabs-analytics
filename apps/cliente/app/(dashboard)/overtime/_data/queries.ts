import { withTenantContext } from "@wla/auth";
import { METRIC_TARGET_DEFAULTS, Prisma } from "@wla/db";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import { addMonths, buildPeriod, lastClosedMonth, monthEnd } from "../../_dashboard-kit/period";
import { overtimeCtes, type OvertimeBase } from "./engine";
import { hasActiveFilters, type OvertimeFilters } from "./filters";
import { SMALL_SAMPLE, type DimensionData, type OvertimeData, type TypeItem, type UnitRateItem } from "./types";

export { lastClosedMonth };

/** El motor trabaja sobre todo el historial: las consultas pesadas necesitan más que los 5 s por defecto. */
export const TX_OPTIONS = { timeout: 120_000, maxWait: 10_000 };

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null);

interface MonthRow { m: string; base: number; h: number }
interface CountsRow { ppl_cur: number; ppl_prev: number; cov_cur: number; cov_prev: number; all_cur: number }
interface TypeRow { type_code: string; category: string; h: number }
interface DimRow { g: number | null; base: number; people: number; h: number }

const sumMonths = (rows: MonthRow[], from: string, to: string) => {
  let base = 0, h = 0;
  for (const r of rows) {
    if (r.m >= from && r.m <= to) {
      base += r.base;
      h += r.h;
    }
  }
  return { base, h };
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

/**
 * Último mes cerrado, cobertura de datos y rango del período. null = no hay horas por tipo cargadas con un mes cerrado.
 * Solo cuentan las asistencias con horas por tipo: una cabecera diaria sin entradas (formato anterior) no es cobertura.
 */
export async function resolveRange(
  tx: Prisma.TransactionClient,
  tenantId: string,
  filters: Pick<OvertimeFilters, "p">
): Promise<DataRange | null> {
  // Entradas primero y búsqueda por clave primaria en la cabecera: el plan no depende de las estadísticas de la tabla
  const [cov] = await tx.$queryRaw<{ first: string | null; last: string | null }[]>`
    SELECT (SELECT to_char(d.date, 'YYYY-MM-DD')
            FROM att_time_daily_entries en
            JOIN att_time_daily d ON d.id = en.time_daily_id
            WHERE en.tenant_id = ${tenantId}::uuid
            ORDER BY d.date LIMIT 1) AS first,
           (SELECT to_char(max(en.created_at), 'YYYY-MM-DD') FROM att_time_daily_entries en
            WHERE en.tenant_id = ${tenantId}::uuid) AS last`;
  if (!cov || !cov.first) return null;
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

export async function loadOvertime(
  tenantId: string,
  filters: OvertimeFilters,
  dimensions: Dimension[]
): Promise<OvertimeData> {
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

    const [settings, target, unclassified, typeRows] = await Promise.all([
      tx.cfgTenantSetting.findUnique({ where: { tenantId } }),
      tx.cfgTenantMetricTarget.findUnique({
        where: { uq_cfg_tenant_metric_targets: { tenantId, metricCode: "overtime_rate" } },
      }),
      tx.cfgTenantTimeEntryType.count({ where: { tenantId, isClassified: false } }),
      tx.cfgTenantTimeEntryType.findMany({
        where: { tenantId, category: { in: ["overtime", "overtime_na"] } },
        select: { id: true, code: true, name: true, category: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);
    const base: OvertimeBase = settings?.overtimeBase === "worked" ? "worked" : "scheduled";
    const targetValue = target ? Number(target.targetValue) : METRIC_TARGET_DEFAULTS.overtime_rate.value;

    // ── Una sola evaluación del motor; todos los agregados salen de ella ──────
    const inCur = Prisma.sql`month_start BETWEEN ${curStart}::date AND ${curEnd}::date`;
    const inPrev = Prisma.sql`month_start BETWEEN ${period.prevStart}::date AND ${period.prevEnd}::date`;
    const ot = Prisma.sql`category = 'overtime' AND in_scope`;
    const dimSelects = dimensions.map(
      (_, i) => Prisma.sql`,
        (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
           SELECT COALESCE(s.g, a.g) AS g, COALESCE(s.base, 0)::float8 AS base, COALESCE(s.people, 0)::int AS people,
                  COALESCE(a.h, 0)::float8 AS h
           FROM (SELECT ${Prisma.raw(`g${i}`)} AS g, SUM(base_hours) AS base, count(DISTINCT person_id) FILTER (WHERE wd > 0) AS people
                 FROM den WHERE ${inCur} GROUP BY 1) s
           FULL JOIN (SELECT ${Prisma.raw(`g${i}`)} AS g, SUM(hours) AS h
                      FROM hrs WHERE ${ot} AND ${inCur} GROUP BY 1) a ON COALESCE(a.g, -1) = COALESCE(s.g, -1)
         ) x) AS ${Prisma.raw(`dim${i}`)}`
    );

    const [row] = await tx.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      ${overtimeCtes({
        tenantId,
        from,
        to,
        dims: filters.dims,
        types: filters.types,
        otTypeIds: typeRows.map((t) => t.id),
        groupTypes: dimensions.map((d) => d.code),
        base,
      })}
      SELECT
        (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
           SELECT to_char(s.m, 'YYYY-MM-DD') AS m, s.base::float8 AS base, COALESCE(a.h, 0)::float8 AS h
           FROM (SELECT month_start AS m, SUM(base_hours) AS base FROM den GROUP BY 1) s
           LEFT JOIN (SELECT month_start AS m, SUM(hours) AS h FROM hrs WHERE ${ot} GROUP BY 1) a ON a.m = s.m
           ORDER BY 1) x) AS monthly,
        (SELECT row_to_json(x) FROM (SELECT
           (SELECT count(DISTINCT person_id) FROM hrs WHERE ${ot} AND hours > 0 AND ${inCur})::int AS ppl_cur,
           (SELECT count(DISTINCT person_id) FROM hrs WHERE ${ot} AND hours > 0 AND ${inPrev})::int AS ppl_prev,
           (SELECT count(DISTINCT person_id) FROM den WHERE wd > 0 AND ${inCur})::int AS cov_cur,
           (SELECT count(DISTINCT person_id) FROM den WHERE wd > 0 AND ${inPrev})::int AS cov_prev,
           (SELECT count(DISTINCT person_id) FROM expo WHERE wd > 0 AND ${inCur})::int AS all_cur) x) AS counts,
        (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
           SELECT type_code, category, SUM(hours)::float8 AS h
           FROM hrs WHERE in_scope AND ${inCur} GROUP BY 1, 2) x) AS by_type
        ${Prisma.join(dimSelects, "")}`);

    const r = row as Record<string, unknown>;
    const monthly = r.monthly as MonthRow[];
    const counts = r.counts as CountsRow;
    const typeHours = r.by_type as TypeRow[];
    const dimRows = dimensions.map((_, i) => r[`dim${i}`] as DimRow[]);

    // ── KPIs ────────────────────────────────────────────────────────────────
    const cur = sumMonths(monthly, curStart, curEnd);
    const prev = prevCovered ? sumMonths(monthly, period.prevStart, period.prevEnd) : null;
    const last12 = Array.from({ length: 12 }, (_, i) => addMonths(refMonth, i - 11));
    const coveredLast12 = monthly.filter((m) => m.m >= firstMonth && last12.includes(m.m) && m.base > 0);
    const l12 = sumMonths(monthly, last12[0]! < firstMonth ? firstMonth : last12[0]!, refMonth);
    const avg = filters.p !== "12m" && coveredLast12.length >= 6 ? pct(l12.h, l12.base) : null;
    const rateCur = pct(cur.h, cur.base);
    const ratePrev = prev ? pct(prev.h, prev.base) : null;

    const byMonth = new Map(monthly.map((m) => [m.m, m]));
    const series = last12.map((m) => {
      const x = byMonth.get(m);
      const covered = m >= firstMonth && x !== undefined && x.base > 0;
      return { month: m, rate: covered ? pct(x.h, x.base) : null, hours: covered ? x.h : null };
    });

    // ── Por tipo: horas extra por un lado, no autorizadas aparte ─────────────
    const typeInfo = new Map(typeRows.map((t) => [t.code, t]));
    const toItems = (category: string): { items: TypeItem[]; hours: number } => {
      const rows = typeHours.filter((x) => x.category === category && x.h > 0);
      const total = rows.reduce((s, x) => s + x.h, 0);
      return {
        hours: total,
        items: rows
          .map((x) => ({
            key: x.type_code,
            label: typeInfo.get(x.type_code)?.name ?? x.type_code,
            hours: x.h,
            share: total > 0 ? (x.h / total) * 100 : 0,
          }))
          .sort((a, b) => b.hours - a.hours),
      };
    };
    const overtime = toItems("overtime");
    const unauthorized = toItems("overtime_na");

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
      const items: UnitRateItem[] = dimRows[i]!
        .filter((x) => x.base > 0 || x.h > 0)
        .map((x) => ({
          key: x.g === null ? "none" : String(x.g),
          label: x.g === null ? "Sin asignar" : (names.get(x.g) ?? `Unidad ${x.g}`),
          rate: pct(x.h, x.base),
          hours: x.h,
          base: x.base,
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

    // Alertas: unidades de la primera dimensión con tasa sobre la meta (sin contar "Sin asignar")
    const first = dimensionData[0];
    const rated = first ? first.items.filter((x) => x.key !== "none" && x.rate !== null) : [];
    const over = first
      ? { count: rated.filter((x) => (x.rate ?? 0) > targetValue).length, total: rated.length, dimension: first.name }
      : null;

    const lastLoad = rng.lastLoad;
    const staleDays = lastLoad ? Math.floor((Date.now() - Date.parse(`${lastLoad}T00:00:00Z`)) / 86400000) : 0;

    return {
      status: "ok",
      period,
      filters,
      base,
      kpis: {
        rate: { value: rateCur, prev: ratePrev, avg, target: targetValue, over },
        hours: { value: cur.h, prev: prev ? prev.h : null },
        people: {
          value: counts.ppl_cur,
          prev: prevCovered ? counts.ppl_prev : null,
          pct: pct(counts.ppl_cur, counts.cov_cur),
          covered: counts.cov_cur,
        },
        perPerson: {
          value: counts.ppl_cur > 0 ? cur.h / counts.ppl_cur : null,
          prev: prev && counts.ppl_prev > 0 ? prev.h / counts.ppl_prev : null,
        },
      },
      series,
      byType: overtime.items,
      unauthorized,
      dimensions: dimensionData,
      typeOptions: typeRows.map((t) => ({ value: t.code, label: t.name })),
      coverage: { covered: counts.cov_cur, total: counts.all_cur },
      freshness: {
        refMonth,
        firstMonth,
        lastLoad,
        staleDays,
        isStale: staleDays > 45,
        partialFrom: period.start < firstMonth ? firstMonth : null,
        comparisonAvailable: prevCovered && ratePrev !== null,
      },
      notices: { unclassifiedTypes: unclassified },
    } as const;
  }, TX_OPTIONS);
}

export { hasActiveFilters };
