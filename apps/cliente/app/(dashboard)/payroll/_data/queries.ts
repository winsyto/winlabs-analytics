import { withTenantContext } from "@wla/auth";
import { Prisma } from "@wla/db";
import type { DimensionFilter } from "../../_dashboard-kit/dimension-filters";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import { addMonths, buildPeriod, monthEnd, type PeriodRange } from "../../_dashboard-kit/period";
import { hasActiveFilters, type PayrollFilters } from "./filters";
import { detailHref } from "./hrefs";
import {
  MIN_PERSONS,
  type ClassItem,
  type Composition,
  type DimensionData,
  type Kpis,
  type PayrollData,
  type SeriesPoint,
  type UnitCostItem,
} from "./types";

export const TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 };

/** Clave de los conceptos sin clasificar en las agrupaciones */
export const UNCLASSIFIED_KEY = "uncl";

/** Códigos de las clases base que usan las tarjetas (sueldo y horas extra). Se mantienen aunque se renombren. */
export const SALARY_CLASS_CODE = "sueldo";
export const OVERTIME_CLASS_CODE = "horas_extra";

const monthCode = (ymd: string) => ymd.slice(0, 7);
const monthKey = (code: string) => `${code}-01`;
const abs = Math.abs;

// ── Configuración: qué clase tiene cada concepto ───────────────────────────────────────────────────────────────

export interface PayClassInfo {
  id: number;
  code: string;
  name: string;
  side: "earning" | "deduction";
  sortOrder: number;
}

export interface PayConfig {
  classes: PayClassInfo[];
  /** Una fila por concepto que entra en el dashboard: su agrupación (c<id de clase>, gross, net o uncl) */
  mapRows: { conceptId: number; k: string; earn: boolean }[];
  hasGross: boolean;
  hasNet: boolean;
  unclassifiedConcepts: number;
  /** Conceptos que forman la masa bruta (el total bruto marcado o, si no hay, los de clases de haber) */
  basisConceptIds: number[];
  /** Conceptos del total neto marcado */
  netConceptIds: number[];
}

/**
 * Agrupación de cada concepto: el concepto gana sobre el tipo; los acumuladores marcados como bruto o neto van
 * aparte; los conceptos sin clasificar se muestran en "Sin clasificar"; el resto (contribuciones patronales,
 * provisiones, acumuladores sin marcar, conceptos de clases inactivas) no entra.
 */
export async function loadConfig(tx: Prisma.TransactionClient, tenantId: string): Promise<PayConfig> {
  const [concepts, classRows, rules] = await Promise.all([
    tx.payConcept.findMany({
      where: { tenantId },
      select: { id: true, conceptType: true, referenceTotal: true, isClassified: true },
    }),
    tx.payConceptClass.findMany({ where: { tenantId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    tx.payClassRule.findMany({ where: { tenantId } }),
  ]);
  const classes: PayClassInfo[] = classRows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    side: c.side as "earning" | "deduction",
    sortOrder: c.sortOrder,
  }));
  const byId = new Map(classes.map((c) => [c.id, c]));
  const byConcept = new Map<number, number>();
  const byType = new Map<string, number>();
  for (const r of rules) {
    if (r.conceptId !== null) byConcept.set(r.conceptId, r.classId);
    else if (r.conceptType) byType.set(r.conceptType, r.classId);
  }

  const mapRows: PayConfig["mapRows"] = [];
  let unclassified = 0;
  for (const c of concepts) {
    if (c.referenceTotal === "gross" || c.referenceTotal === "net") {
      mapRows.push({ conceptId: c.id, k: c.referenceTotal, earn: false });
      continue;
    }
    const classId = byConcept.get(c.id) ?? (c.conceptType ? byType.get(c.conceptType) : undefined);
    const cls = classId !== undefined ? byId.get(classId) : undefined;
    if (cls) mapRows.push({ conceptId: c.id, k: `c${cls.id}`, earn: cls.side === "earning" });
    else if (!c.isClassified || c.conceptType === null) {
      mapRows.push({ conceptId: c.id, k: UNCLASSIFIED_KEY, earn: false });
      unclassified++;
    }
  }
  const hasGross = concepts.some((c) => c.referenceTotal === "gross");
  return {
    classes,
    mapRows,
    hasGross,
    hasNet: concepts.some((c) => c.referenceTotal === "net"),
    unclassifiedConcepts: unclassified,
    basisConceptIds: mapRows.filter((r) => (hasGross ? r.k === "gross" : r.earn)).map((r) => r.conceptId),
    netConceptIds: mapRows.filter((r) => r.k === "net").map((r) => r.conceptId),
  };
}

const mapSql = (rows: PayConfig["mapRows"]) =>
  rows.length
    ? Prisma.sql`(VALUES ${Prisma.join(rows.map((r) => Prisma.sql`(${r.conceptId}::int, ${r.k}::text, ${r.earn}::boolean)`))}) AS m(concept_id, k, earn)`
    : Prisma.sql`(VALUES (NULL::int, NULL::text, NULL::boolean)) AS m(concept_id, k, earn)`;

/** Lista de ids para un IN (...). Con una lista vacía devuelve un id que no existe. */
export const idList = (ids: number[]) => Prisma.join(ids.length ? ids : [-1]);

/** Proceso de liquidación con el código (AAAA-MM) y el fin de su período. */
export interface ProcRef {
  id: number;
  code: string;
  end: string;
}

/**
 * Procesos de los períodos fromCode..toCode (AAAA-MM). Las consultas de importes reciben esta lista como
 * constantes: el planificador de Postgres no depende de las estadísticas de pay_entries (recién cargada, un plan
 * sin ellas puede tardar minutos).
 */
export async function loadProcRefs(tx: Prisma.TransactionClient, tenantId: string, fromCode: string, toCode: string): Promise<ProcRef[]> {
  return tx.$queryRaw<ProcRef[]>`
    SELECT pr.id, pe.period_code AS code, to_char(pe.end_date, 'YYYY-MM-DD') AS "end"
    FROM pay_processes pr JOIN pay_periods pe ON pe.id = pr.period_id
    WHERE pr.tenant_id = ${tenantId}::uuid AND pe.period_code ~ '^[0-9]{4}-[0-9]{2}$'
      AND pe.period_code BETWEEN ${fromCode} AND ${toCode}`;
}

const procValues = (procs: ProcRef[]) =>
  procs.length
    ? Prisma.sql`(VALUES ${Prisma.join(procs.map((p) => Prisma.sql`(${p.id}::int, ${p.code}::text, ${p.end}::date)`))}) AS pc(process_id, period_code, end_date)`
    : Prisma.sql`(VALUES (NULL::int, NULL::text, NULL::date)) AS pc(process_id, period_code, end_date)`;

/**
 * Entradas de los procesos dados (e), con su período (pc). Se recorre proceso por proceso con una subconsulta LATERAL
 * (índice por proceso o por concepto y proceso) para que el plan no dependa de las estadísticas de la tabla.
 * `concepts` limita a esos conceptos dentro de la subconsulta; `joins` va después, sobre e y pc.
 */
export const entriesFrom = (tenantId: string, procs: ProcRef[], joins: Prisma.Sql = Prisma.empty, concepts: number[] | null = null) => Prisma.sql`
  FROM ${procValues(procs)}
  CROSS JOIN LATERAL (
    SELECT x.process_id, x.person_id, x.concept_id, x.amount
    FROM pay_entries x
    WHERE x.process_id = pc.process_id AND x.tenant_id = ${tenantId}::uuid
      ${concepts ? Prisma.sql`AND x.concept_id IN (${idList(concepts)})` : Prisma.empty}) e
  ${joins}`;

/**
 * Filtro por unidades resuelto una sola vez por persona y proceso (no por entrada): la CTE `elig` lista las
 * personas que cumplen el filtro en cada proceso, según la unidad vigente al fin del mes liquidado. Sin filtros no
 * hay CTE.
 */
export function eligFilter(
  dims: Record<string, DimensionFilter>,
  tenantId: string,
  procs: ProcRef[]
): { cte: Prisma.Sql | null; join: Prisma.Sql } {
  if (Object.keys(dims).length === 0) return { cte: null, join: Prisma.empty };
  return {
    cte: Prisma.sql`elig AS (
      SELECT pc.process_id, p.id AS person_id
      FROM ${procValues(procs)} CROSS JOIN hr_people p
      WHERE p.tenant_id = ${tenantId}::uuid
        ${personUnitFilter(dims, "p.id", "pc.end_date")})`,
    join: Prisma.sql`JOIN elig ON elig.process_id = e.process_id AND elig.person_id = e.person_id`,
  };
}

/** Antepone WITH a las CTE dadas (ignora las nulas). */
export const withCtes = (...ctes: (Prisma.Sql | null)[]) => {
  const list = ctes.filter((c): c is Prisma.Sql => c !== null);
  return list.length ? Prisma.sql`WITH ${Prisma.join(list, ", ")}` : Prisma.empty;
};

/**
 * Filtro por unidad organizativa de la persona vigente en la fecha `at` (el fin del período de la liquidación).
 * Entre dimensiones AND; dentro de una dimensión OR (unidades elegidas y/o "Sin asignar").
 */
export function personUnitFilter(dims: Record<string, DimensionFilter>, personCol: string, atCol: string): Prisma.Sql {
  const person = Prisma.raw(personCol);
  const at = Prisma.raw(atCol);
  const parts = Object.entries(dims).map(([type, sel]) => {
    const conds: Prisma.Sql[] = [];
    if (sel.ids.length) {
      conds.push(Prisma.sql`EXISTS (
        SELECT 1 FROM hr_people_org_assignments fa
        WHERE fa.person_id = ${person} AND fa.org_unit_type_code = ${type}
          AND fa.org_unit_id IN (${Prisma.join(sel.ids)})
          AND fa.valid_from <= ${at} AND (fa.valid_to IS NULL OR fa.valid_to >= ${at}))`);
    }
    if (sel.none) {
      conds.push(Prisma.sql`NOT EXISTS (
        SELECT 1 FROM hr_people_org_assignments fa
        WHERE fa.person_id = ${person} AND fa.org_unit_type_code = ${type}
          AND fa.valid_from <= ${at} AND (fa.valid_to IS NULL OR fa.valid_to >= ${at}))`);
    }
    return conds.length ? Prisma.sql`AND (${Prisma.join(conds, " OR ")})` : Prisma.empty;
  });
  return parts.length ? Prisma.join(parts, " ") : Prisma.empty;
}

// ── Agregado mensual ───────────────────────────────────────────────────────────────────────────────────────────

export interface MonthAgg {
  /** Personas con masa bruta en el mes */
  persons: number;
  /** Suma de las agrupaciones de haber (earn) */
  earn: number;
  /** Importe por agrupación (c<id>, gross, net, uncl, other) */
  kv: Map<string, number>;
}

/**
 * Importes y personas por mes (clave YYYY-MM-01) de los períodos fromCode..toCode, con el filtro de unidades.
 * Dos pasadas livianas: los importes por agrupación (sin pasar por persona) y las personas con masa bruta
 * (solo sobre los conceptos de la masa bruta).
 */
export async function loadMonthly(
  tx: Prisma.TransactionClient,
  tenantId: string,
  config: PayConfig,
  dims: Record<string, DimensionFilter>,
  procs: ProcRef[]
): Promise<Map<string, MonthAgg>> {
  const el = eligFilter(dims, tenantId, procs);
  const [amounts, persons] = await Promise.all([
    tx.$queryRaw<{ period_code: string; k: string; earn: boolean; amt: number }[]>(Prisma.sql`
      ${withCtes(el.cte)}
      SELECT pc.period_code, COALESCE(m.k, 'other') AS k, COALESCE(m.earn, false) AS earn, SUM(e.amount)::float8 AS amt
      ${entriesFrom(tenantId, procs, Prisma.sql`LEFT JOIN ${mapSql(config.mapRows)} ON m.concept_id = e.concept_id ${el.join}`)}
      GROUP BY 1, 2, 3`),
    config.basisConceptIds.length
      ? tx.$queryRaw<{ period_code: string; n: number }[]>(Prisma.sql`
          ${withCtes(el.cte)}
          SELECT pc.period_code, count(DISTINCT e.person_id)::int AS n
          ${entriesFrom(tenantId, procs, el.join, config.basisConceptIds)}
          GROUP BY 1`)
      : Promise.resolve([] as { period_code: string; n: number }[]),
  ]);
  const out = new Map<string, MonthAgg>();
  const get = (code: string) => {
    const key = monthKey(code);
    const agg = out.get(key) ?? { persons: 0, earn: 0, kv: new Map<string, number>() };
    out.set(key, agg);
    return agg;
  };
  for (const r of amounts) {
    const agg = get(r.period_code);
    agg.kv.set(r.k, (agg.kv.get(r.k) ?? 0) + r.amt);
    if (r.earn) agg.earn += r.amt;
  }
  for (const r of persons) get(r.period_code).persons = r.n;
  return out;
}

// ── Período y meses con liquidaciones ──────────────────────────────────────────────────────────────────────────

export interface PayRange {
  refMonth: string;
  firstMonth: string;
  period: PeriodRange;
  /** Primer mes del período con liquidaciones */
  effStart: string;
  /** Meses (YYYY-MM-01) con liquidaciones cargadas */
  covered: Set<string>;
}

/** Meses con liquidaciones (período con entradas y código AAAA-MM) y rango del período. null = no hay datos. */
export async function resolveRange(
  tx: Prisma.TransactionClient,
  tenantId: string,
  filters: Pick<PayrollFilters, "p">
): Promise<PayRange | null> {
  const rows = await tx.$queryRaw<{ code: string }[]>`
    SELECT DISTINCT pe.period_code AS code
    FROM pay_periods pe
    JOIN pay_processes pr ON pr.period_id = pe.id
    CROSS JOIN LATERAL (SELECT 1 AS one FROM pay_entries x WHERE x.process_id = pr.id LIMIT 1) has_entries
    WHERE pe.tenant_id = ${tenantId}::uuid AND pe.period_code ~ '^[0-9]{4}-[0-9]{2}$'
    ORDER BY 1`;
  if (rows.length === 0) return null;
  const covered = new Set(rows.map((r) => monthKey(r.code)));
  const firstMonth = monthKey(rows[0]!.code);
  const refMonth = monthKey(rows[rows.length - 1]!.code);
  const period = buildPeriod(filters.p, refMonth);
  return { refMonth, firstMonth, period, effStart: period.start > firstMonth ? period.start : firstMonth, covered };
}

/** Meses del rango [from, to] (YYYY-MM-01) que tienen liquidaciones. */
export function coveredIn(covered: Set<string>, from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) if (covered.has(m)) out.push(m);
  return out;
}

const sumK = (agg: Map<string, MonthAgg>, months: string[], k: string) => months.reduce((s, m) => s + (agg.get(m)?.kv.get(k) ?? 0), 0);
const basisOf = (config: PayConfig, a: MonthAgg | undefined) => (a ? (config.hasGross ? (a.kv.get("gross") ?? 0) : a.earn) : 0);

/** Masa bruta y personas-mes de un rango de meses. */
export function basisTotals(config: PayConfig, agg: Map<string, MonthAgg>, months: string[]) {
  return {
    gross: months.reduce((s, m) => s + basisOf(config, agg.get(m)), 0),
    personMonths: months.reduce((s, m) => s + (agg.get(m)?.persons ?? 0), 0),
  };
}

/** Composición por clase de un rango de meses. Los % son sobre el total de haberes de las clases. */
export function buildComposition(
  config: PayConfig,
  agg: Map<string, MonthAgg>,
  months: string[],
  hrefFor?: (key: string) => string
): Composition {
  const earningsTotal = config.classes.reduce((s, c) => (c.side === "earning" ? s + sumK(agg, months, `c${c.id}`) : s), 0);
  const item = (key: string, label: string, side: ClassItem["side"], amount: number): ClassItem => ({
    key,
    label,
    side,
    amount,
    share: earningsTotal !== 0 ? (abs(amount) / abs(earningsTotal)) * 100 : 0,
    href: hrefFor?.(key),
  });
  const items = config.classes
    .map((c) => item(String(c.id), c.name, c.side, sumK(agg, months, `c${c.id}`)))
    .filter((i) => i.amount !== 0);
  const uncl = sumK(agg, months, UNCLASSIFIED_KEY);
  return {
    earnings: items.filter((i) => i.side === "earning"),
    deductions: items.filter((i) => i.side === "deduction"),
    unclassified: uncl !== 0 ? item(UNCLASSIFIED_KEY, "Sin clasificar", "unclassified", uncl) : null,
    earningsTotal,
  };
}

interface UnitRow { g: number | null; total: number; pm: number; persons: number }

export async function loadPayroll(tenantId: string, filters: PayrollFilters, dimensions: Dimension[]): Promise<PayrollData> {
  return withTenantContext(
    tenantId,
    async (tx) => {
      const range = await resolveRange(tx, tenantId, filters);
      if (!range) {
        const concepts = await tx.payConcept.count({ where: { tenantId } });
        return { status: "empty", hasConcepts: concepts > 0 } as const;
      }
      const { refMonth, firstMonth, period, effStart, covered } = range;
      const [config, settings] = await Promise.all([
        loadConfig(tx, tenantId),
        tx.cfgTenantSetting.findUnique({ where: { tenantId }, select: { currency: true } }),
      ]);
      const currency = settings?.currency ?? "ARS";

      // Ventana de datos: 12 meses de la evolución y el período anterior
      const last12From = addMonths(refMonth, -11);
      const fromMonth = period.prevStart < last12From ? period.prevStart : last12From;
      const procs = await loadProcRefs(tx, tenantId, monthCode(fromMonth), monthCode(refMonth));
      const agg = await loadMonthly(tx, tenantId, config, filters.dims, procs);

      const curMonths = coveredIn(covered, period.start, refMonth);
      const prevMonths = coveredIn(covered, period.prevStart, period.prevEnd);
      const l12Months = coveredIn(covered, last12From, refMonth);
      const maxPersons = curMonths.reduce((m, k) => Math.max(m, agg.get(k)?.persons ?? 0), 0);
      const restricted = maxPersons > 0 && maxPersons < MIN_PERSONS;

      const cur = basisTotals(config, agg, curMonths);
      const prev = basisTotals(config, agg, prevMonths);
      const l12 = basisTotals(config, agg, l12Months);
      const hasAvg = filters.p !== "12m" && l12Months.length >= 6;
      const classOf = (code: string) => config.classes.find((c) => c.code === code);
      const salary = classOf(SALARY_CLASS_CODE);
      const overtime = classOf(OVERTIME_CLASS_CODE);
      const kClass = (c: PayClassInfo | undefined, months: string[]) => (c ? sumK(agg, months, `c${c.id}`) : null);

      const hasCur = curMonths.length > 0 && cur.personMonths > 0;
      const hasPrev = prevMonths.length > 0 && prev.personMonths > 0;
      const netCur = config.hasNet ? sumK(agg, curMonths, "net") : null;
      const netPrev = config.hasNet ? sumK(agg, prevMonths, "net") : null;
      const otCur = kClass(overtime, curMonths);
      const salCur = kClass(salary, curMonths);

      const kpis: Kpis = restricted
        ? {
            gross: { value: null, prev: null, avg: null, viaClasses: !config.hasGross },
            perPerson: { value: null, prev: null, avg: null, avgPersons: null },
            net: { value: null, prev: null, avg: null },
            overtime: { value: null, prev: null, pctOfSalary: null, hasClass: !!overtime, classId: overtime?.id ?? null },
          }
        : {
            gross: {
              value: hasCur ? cur.gross : null,
              prev: hasPrev ? prev.gross : null,
              avg: hasAvg ? (l12.gross / l12Months.length) * period.months : null,
              viaClasses: !config.hasGross,
            },
            perPerson: {
              value: hasCur ? cur.gross / cur.personMonths : null,
              prev: hasPrev ? prev.gross / prev.personMonths : null,
              avg: hasAvg && l12.personMonths > 0 ? l12.gross / l12.personMonths : null,
              avgPersons: curMonths.length > 0 ? cur.personMonths / curMonths.length : null,
            },
            net: { value: hasCur ? netCur : null, prev: hasPrev ? netPrev : null, avg: null },
            overtime: {
              value: hasCur ? otCur : null,
              prev: hasPrev ? kClass(overtime, prevMonths) : null,
              pctOfSalary: hasCur && otCur !== null && salCur !== null && salCur !== 0 ? (otCur / salCur) * 100 : null,
              hasClass: !!overtime,
              classId: overtime?.id ?? null,
            },
          };

      // ── Evolución de 12 meses ─────────────────────────────────────────────
      const series: SeriesPoint[] = Array.from({ length: 12 }, (_, i) => {
        const m = addMonths(refMonth, i - 11);
        const a = agg.get(m);
        const persons = a?.persons ?? 0;
        if (!covered.has(m) || persons === 0) return { month: m, state: "nodata", gross: null, net: null, persons: 0 } as const;
        if (persons < MIN_PERSONS) return { month: m, state: "hidden", gross: null, net: null, persons } as const;
        return { month: m, state: "ok", gross: basisOf(config, a), net: config.hasNet ? (a?.kv.get("net") ?? 0) : null, persons } as const;
      });

      const composition: Composition = restricted
        ? { earnings: [], deductions: [], unclassified: null, earningsTotal: 0 }
        : buildComposition(config, agg, curMonths, (key) => detailHref(filters, "clase", key));

      // ── Costo medio por unidad de cada dimensión ──────────────────────────
      const curFrom = monthCode(curMonths[0] ?? period.start);
      const units =
        dimensions.length && !restricted
          ? await tx.hrOrgUnit.findMany({
              where: { tenantId, deletedAt: null, orgUnitTypeCode: { in: dimensions.map((d) => d.code) } },
              select: { id: true, name: true, orgUnitTypeCode: true, isActive: true },
              orderBy: { name: "asc" },
            })
          : [];
      const curProcs = procs.filter((x) => x.code >= curFrom);
      const dimElig = eligFilter(filters.dims, tenantId, curProcs);
      const dimData: DimensionData[] = await Promise.all(
        dimensions.map(async (d) => {
          const rows = restricted
            ? []
            : await tx.$queryRaw<UnitRow[]>(Prisma.sql`
                ${withCtes(dimElig.cte, Prisma.sql`pm AS (
                  SELECT pc.period_code, pc.end_date, e.person_id, SUM(e.amount) AS basis
                  ${entriesFrom(tenantId, curProcs, dimElig.join, config.basisConceptIds)}
                  GROUP BY 1, 2, 3)`)}
                SELECT u.unit AS g, SUM(pm.basis)::float8 AS total, count(*)::int AS pm, count(DISTINCT pm.person_id)::int AS persons
                FROM pm
                LEFT JOIN LATERAL (
                  SELECT a.org_unit_id AS unit FROM hr_people_org_assignments a
                  WHERE a.person_id = pm.person_id AND a.org_unit_type_code = ${d.code}
                    AND a.valid_from <= pm.end_date AND (a.valid_to IS NULL OR a.valid_to >= pm.end_date)
                  ORDER BY a.valid_from DESC LIMIT 1) u ON true
                GROUP BY 1`);
          const names = new Map(units.filter((u) => u.orgUnitTypeCode === d.code).map((u) => [String(u.id), u.name]));
          const items: UnitCostItem[] = rows
            .map((r) => {
              const key = r.g === null ? "none" : String(r.g);
              const hidden = r.persons < MIN_PERSONS;
              return {
                key,
                label: key === "none" ? "Sin asignar" : (names.get(key) ?? `Unidad ${key}`),
                cost: hidden || r.pm === 0 ? null : r.total / r.pm,
                total: hidden ? null : r.total,
                persons: r.persons,
                hidden,
                href: detailHref(filters, "dim", d.slug, key),
              };
            })
            .sort((a, b) => {
              if ((a.key === "none") !== (b.key === "none")) return a.key === "none" ? 1 : -1;
              return (b.cost ?? -1) - (a.cost ?? -1) || a.label.localeCompare(b.label, "es");
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

      const staleDays = Math.floor((Date.now() - Date.parse(`${monthEnd(refMonth)}T00:00:00Z`)) / 86400000);
      return {
        status: "ok",
        period,
        filters,
        currency,
        kpis,
        series,
        composition,
        dimensions: dimData,
        restricted,
        coveredMonths: curMonths.length,
        freshness: {
          refMonth,
          firstMonth,
          staleDays,
          isStale: staleDays > 75,
          partialFrom: period.start < firstMonth ? effStart : null,
          comparisonAvailable: hasPrev && kpis.gross.prev !== null,
          missingGross: !config.hasGross,
          missingNet: !config.hasNet,
          unclassifiedConcepts: config.unclassifiedConcepts,
        },
      } as const;
    },
    TX_OPTIONS
  );
}

export { hasActiveFilters };
