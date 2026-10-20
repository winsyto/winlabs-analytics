import { z } from "zod";
import { withTenantContext } from "@wla/auth";
import { Prisma } from "@wla/db";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import type { DimensionFilter } from "../../_dashboard-kit/dimension-filters";
import type { PeriodRange } from "../../_dashboard-kit/period";
import { overtimeCtes } from "./engine";
import type { OvertimeFilters } from "./filters";
import type { DetailScope } from "./hrefs";
import { resolveRange, TX_OPTIONS } from "./queries";

export const PAGE_SIZE = 50;
export const EXPORT_MAX_ROWS = 20000;

/** Orden permitido. Por defecto, de más a menos horas (D-126: el control de excesos es un uso real). */
export const SORTS = {
  hours: "src.h",
  name: "p.full_name",
  code: "p.employee_code",
} as const;
export type SortKey = keyof typeof SORTS;

export const detailParamsSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).catch(1),
  q: z.string().trim().max(100).catch(""),
  s: z.enum(["hours", "name", "code"]).optional().catch(undefined),
  d: z.enum(["asc", "desc"]).optional().catch(undefined),
});
export type DetailParams = z.infer<typeof detailParamsSchema>;

/** Orden efectivo: horas de mayor a menor; por nombre o legajo, ascendente. */
export function effectiveSort(p: DetailParams): { s: SortKey; d: "asc" | "desc" } {
  const s: SortKey = p.s ?? "hours";
  const d = p.d ?? (s === "hours" ? "desc" : "asc");
  return { s, d };
}

/** Una persona y un tipo de hora: horas extra del período. */
export interface HoursRow {
  id: number;
  code: string;
  name: string;
  units: Record<string, string | null>;
  typeCode: string;
  typeName: string;
  hours: number;
}

export interface PersonRow {
  id: number;
  code: string;
  name: string;
  units: Record<string, string | null>;
  hours: number;
  /** Horas por tipo de hora, de mayor a menor */
  byType: { name: string; hours: number }[];
}

export type DetailData =
  | { status: "empty" }
  | { status: "notfound" }
  | { status: "ok"; kind: "hours"; period: PeriodRange; title: string; total: number; totalHours: number; rows: HoursRow[] }
  | { status: "ok"; kind: "people"; period: PeriodRange; title: string; total: number; totalHours: number; rows: PersonRow[] };

/** Nombre de la unidad de un tipo vigente en `at` (una fecha SQL) para la persona p. */
const orgUnitNameAt = (type: string, at: Prisma.Sql) =>
  Prisma.sql`(SELECT ou.name
    FROM hr_people_org_assignments a JOIN hr_org_units ou ON ou.id = a.org_unit_id
    WHERE a.person_id = p.id AND a.org_unit_type_code = ${type}
      AND a.valid_from <= ${at} AND (a.valid_to IS NULL OR a.valid_to >= ${at})
    ORDER BY a.valid_from DESC LIMIT 1)`;

/**
 * Listado de un drill-down del resumen (siempre las horas de la tasa, categoría hora extra, salvo el tipo no autorizado).
 *  - horas: una fila por persona y tipo de hora
 *  - personas: una fila por persona con sus horas extra y su desglose por tipo
 *  - tipo: personas con horas de ese tipo (segments = [código])
 *  - dim: personas de una unidad (segments = [slug de la dimensión, id de unidad | "none"])
 * Las horas son las del período y los filtros, calculadas por el mismo motor del resumen.
 */
export async function loadDetail(
  tenantId: string,
  filters: OvertimeFilters,
  dimensions: Dimension[],
  scope: DetailScope,
  segments: string[],
  params: DetailParams,
  opts: { all?: boolean } = {}
): Promise<DetailData> {
  return withTenantContext(
    tenantId,
    async (tx) => {
      const rng = await resolveRange(tx, tenantId, filters);
      if (!rng) return { status: "empty" } as const;
      const { period, curStart, curEnd } = rng;

      const typeRows = await tx.cfgTenantTimeEntryType.findMany({
        where: { tenantId, category: { in: ["overtime", "overtime_na"] } },
        select: { id: true, code: true, name: true, category: true },
      });

      // Filtros efectivos: el drill-down fija el tipo o la unidad elegidos
      const eff: { dims: Record<string, DimensionFilter>; types: string[] } = { dims: { ...filters.dims }, types: filters.types };
      let category = "overtime";
      let title: string;
      if (scope === "horas") title = "Horas extra por persona y tipo";
      else if (scope === "personas") title = "Personas con horas extra";
      else if (scope === "tipo") {
        const code = segments[0];
        if (!code || segments.length !== 1 || !/^[A-Za-z0-9_]{1,50}$/.test(code)) return { status: "notfound" } as const;
        const t = typeRows.find((x) => x.code === code);
        if (!t) return { status: "notfound" } as const;
        eff.types = [code];
        category = t.category;
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

      const engine = overtimeCtes({
        tenantId,
        from: curStart,
        to: curEnd,
        dims: eff.dims,
        types: eff.types,
        otTypeIds: typeRows.map((t) => t.id),
        groupTypes: [],
        base: "scheduled",
      });
      const inRange = Prisma.sql`category = ${category} AND in_scope AND month_start BETWEEN ${curStart}::date AND ${curEnd}::date`;
      const like = params.q ? `%${params.q.replace(/[\\%_]/g, "\\$&")}%` : null;
      const search = like ? Prisma.sql`AND (p.full_name ILIKE ${like} OR p.employee_code ILIKE ${like})` : Prisma.empty;
      const { s, d } = effectiveSort(params);
      const orderCol = Prisma.raw(SORTS[s]);
      const dir = Prisma.raw(d === "asc" ? "ASC" : "DESC");
      const limit = opts.all ? EXPORT_MAX_ROWS : PAGE_SIZE;
      const offset = opts.all ? 0 : (params.page - 1) * PAGE_SIZE;

      const at = Prisma.sql`LEAST(${curEnd}::date, COALESCE(p.termination_date - 1, ${curEnd}::date))`;
      const unitCols = dimensions.length
        ? Prisma.sql`${Prisma.join(dimensions.map((dm, i) => Prisma.sql`${orgUnitNameAt(dm.code, at)} AS ${Prisma.raw(`u${i}`)}`), ", ")},`
        : Prisma.empty;
      const unitsOf = (r: Record<string, unknown>) =>
        Object.fromEntries(dimensions.map((dm, i) => [dm.code, (r[`u${i}`] as string | null) ?? null]));

      const perType = Prisma.sql`, pt AS (
        SELECT person_id, type_code, SUM(hours) AS h
        FROM hrs WHERE ${inRange} GROUP BY person_id, type_code HAVING SUM(hours) > 0)`;
      const perPerson = Prisma.sql`, per_p AS (
        SELECT pt.person_id, SUM(pt.h) AS h,
               json_agg(json_build_object('name', COALESCE(t.name, pt.type_code), 'hours', pt.h) ORDER BY pt.h DESC) AS by_type
        FROM pt LEFT JOIN cfg_tenant_time_entry_types t ON t.tenant_id = ${tenantId}::uuid AND t.code = pt.type_code
        GROUP BY pt.person_id)`;

      if (scope === "horas") {
        const [tot] = await tx.$queryRaw<{ total: number; h: number }[]>(Prisma.sql`
          ${engine} ${perType}
          SELECT count(*)::int AS total, COALESCE(SUM(src.h), 0)::float8 AS h
          FROM pt src JOIN hr_people p ON p.id = src.person_id WHERE true ${search}`);
        const rows = await tx.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
          ${engine} ${perType}
          SELECT p.id, p.employee_code AS code, p.full_name AS name, ${unitCols}
                 src.type_code, COALESCE(t.name, src.type_code) AS type_name, src.h::float8 AS h
          FROM pt src
          JOIN hr_people p ON p.id = src.person_id
          LEFT JOIN cfg_tenant_time_entry_types t ON t.tenant_id = ${tenantId}::uuid AND t.code = src.type_code
          WHERE true ${search}
          ORDER BY ${orderCol} ${dir}, p.id, src.type_code
          LIMIT ${limit} OFFSET ${offset}`);
        return {
          status: "ok",
          kind: "hours",
          period,
          title,
          total: tot?.total ?? 0,
          totalHours: tot?.h ?? 0,
          rows: rows.map((r) => ({
            id: r.id as number,
            code: r.code as string,
            name: r.name as string,
            units: unitsOf(r),
            typeCode: r.type_code as string,
            typeName: r.type_name as string,
            hours: r.h as number,
          })),
        } as const;
      }

      const [tot] = await tx.$queryRaw<{ total: number; h: number }[]>(Prisma.sql`
        ${engine} ${perType} ${perPerson}
        SELECT count(*)::int AS total, COALESCE(SUM(src.h), 0)::float8 AS h
        FROM per_p src JOIN hr_people p ON p.id = src.person_id WHERE true ${search}`);
      const rows = await tx.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        ${engine} ${perType} ${perPerson}
        SELECT p.id, p.employee_code AS code, p.full_name AS name, ${unitCols}
               src.h::float8 AS h, src.by_type
        FROM per_p src JOIN hr_people p ON p.id = src.person_id
        WHERE true ${search}
        ORDER BY ${orderCol} ${dir}, p.id
        LIMIT ${limit} OFFSET ${offset}`);
      return {
        status: "ok",
        kind: "people",
        period,
        title,
        total: tot?.total ?? 0,
        totalHours: tot?.h ?? 0,
        rows: rows.map((r) => ({
          id: r.id as number,
          code: r.code as string,
          name: r.name as string,
          units: unitsOf(r),
          hours: r.h as number,
          byType: (r.by_type as { name: string; hours: number }[]) ?? [],
        })),
      } as const;
    },
    TX_OPTIONS
  );
}
