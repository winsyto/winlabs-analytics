import { z } from "zod";
import { withTenantContext } from "@wla/auth";
import { ABSENTEEISM_CLASSES, Prisma } from "@wla/db";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import type { DimensionFilter } from "../../_dashboard-kit/dimension-filters";
import type { PeriodRange } from "../../_dashboard-kit/period";
import { engineCtes } from "./engine";
import { CLASS_LABELS, type AbsenteeismFilters } from "./filters";
import type { DetailScope } from "./hrefs";
import { resolveRange } from "./queries";
import type { AbsenceDisplay } from "./types";

export const PAGE_SIZE = 50;
export const EXPORT_MAX_ROWS = 20000;

/** Orden permitido. No se ordena por cantidad de ausencia para no armar un ranking de personas. */
export const SORTS = {
  name: "p.full_name",
  code: "p.employee_code",
  start: "e.start_date",
} as const;
export type SortKey = keyof typeof SORTS;

export const detailParamsSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).catch(1),
  q: z.string().trim().max(100).catch(""),
  s: z.enum(["name", "code", "start"]).optional().catch(undefined),
  d: z.enum(["asc", "desc"]).optional().catch(undefined),
});
export type DetailParams = z.infer<typeof detailParamsSchema>;

/** Orden efectivo: por defecto, eventos por fecha de inicio descendente y personas por nombre. */
export function effectiveSort(scope: DetailScope, p: DetailParams): { s: SortKey; d: "asc" | "desc" } {
  const people = scope === "personas";
  const s: SortKey = p.s && !(people && p.s === "start") ? p.s : people ? "name" : "start";
  const d = p.d ?? (s === "start" ? "desc" : "asc");
  return { s, d };
}

export interface EventRow {
  id: number;
  personId: number;
  code: string;
  name: string;
  units: Record<string, string | null>;
  typeCode: string;
  typeName: string;
  className: string;
  start: string;
  end: string;
  status: string;
  hours: number;
  days: number;
}

export interface PersonRow {
  id: number;
  code: string;
  name: string;
  units: Record<string, string | null>;
  events: number;
  hours: number;
  days: number;
}

export type DetailData =
  | { status: "empty" }
  | { status: "notfound" }
  | {
      status: "ok";
      kind: "events";
      period: PeriodRange;
      display: AbsenceDisplay;
      title: string;
      total: number;
      totals: { hours: number; days: number };
      rows: EventRow[];
    }
  | {
      status: "ok";
      kind: "people";
      period: PeriodRange;
      display: AbsenceDisplay;
      title: string;
      total: number;
      totals: { hours: number; days: number };
      rows: PersonRow[];
    };

/** Nombre de la unidad de un tipo vigente en `at` (una fecha SQL) para la persona p. */
const orgUnitNameAt = (type: string, at: Prisma.Sql) =>
  Prisma.sql`(SELECT ou.name
    FROM hr_people_org_assignments a JOIN hr_org_units ou ON ou.id = a.org_unit_id
    WHERE a.person_id = p.id AND a.org_unit_type_code = ${type}
      AND a.valid_from <= ${at} AND (a.valid_to IS NULL OR a.valid_to >= ${at})
    ORDER BY a.valid_from DESC LIMIT 1)`;

/**
 * Listado de un drill-down del resumen.
 *  - eventos: eventos del período (con los filtros activos)
 *  - personas: personas con ausencia en el período, con sus totales
 *  - clase | tipo: eventos de esa clase o tipo (segments = [código])
 *  - dim: eventos de una unidad (segments = [slug de la dimensión, id de unidad | "none"])
 * Las horas y los días son los efectivos dentro del período y de los filtros, calculados por el mismo motor del resumen.
 */
export async function loadDetail(
  tenantId: string,
  filters: AbsenteeismFilters,
  dimensions: Dimension[],
  scope: DetailScope,
  segments: string[],
  params: DetailParams,
  opts: { all?: boolean; display?: AbsenceDisplay } = {}
): Promise<DetailData> {
  return withTenantContext(
    tenantId,
    async (tx) => {
      const rng = await resolveRange(tx, tenantId, filters);
      if (!rng) return { status: "empty" } as const;
      const { period, curStart, curEnd } = rng;

      // Filtros efectivos: el drill-down fija la clase, el tipo o la unidad elegidos
      const eff: { dims: Record<string, DimensionFilter>; classes: string[]; types: string[] } = {
        dims: { ...filters.dims },
        classes: filters.classes,
        types: filters.types,
      };
      let title: string;
      if (scope === "eventos") title = "Eventos de ausencia";
      else if (scope === "personas") title = "Personas con ausencias";
      else if (scope === "clase") {
        const code = segments[0];
        if (!code || segments.length !== 1 || !ABSENTEEISM_CLASSES.some((c) => c.code === code)) return { status: "notfound" } as const;
        eff.classes = [code];
        title = `Clase: ${CLASS_LABELS[code] ?? code}`;
      } else if (scope === "tipo") {
        const code = segments[0];
        if (!code || segments.length !== 1 || !/^[A-Za-z0-9_]{1,50}$/.test(code)) return { status: "notfound" } as const;
        const t = await tx.cfgAbsenteeismType.findFirst({ where: { tenantId, code }, select: { name: true } });
        if (!t) return { status: "notfound" } as const;
        eff.types = [code];
        title = `Tipo: ${t.name}`;
      } else {
        const dim = dimensions.find((d) => d.slug === segments[0]);
        const key = segments[1];
        if (!dim || segments.length !== 2 || !key || (key !== "none" && !/^\d+$/.test(key))) return { status: "notfound" } as const;
        if (key === "none") {
          eff.dims[dim.code] = { ids: [], none: true };
          title = `${dim.name}: Sin asignar`;
        } else {
          const unit = await tx.hrOrgUnit.findFirst({
            where: { id: Number(key), tenantId, orgUnitTypeCode: dim.code, deletedAt: null },
            select: { name: true },
          });
          if (!unit) return { status: "notfound" } as const;
          eff.dims[dim.code] = { ids: [Number(key)], none: false };
          title = `${dim.name}: ${unit.name}`;
        }
      }

      const settings = await tx.cfgTenantSetting.findUnique({ where: { tenantId }, select: { absenceDisplay: true } });
      const display = opts.display ?? ((settings?.absenceDisplay ?? "both") as AbsenceDisplay);
      const engine = engineCtes({ tenantId, from: curStart, to: curEnd, dims: eff.dims, classes: eff.classes, types: eff.types });
      const counted = Prisma.sql`counts AND in_scope`;
      const like = params.q ? `%${params.q.replace(/[\\%_]/g, "\\$&")}%` : null;
      const search = like ? Prisma.sql`AND (p.full_name ILIKE ${like} OR p.employee_code ILIKE ${like})` : Prisma.empty;
      const { s, d } = effectiveSort(scope, params);
      const orderCol = Prisma.raw(SORTS[s]);
      const dir = Prisma.raw(d === "asc" ? "ASC" : "DESC");
      const limit = opts.all ? EXPORT_MAX_ROWS : PAGE_SIZE;
      const offset = opts.all ? 0 : (params.page - 1) * PAGE_SIZE;

      const unitCols = (at: Prisma.Sql) =>
        dimensions.length
          ? Prisma.sql`${Prisma.join(dimensions.map((dm, i) => Prisma.sql`${orgUnitNameAt(dm.code, at)} AS ${Prisma.raw(`u${i}`)}`), ", ")},`
          : Prisma.empty;
      const unitsOf = (r: Record<string, unknown>) =>
        Object.fromEntries(dimensions.map((dm, i) => [dm.code, (r[`u${i}`] as string | null) ?? null]));

      if (scope === "personas") {
        const perPerson = Prisma.sql`, per_p AS (
          SELECT person_id, SUM(hours) AS h, SUM(hours / dh) AS d, count(DISTINCT event_id) FILTER (WHERE hours > 0) AS ev
          FROM absn WHERE ${counted} GROUP BY person_id HAVING SUM(hours) > 0)`;
        const [tot] = await tx.$queryRaw<{ total: number; h: number; d: number }[]>(Prisma.sql`
          ${engine} ${perPerson}
          SELECT count(*)::int AS total, COALESCE(SUM(pp.h), 0)::float8 AS h, COALESCE(SUM(pp.d), 0)::float8 AS d
          FROM per_p pp JOIN hr_people p ON p.id = pp.person_id WHERE true ${search}`);
        const at = Prisma.sql`LEAST(${curEnd}::date, COALESCE(p.termination_date - 1, ${curEnd}::date))`;
        const rows = await tx.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
          ${engine} ${perPerson}
          SELECT p.id, p.employee_code AS code, p.full_name AS name, ${unitCols(at)}
                 pp.ev::int AS events, pp.h::float8 AS h, pp.d::float8 AS dd
          FROM per_p pp JOIN hr_people p ON p.id = pp.person_id WHERE true ${search}
          ORDER BY ${orderCol} ${dir}, p.id
          LIMIT ${limit} OFFSET ${offset}`);
        return {
          status: "ok",
          kind: "people",
          period,
          display,
          title,
          total: tot?.total ?? 0,
          totals: { hours: tot?.h ?? 0, days: tot?.d ?? 0 },
          rows: rows.map((r) => ({
            id: r.id as number,
            code: r.code as string,
            name: r.name as string,
            units: unitsOf(r),
            events: r.events as number,
            hours: r.h as number,
            days: r.dd as number,
          })),
        } as const;
      }

      const perEvent = Prisma.sql`, per_ev AS (
        SELECT event_id, SUM(hours) AS h, SUM(hours / dh) AS d
        FROM absn WHERE ${counted} GROUP BY event_id HAVING SUM(hours) > 0)`;
      const [tot] = await tx.$queryRaw<{ total: number; h: number; d: number }[]>(Prisma.sql`
        ${engine} ${perEvent}
        SELECT count(*)::int AS total, COALESCE(SUM(pe.h), 0)::float8 AS h, COALESCE(SUM(pe.d), 0)::float8 AS d
        FROM per_ev pe
        JOIN att_absenteeism_events e ON e.id = pe.event_id
        JOIN hr_people p ON p.id = e.person_id WHERE true ${search}`);
      const rows = await tx.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        ${engine} ${perEvent}
        SELECT e.id, p.id AS person_id, p.employee_code AS code, p.full_name AS name, ${unitCols(Prisma.sql`e.start_date`)}
               t.code AS type_code, t.name AS type_name, t.class AS class,
               to_char(e.start_date, 'YYYY-MM-DD') AS start_date, to_char(e.end_date, 'YYYY-MM-DD') AS end_date,
               e.status, pe.h::float8 AS h, pe.d::float8 AS dd
        FROM per_ev pe
        JOIN att_absenteeism_events e ON e.id = pe.event_id
        JOIN hr_people p ON p.id = e.person_id
        JOIN cfg_absenteeism_types t ON t.id = e.absenteeism_type_id
        WHERE true ${search}
        ORDER BY ${orderCol} ${dir}, e.id
        LIMIT ${limit} OFFSET ${offset}`);
      return {
        status: "ok",
        kind: "events",
        period,
        display,
        title,
        total: tot?.total ?? 0,
        totals: { hours: tot?.h ?? 0, days: tot?.d ?? 0 },
        rows: rows.map((r) => ({
          id: r.id as number,
          personId: r.person_id as number,
          code: r.code as string,
          name: r.name as string,
          units: unitsOf(r),
          typeCode: r.type_code as string,
          typeName: r.type_name as string,
          className: CLASS_LABELS[r.class as string] ?? (r.class as string),
          start: r.start_date as string,
          end: r.end_date as string,
          status: r.status as string,
          hours: r.h as number,
          days: r.dd as number,
        })),
      } as const;
    },
    { timeout: 60_000, maxWait: 10_000 }
  );
}
