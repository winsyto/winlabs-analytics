import { withTenantContext } from "@wla/auth";
import { Prisma } from "@wla/db";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import { addMonths, monthEnd, type PeriodRange } from "../../_dashboard-kit/period";
import type { PayrollFilters } from "./filters";
import {
  basisTotals,
  coveredIn,
  eligFilter,
  entriesFrom,
  idList,
  loadConfig,
  loadMonthly,
  loadProcRefs,
  personUnitFilter,
  resolveRange,
  TX_OPTIONS,
  withCtes,
  type PayConfig,
} from "./queries";
import { MIN_PERSONS, type DimensionData, type UnitCostItem } from "./types";

const monthCode = (ymd: string) => ymd.slice(0, 7);
const abs = Math.abs;

export interface ConceptOption {
  id: number;
  code: string;
  name: string;
  type: string | null;
  /** Clase del concepto, "Total bruto", "Total neto", "Sin clasificar" o null si no entra en ninguna */
  className: string | null;
}

export interface OverviewRow extends ConceptOption {
  /** null = reservado (menos de MIN_PERSONS personas) */
  amount: number | null;
  persons: number;
}

export interface ConceptSeriesPoint {
  month: string;
  state: "ok" | "nodata" | "hidden";
  amount: number | null;
  persons: number;
}

export interface ConceptProcessRow {
  id: number;
  month: string;
  code: string;
  type: string;
  amount: number | null;
  quantity: number | null;
  persons: number;
}

export interface ConceptPersonRow {
  id: number;
  code: string;
  name: string;
  amount: number;
  quantity: number | null;
}

interface Pair {
  value: number | null;
  prev: number | null;
}

export interface ConceptKpis {
  amount: Pair;
  /** Personas por mes (promedio de los meses con liquidación) */
  persons: Pair;
  /** Importe medio por persona y mes */
  perPerson: Pair;
  quantity: Pair & { hasQuantity: boolean };
  /** % del importe de su clase (null si no está en una clase) y de la masa bruta */
  pctClass: number | null;
  pctGross: number | null;
  /** Importe por unidad de cantidad (p. ej. valor medio de la hora) */
  perUnit: number | null;
}

export interface ConceptDetail {
  concept: ConceptOption;
  hasQuantity: boolean;
  restricted: boolean;
  kpis: ConceptKpis;
  series: ConceptSeriesPoint[];
  processes: ConceptProcessRow[];
  dimensions: DimensionData[];
  /** Solo para un admin */
  persons: ConceptPersonRow[] | null;
}

export type ConceptData =
  | { status: "empty" }
  | { status: "notfound" }
  | {
      status: "ok";
      period: PeriodRange;
      filters: PayrollFilters;
      currency: string;
      options: ConceptOption[];
      /** Unidades elegibles de cada dimensión (para los filtros) */
      dimensionOptions: { code: string; name: string; slug: string; options: { value: string; label: string }[] }[];
      /** Cuadro de todos los conceptos del período (cuando no hay uno elegido) */
      overview: OverviewRow[] | null;
      detail: ConceptDetail | null;
      freshness: { refMonth: string; firstMonth: string; staleDays: number; isStale: boolean; partialFrom: string | null; comparisonAvailable: boolean };
    };

/** Nombre de la agrupación de cada concepto para mostrar. */
function describe(config: PayConfig): Map<number, string | null> {
  const classNames = new Map(config.classes.map((c) => [`c${c.id}`, c.name]));
  const labels: Record<string, string> = { gross: "Total bruto", net: "Total neto", uncl: "Sin clasificar" };
  return new Map(config.mapRows.map((r) => [r.conceptId, classNames.get(r.k) ?? labels[r.k] ?? null]));
}

const sumK = (agg: Map<string, { kv: Map<string, number> }>, months: string[], k: string) => months.reduce((s, m) => s + (agg.get(m)?.kv.get(k) ?? 0), 0);

export async function loadConceptDetail(
  tenantId: string,
  filters: PayrollFilters,
  dimensions: Dimension[],
  conceptId: number | null,
  opts: { admin: boolean }
): Promise<ConceptData> {
  return withTenantContext(
    tenantId,
    async (tx) => {
      const range = await resolveRange(tx, tenantId, filters);
      if (!range) return { status: "empty" } as const;
      const { refMonth, firstMonth, period, effStart, covered } = range;
      const [config, settings, concepts] = await Promise.all([
        loadConfig(tx, tenantId),
        tx.cfgTenantSetting.findUnique({ where: { tenantId }, select: { currency: true } }),
        tx.payConcept.findMany({ where: { tenantId }, select: { id: true, code: true, name: true, conceptType: true }, orderBy: { code: "asc" } }),
      ]);
      const currency = settings?.currency ?? "ARS";
      const classOf = describe(config);
      const options: ConceptOption[] = concepts
        .map((c) => ({ id: c.id, code: c.code, name: c.name, type: c.conceptType, className: classOf.get(c.id) ?? null }))
        .sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true }));

      const selected = conceptId === null ? null : (options.find((o) => o.id === conceptId) ?? null);
      if (conceptId !== null && !selected) return { status: "notfound" } as const;

      const curMonths = coveredIn(covered, period.start, refMonth);
      const prevMonths = coveredIn(covered, period.prevStart, period.prevEnd);
      const staleDays = Math.floor((Date.now() - Date.parse(`${monthEnd(refMonth)}T00:00:00Z`)) / 86400000);
      const freshness = {
        refMonth,
        firstMonth,
        staleDays,
        isStale: staleDays > 75,
        partialFrom: period.start < firstMonth ? effStart : null,
        comparisonAvailable: prevMonths.length > 0,
      };
      const allUnits = dimensions.length
        ? await tx.hrOrgUnit.findMany({
            where: { tenantId, deletedAt: null, orgUnitTypeCode: { in: dimensions.map((d) => d.code) } },
            select: { id: true, name: true, orgUnitTypeCode: true, isActive: true },
            orderBy: { name: "asc" },
          })
        : [];
      const dimensionOptions = dimensions.map((d) => ({
        code: d.code,
        name: d.name,
        slug: d.slug,
        options: allUnits.filter((u) => u.orgUnitTypeCode === d.code && u.isActive).map((u) => ({ value: String(u.id), label: u.name })),
      }));
      const base = { status: "ok", period, filters, currency, options, dimensionOptions, freshness } as const;

      // ── Cuadro de todos los conceptos del período ──────────────────────────
      if (!selected) {
        const curFrom = monthCode(curMonths[0] ?? period.start);
        const curProcs = await loadProcRefs(tx, tenantId, curFrom, monthCode(refMonth));
        const el = eligFilter(filters.dims, tenantId, curProcs);
        const rows = await tx.$queryRaw<{ concept_id: number; amt: number; n: number }[]>(Prisma.sql`
          ${withCtes(el.cte)}
          SELECT e.concept_id, SUM(e.amount)::float8 AS amt, count(DISTINCT e.person_id)::int AS n
          ${entriesFrom(tenantId, curProcs, el.join)}
          GROUP BY e.concept_id`);
        const byId = new Map(rows.map((r) => [r.concept_id, r]));
        const overview: OverviewRow[] = options
          .filter((o) => byId.has(o.id))
          .map((o) => {
            const r = byId.get(o.id)!;
            return { ...o, amount: r.n < MIN_PERSONS ? null : r.amt, persons: r.n };
          });
        return { ...base, overview, detail: null } as const;
      }

      // ── Detalle de un concepto ─────────────────────────────────────────────
      const last12From = addMonths(refMonth, -11);
      const fromMonth = period.prevStart < last12From ? period.prevStart : last12From;
      const procs = await loadProcRefs(tx, tenantId, monthCode(fromMonth), monthCode(refMonth));
      const el = eligFilter(filters.dims, tenantId, procs);
      const [monthly, agg] = await Promise.all([
        tx.$queryRaw<{ period_code: string; amt: number; qty: number | null; n: number }[]>(Prisma.sql`
          ${withCtes(el.cte)}
          SELECT pc.period_code, SUM(e.amount)::float8 AS amt, SUM(e.quantity)::float8 AS qty, count(DISTINCT e.person_id)::int AS n
          ${entriesFrom(tenantId, procs, el.join, [selected.id])}
          GROUP BY 1`),
        loadMonthly(tx, tenantId, config, filters.dims, procs),
      ]);
      const m = new Map(monthly.map((r) => [`${r.period_code}-01`, r]));
      const hasQuantity = monthly.some((r) => r.qty !== null && r.qty !== 0);

      const maxPersons = curMonths.reduce((mx, k) => Math.max(mx, m.get(k)?.n ?? 0), 0);
      const restricted = maxPersons > 0 && maxPersons < MIN_PERSONS;

      const total = (months: string[], f: (r: NonNullable<ReturnType<typeof m.get>>) => number) => months.reduce((s, k) => s + (m.get(k) ? f(m.get(k)!) : 0), 0);
      const pairOf = (f: (months: string[]) => number | null): Pair => ({
        value: curMonths.length ? f(curMonths) : null,
        prev: prevMonths.length ? f(prevMonths) : null,
      });
      const amount = pairOf((ms) => total(ms, (r) => r.amt));
      const personMonths = (ms: string[]) => total(ms, (r) => r.n);
      const key = config.mapRows.find((r) => r.conceptId === selected.id)?.k ?? null;
      const gross = basisTotals(config, agg, curMonths).gross;
      const classAmount = key && key.startsWith("c") ? sumK(agg, curMonths, key) : null;
      const qtyPair = pairOf((ms) => total(ms, (r) => r.qty ?? 0));

      const kpis: ConceptKpis = restricted
        ? {
            amount: { value: null, prev: null },
            persons: { value: null, prev: null },
            perPerson: { value: null, prev: null },
            quantity: { value: null, prev: null, hasQuantity },
            pctClass: null,
            pctGross: null,
            perUnit: null,
          }
        : {
            amount,
            persons: pairOf((ms) => (ms.length ? personMonths(ms) / ms.length : null)),
            perPerson: pairOf((ms) => (personMonths(ms) > 0 ? total(ms, (r) => r.amt) / personMonths(ms) : null)),
            quantity: { ...qtyPair, hasQuantity },
            pctClass: classAmount ? (abs(amount.value ?? 0) / abs(classAmount)) * 100 : null,
            pctGross: gross ? (abs(amount.value ?? 0) / abs(gross)) * 100 : null,
            perUnit: hasQuantity && (qtyPair.value ?? 0) !== 0 ? (amount.value ?? 0) / (qtyPair.value ?? 1) : null,
          };

      const series: ConceptSeriesPoint[] = Array.from({ length: 12 }, (_, i) => {
        const k = addMonths(refMonth, i - 11);
        const r = m.get(k);
        if (!covered.has(k)) return { month: k, state: "nodata", amount: null, persons: 0 } as const;
        if (r && r.n < MIN_PERSONS) return { month: k, state: "hidden", amount: null, persons: r.n } as const;
        return { month: k, state: "ok", amount: r?.amt ?? 0, persons: r?.n ?? 0 } as const;
      });

      // ── Por proceso (período actual) ───────────────────────────────────────
      const curProcs = procs.filter((p) => curMonths.includes(`${p.code}-01`));
      const elCur = eligFilter(filters.dims, tenantId, curProcs);
      const procRows = restricted
        ? []
        : await tx.$queryRaw<{ process_id: number; amt: number; qty: number | null; n: number }[]>(Prisma.sql`
            ${withCtes(elCur.cte)}
            SELECT e.process_id, SUM(e.amount)::float8 AS amt, SUM(e.quantity)::float8 AS qty, count(DISTINCT e.person_id)::int AS n
            ${entriesFrom(tenantId, curProcs, elCur.join, [selected.id])}
            GROUP BY e.process_id`);
      const procById = new Map(curProcs.map((p) => [p.id, p]));
      const processes: ConceptProcessRow[] = procRows
        .map((r) => {
          const p = procById.get(r.process_id)!;
          const hidden = r.n < MIN_PERSONS;
          return { id: r.process_id, month: `${p.code}-01`, code: p.pcode, type: p.ptype, amount: hidden ? null : r.amt, quantity: hidden ? null : r.qty, persons: r.n };
        })
        .sort((a, b) => b.month.localeCompare(a.month) || a.code.localeCompare(b.code, "es", { numeric: true }));

      // ── Por unidad de cada dimensión ───────────────────────────────────────
      const units = restricted ? [] : allUnits;
      const dimData: DimensionData[] = await Promise.all(
        dimensions.map(async (d) => {
          const rows = restricted
            ? []
            : await tx.$queryRaw<{ g: number | null; total: number; pm: number; persons: number }[]>(Prisma.sql`
                ${withCtes(elCur.cte, Prisma.sql`pm AS (
                  SELECT pc.period_code, pc.end_date, e.person_id, SUM(e.amount) AS basis
                  ${entriesFrom(tenantId, curProcs, elCur.join, [selected.id])}
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
              const k = r.g === null ? "none" : String(r.g);
              const hidden = r.persons < MIN_PERSONS;
              return {
                key: k,
                label: k === "none" ? "Sin asignar" : (names.get(k) ?? `Unidad ${k}`),
                cost: hidden || r.pm === 0 ? null : r.total / r.pm,
                total: hidden ? null : r.total,
                persons: r.persons,
                hidden,
              };
            })
            .sort((a, b) => {
              if ((a.key === "none") !== (b.key === "none")) return a.key === "none" ? 1 : -1;
              return abs(b.cost ?? 0) - abs(a.cost ?? 0) || a.label.localeCompare(b.label, "es");
            });
          return { code: d.code, name: d.name, slug: d.slug, items, options: units.filter((u) => u.orgUnitTypeCode === d.code && u.isActive).map((u) => ({ value: String(u.id), label: u.name })) };
        })
      );

      // ── Personas (solo admin) ──────────────────────────────────────────────
      let persons: ConceptPersonRow[] | null = null;
      if (opts.admin && !restricted) {
        const rows = await tx.$queryRaw<{ id: number; code: string; name: string; amt: number; qty: number | null }[]>(Prisma.sql`
          ${withCtes(elCur.cte, Prisma.sql`pp AS (
            SELECT e.person_id, SUM(e.amount) AS amt, SUM(e.quantity) AS qty
            ${entriesFrom(tenantId, curProcs, elCur.join, [selected.id])}
            GROUP BY 1)`)}
          SELECT p.id, p.employee_code AS code, p.full_name AS name, pp.amt::float8 AS amt, pp.qty::float8 AS qty
          FROM pp JOIN hr_people p ON p.id = pp.person_id
          ORDER BY abs(pp.amt) DESC, p.id LIMIT 50`);
        persons = rows.map((r) => ({ id: r.id, code: r.code, name: r.name, amount: r.amt, quantity: r.qty }));
      }

      return {
        ...base,
        overview: null,
        detail: { concept: selected, hasQuantity, restricted, kpis, series, processes, dimensions: dimData, persons },
      } as const;
    },
    TX_OPTIONS
  );
}

export { personUnitFilter, idList };
