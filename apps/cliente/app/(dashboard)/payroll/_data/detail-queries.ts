import { z } from "zod";
import { withTenantContext } from "@wla/auth";
import { Prisma } from "@wla/db";
import type { DimensionFilter } from "../../_dashboard-kit/dimension-filters";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import { monthEnd, type PeriodRange } from "../../_dashboard-kit/period";
import type { PayrollFilters } from "./filters";
import type { DetailScope } from "./hrefs";
import {
  basisTotals,
  buildComposition,
  coveredIn,
  eligFilter,
  entriesFrom,
  idList,
  loadConfig,
  loadMonthly,
  loadProcRefs,
  type ProcRef,
  personUnitFilter,
  resolveRange,
  withCtes,
  TX_OPTIONS,
  UNCLASSIFIED_KEY,
  type PayConfig,
} from "./queries";
import { MIN_PERSONS, type Composition } from "./types";

export const PAGE_SIZE = 50;
export const EXPORT_MAX_ROWS = 20000;

export const detailParamsSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).catch(1),
  q: z.string().trim().max(100).catch(""),
});
export type DetailParams = z.infer<typeof detailParamsSchema>;

export const PROCESS_TYPE_LABELS: Record<string, string> = {
  monthly: "Mensual",
  biweekly: "Quincenal",
  weekly: "Semanal",
  sac: "SAC",
  adjustments: "Ajustes",
  provisions: "Provisiones",
  final_settlement: "Liquidación final",
  vacation: "Vacaciones",
};

export interface ProcessRow {
  id: number;
  month: string;
  code: string;
  description: string | null;
  type: string;
  from: string;
  to: string;
  persons: number;
  /** null = reservado por privacidad (menos de MIN_PERSONS personas) */
  gross: number | null;
  net: number | null;
}

export interface ConceptRow {
  id: number;
  code: string;
  name: string;
  type: string | null;
  persons: number;
  amount: number | null;
  share: number | null;
}

export interface PersonRow {
  id: number;
  code: string;
  name: string;
  units: Record<string, string | null>;
  gross: number;
  net: number | null;
}

type Base = { period: PeriodRange; title: string; currency: string };

export type DetailData =
  | { status: "empty" }
  | { status: "notfound" }
  | ({ status: "ok"; kind: "procesos"; rows: ProcessRow[] } & Base)
  | ({ status: "ok"; kind: "clase"; rows: ConceptRow[]; total: number | null } & Base)
  | ({
      status: "ok";
      kind: "dim";
      restricted: boolean;
      gross: number;
      costPerPerson: number | null;
      avgPersons: number | null;
      composition: Composition;
    } & Base)
  | ({ status: "ok"; kind: "personas"; rows: PersonRow[]; total: number; hasNet: boolean } & Base);

/** Nombre de la unidad de un tipo vigente en `at` (una fecha SQL) para la persona p. */
const orgUnitNameAt = (type: string, at: Prisma.Sql) =>
  Prisma.sql`(SELECT ou.name
    FROM hr_people_org_assignments a JOIN hr_org_units ou ON ou.id = a.org_unit_id
    WHERE a.person_id = p.id AND a.org_unit_type_code = ${type}
      AND a.valid_from <= ${at} AND (a.valid_to IS NULL OR a.valid_to >= ${at})
    ORDER BY a.valid_from DESC LIMIT 1)`;

const mapValues = (rows: PayConfig["mapRows"]) =>
  rows.length
    ? Prisma.sql`(VALUES ${Prisma.join(rows.map((r) => Prisma.sql`(${r.conceptId}::int, ${r.k}::text, ${r.earn}::boolean)`))}) AS m(concept_id, k, earn)`
    : Prisma.sql`(VALUES (NULL::int, NULL::text, NULL::boolean)) AS m(concept_id, k, earn)`;

/**
 * Masa bruta y neto por proceso y persona (pp): solo las entradas de los conceptos de la masa bruta y del neto.
 * `group` es la columna que se conserva además de la persona (el proceso).
 */
const ppSql = (tenantId: string, config: PayConfig, procs: ProcRef[], dims: Record<string, DimensionFilter>) => {
  const el = eligFilter(dims, tenantId, procs);
  const ids = [...config.basisConceptIds, ...config.netConceptIds];
  return withCtes(
    el.cte,
    Prisma.sql`pp AS (
      SELECT e.process_id, e.person_id,
             SUM(e.amount) FILTER (WHERE e.concept_id IN (${idList(config.basisConceptIds)})) AS basis,
             SUM(e.amount) FILTER (WHERE e.concept_id IN (${idList(config.netConceptIds)})) AS net
      ${entriesFrom(tenantId, procs, el.join, ids)}
      GROUP BY 1, 2)`
  );
};

const code7 = (ymd: string) => ymd.slice(0, 7);

/**
 * Detalle de un drill-down del resumen (período efectivo y filtros del dashboard):
 *  - procesos: los procesos de liquidación del período con su masa bruta y neto
 *  - clase: los conceptos de una clase (segments = [id de clase | "uncl"])
 *  - dim: la composición de una unidad (segments = [slug de la dimensión, id de unidad | "none"])
 *  - personas: ranking de personas por masa bruta (solo admin; lo controla la página)
 */
export async function loadDetail(
  tenantId: string,
  filters: PayrollFilters,
  dimensions: Dimension[],
  scope: DetailScope,
  segments: string[],
  params: DetailParams,
  opts: { all?: boolean } = {}
): Promise<DetailData> {
  return withTenantContext(
    tenantId,
    async (tx) => {
      const range = await resolveRange(tx, tenantId, filters);
      if (!range) return { status: "empty" } as const;
      const { period, refMonth, effStart, covered } = range;
      const [config, settings] = await Promise.all([
        loadConfig(tx, tenantId),
        tx.cfgTenantSetting.findUnique({ where: { tenantId }, select: { currency: true } }),
      ]);
      const currency = settings?.currency ?? "ARS";
      const months = coveredIn(covered, period.start, refMonth);
      const fromCode = code7(effStart);
      const toCode = code7(refMonth);
      const procs = await loadProcRefs(tx, tenantId, fromCode, toCode);

      if (scope === "procesos") {
        const agg = await tx.$queryRaw<{ process_id: number; gross: number | null; net: number | null; persons: number }[]>(Prisma.sql`
          ${ppSql(tenantId, config, procs, filters.dims)}
          SELECT process_id, SUM(basis)::float8 AS gross, SUM(net)::float8 AS net, (count(*) FILTER (WHERE basis IS NOT NULL))::int AS persons
          FROM pp GROUP BY process_id`);
        const procRows = await tx.payProcess.findMany({
          where: { tenantId, id: { in: agg.map((a) => a.process_id) } },
          include: { period: { select: { periodCode: true } } },
        });
        const byId = new Map(agg.map((a) => [a.process_id, a]));
        const rows: ProcessRow[] = procRows
          .map((p) => {
            const a = byId.get(p.id)!;
            const hidden = a.persons < MIN_PERSONS;
            return {
              id: p.id,
              month: `${p.period.periodCode}-01`,
              code: p.code,
              description: p.description,
              type: p.processType,
              from: p.startDate.toISOString().slice(0, 10),
              to: p.endDate.toISOString().slice(0, 10),
              persons: a.persons,
              gross: hidden ? null : (a.gross ?? 0),
              net: hidden || !config.hasNet ? null : (a.net ?? 0),
            };
          })
          .sort((x, y) => y.month.localeCompare(x.month) || x.code.localeCompare(y.code, "es", { numeric: true }));
        return { status: "ok", kind: "procesos", period, currency, title: "Procesos de liquidación", rows } as const;
      }

      if (scope === "clase") {
        const key = segments[0];
        if (!key || segments.length !== 1) return { status: "notfound" } as const;
        let title: string;
        let mapKey: string;
        if (key === UNCLASSIFIED_KEY) {
          title = "Conceptos sin clasificar";
          mapKey = UNCLASSIFIED_KEY;
        } else {
          const cls = config.classes.find((c) => String(c.id) === key);
          if (!cls) return { status: "notfound" } as const;
          title = `Clase: ${cls.name}`;
          mapKey = `c${cls.id}`;
        }
        const rowsMap = config.mapRows.filter((r) => r.k === mapKey);
        const el = eligFilter(filters.dims, tenantId, procs);
        const raw = rowsMap.length
          ? await tx.$queryRaw<{ concept_id: number; amt: number; persons: number }[]>(Prisma.sql`
              ${withCtes(el.cte)}
              SELECT e.concept_id, SUM(e.amount)::float8 AS amt, count(DISTINCT e.person_id)::int AS persons
              ${entriesFrom(tenantId, procs, Prisma.sql`JOIN ${mapValues(rowsMap)} ON m.concept_id = e.concept_id ${el.join}`, rowsMap.map((r) => r.conceptId))}
              GROUP BY e.concept_id`)
          : [];
        const concepts = await tx.payConcept.findMany({
          where: { tenantId, id: { in: raw.map((r) => r.concept_id) } },
          select: { id: true, code: true, name: true, conceptType: true },
        });
        const byId = new Map(concepts.map((c) => [c.id, c]));
        const total = raw.reduce((s, r) => s + r.amt, 0);
        const rows: ConceptRow[] = raw
          .map((r) => {
            const c = byId.get(r.concept_id)!;
            const hidden = r.persons < MIN_PERSONS;
            return {
              id: c.id,
              code: c.code,
              name: c.name,
              type: c.conceptType,
              persons: r.persons,
              amount: hidden ? null : r.amt,
              share: hidden || total === 0 ? null : (Math.abs(r.amt) / Math.abs(total)) * 100,
            };
          })
          .sort((a, b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0) || a.code.localeCompare(b.code, "es", { numeric: true }));
        const anyHidden = rows.some((r) => r.amount === null);
        return { status: "ok", kind: "clase", period, currency, title, rows, total: anyHidden ? null : total } as const;
      }

      if (scope === "dim") {
        const dim = dimensions.find((d) => d.slug === segments[0]);
        const key = segments[1];
        if (!dim || segments.length !== 2 || !key || (key !== "none" && !/^\d+$/.test(key))) return { status: "notfound" } as const;
        const dims: Record<string, DimensionFilter> = { ...filters.dims };
        let title: string;
        if (key === "none") {
          dims[dim.code] = { ids: [], none: true };
          title = `${dim.name}: Sin asignar`;
        } else {
          const unit = await tx.hrOrgUnit.findFirst({
            where: { id: Number(key), tenantId, orgUnitTypeCode: dim.code, deletedAt: null },
            select: { name: true },
          });
          if (!unit) return { status: "notfound" } as const;
          dims[dim.code] = { ids: [Number(key)], none: false };
          title = `${dim.name}: ${unit.name}`;
        }
        const agg = await loadMonthly(tx, tenantId, config, dims, procs);
        const maxPersons = months.reduce((m, k) => Math.max(m, agg.get(k)?.persons ?? 0), 0);
        const restricted = maxPersons < MIN_PERSONS;
        const tot = basisTotals(config, agg, months);
        return {
          status: "ok",
          kind: "dim",
          period,
          currency,
          title,
          restricted,
          gross: restricted ? 0 : tot.gross,
          costPerPerson: restricted || tot.personMonths === 0 ? null : tot.gross / tot.personMonths,
          avgPersons: months.length ? tot.personMonths / months.length : null,
          composition: restricted ? { earnings: [], deductions: [], unclassified: null, earningsTotal: 0 } : buildComposition(config, agg, months),
        } as const;
      }

      // personas
      const like = params.q ? `%${params.q.replace(/[\\%_]/g, "\\$&")}%` : null;
      const search = like ? Prisma.sql`AND (p.full_name ILIKE ${like} OR p.employee_code ILIKE ${like})` : Prisma.empty;
      const limit = opts.all ? EXPORT_MAX_ROWS : PAGE_SIZE;
      const offset = opts.all ? 0 : (params.page - 1) * PAGE_SIZE;
      const at = Prisma.sql`${monthEnd(refMonth)}::date`;
      const unitCols = dimensions.length
        ? Prisma.sql`${Prisma.join(dimensions.map((dm, i) => Prisma.sql`${orgUnitNameAt(dm.code, at)} AS ${Prisma.raw(`u${i}`)}`), ", ")},`
        : Prisma.empty;
      const people = Prisma.sql`
        ${ppSql(tenantId, config, procs, filters.dims)},
        pm AS (SELECT person_id, SUM(basis) AS gross, SUM(net) AS net FROM pp GROUP BY person_id)`;
      const [tot] = await tx.$queryRaw<{ total: number }[]>(Prisma.sql`
        ${people}
        SELECT count(*)::int AS total FROM pm JOIN hr_people p ON p.id = pm.person_id
        WHERE pm.gross IS NOT NULL AND p.deleted_at IS NULL ${search}`);
      const rows = await tx.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        ${people}
        SELECT p.id, p.employee_code AS code, p.full_name AS name, ${unitCols} pm.gross::float8 AS gross, pm.net::float8 AS net
        FROM pm JOIN hr_people p ON p.id = pm.person_id
        WHERE pm.gross IS NOT NULL AND p.deleted_at IS NULL ${search}
        ORDER BY pm.gross DESC, p.id
        LIMIT ${limit} OFFSET ${offset}`);
      return {
        status: "ok",
        kind: "personas",
        period,
        currency,
        title: "Personas por masa bruta",
        hasNet: config.hasNet,
        total: tot?.total ?? 0,
        rows: rows.map((r) => ({
          id: r.id as number,
          code: r.code as string,
          name: r.name as string,
          units: Object.fromEntries(dimensions.map((dm, i) => [dm.code, (r[`u${i}`] as string | null) ?? null])),
          gross: r.gross as number,
          net: config.hasNet ? ((r.net as number | null) ?? 0) : null,
        })),
      } as const;
    },
    TX_OPTIONS
  );
}
