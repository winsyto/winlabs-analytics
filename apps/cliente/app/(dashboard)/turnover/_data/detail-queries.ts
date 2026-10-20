import { z } from "zod";
import { withTenantContext } from "@wla/auth";
import { Prisma } from "@wla/db";
import type { Dimension } from "../../_dashboard-kit/dimensions";
import type { DimensionFilter } from "../../_dashboard-kit/dimension-filters";
import { monthEnd, type PeriodRange } from "../../_dashboard-kit/period";
import { eventFilter } from "../../_dashboard-kit/snapshot-filters";
import { CATEGORY_CODES, CATEGORY_LABELS, UNSPECIFIED_LABEL, type TurnoverFilters } from "./filters";
import type { DetailScope } from "./hrefs";
import { EARLY_MONTHS, reasonFilters, resolveRange, TENURE_MONTHS, TX_OPTIONS } from "./queries";

export const PAGE_SIZE = 50;
export const EXPORT_MAX_ROWS = 20000;

/** Valor de la URL para las bajas sin motivo */
export const UNSPECIFIED_KEY = "unspecified";

export const SORTS = {
  term: "p.termination_date",
  name: "p.full_name",
  code: "p.employee_code",
  tenure: "tenure",
} as const;
export type SortKey = keyof typeof SORTS;

export const detailParamsSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).catch(1),
  q: z.string().trim().max(100).catch(""),
  s: z.enum(["term", "name", "code", "tenure"]).optional().catch(undefined),
  d: z.enum(["asc", "desc"]).optional().catch(undefined),
});
export type DetailParams = z.infer<typeof detailParamsSchema>;

/** Orden efectivo: por defecto, fecha de baja de la más reciente a la más antigua. */
export function effectiveSort(p: DetailParams): { s: SortKey; d: "asc" | "desc" } {
  const s: SortKey = p.s ?? "term";
  const d = p.d ?? (s === "term" || s === "tenure" ? "desc" : "asc");
  return { s, d };
}

export interface BajaRow {
  id: number;
  code: string;
  name: string;
  /** Unidad por tipo de dimensión, vigente en la fecha de la baja */
  units: Record<string, string | null>;
  hireDate: string;
  terminationDate: string;
  reason: string;
  category: string;
  tenureMonths: number;
}

export type DetailData =
  | { status: "empty" }
  | { status: "notfound" }
  | { status: "ok"; period: PeriodRange; title: string; total: number; early: number; rows: BajaRow[] };

/** Nombre de la unidad de un tipo vigente en `at` (una fecha SQL) para la persona p. */
const orgUnitNameAt = (type: string, at: Prisma.Sql) =>
  Prisma.sql`(SELECT ou.name
    FROM hr_people_org_assignments a JOIN hr_org_units ou ON ou.id = a.org_unit_id
    WHERE a.person_id = p.id AND a.org_unit_type_code = ${type}
      AND a.valid_from <= ${at} AND (a.valid_to IS NULL OR a.valid_to >= ${at})
    ORDER BY a.valid_from DESC LIMIT 1)`;

/**
 * Listado de bajas de un drill-down del resumen (período efectivo con apertura y filtros del dashboard).
 *  - bajas: todas las del período
 *  - tempranas: las de menos de 12 meses de antigüedad
 *  - categoria | motivo: las de esa categoría o motivo (segments = [código | "unspecified"])
 *  - dim: las de una unidad en la fecha de la baja (segments = [slug de la dimensión, id de unidad | "none"])
 */
export async function loadDetail(
  tenantId: string,
  filters: TurnoverFilters,
  dimensions: Dimension[],
  scope: DetailScope,
  segments: string[],
  params: DetailParams,
  opts: { all?: boolean } = {}
): Promise<DetailData> {
  return withTenantContext(
    tenantId,
    async (tx) => {
      const { range } = await resolveRange(tx, tenantId, filters);
      if (!range) return { status: "empty" } as const;
      const { period, effStart, refMonth } = range;
      const end = monthEnd(refMonth);

      const eff: { dims: Record<string, DimensionFilter>; categories: string[]; reasons: string[] } = {
        dims: { ...filters.dims },
        categories: filters.categories,
        reasons: filters.reasons,
      };
      let extra: Prisma.Sql = Prisma.empty;
      let title: string;
      if (scope === "bajas") title = "Bajas del período";
      else if (scope === "tempranas") {
        title = "Bajas tempranas (menos de 1 año de antigüedad)";
        extra = Prisma.sql`AND ${TENURE_MONTHS} < ${EARLY_MONTHS}`;
      } else if (scope === "categoria") {
        const code = segments[0];
        if (!code || segments.length !== 1 || (code !== UNSPECIFIED_KEY && !CATEGORY_CODES.includes(code))) return { status: "notfound" } as const;
        extra = code === UNSPECIFIED_KEY ? Prisma.sql`AND r.category IS NULL` : Prisma.sql`AND r.category = ${code}`;
        title = `Categoría: ${code === UNSPECIFIED_KEY ? UNSPECIFIED_LABEL : CATEGORY_LABELS[code]}`;
      } else if (scope === "motivo") {
        const code = segments[0];
        if (!code || segments.length !== 1 || !/^[A-Za-z0-9_]{1,50}$/.test(code)) return { status: "notfound" } as const;
        if (code === UNSPECIFIED_KEY) {
          extra = Prisma.sql`AND p.termination_reason_code IS NULL`;
          title = `Motivo: ${UNSPECIFIED_LABEL}`;
        } else {
          const reason = await tx.cfgTerminationReason.findUnique({ where: { code }, select: { name: true } });
          if (!reason) return { status: "notfound" } as const;
          extra = Prisma.sql`AND p.termination_reason_code = ${code}`;
          title = `Motivo: ${reason.name}`;
        }
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

      const like = params.q ? `%${params.q.replace(/[\\%_]/g, "\\$&")}%` : null;
      const search = like ? Prisma.sql`AND (p.full_name ILIKE ${like} OR p.employee_code ILIKE ${like})` : Prisma.empty;
      const { s, d } = effectiveSort(params);
      const orderCol = Prisma.raw(SORTS[s]);
      const dir = Prisma.raw(d === "asc" ? "ASC" : "DESC");
      const limit = opts.all ? EXPORT_MAX_ROWS : PAGE_SIZE;
      const offset = opts.all ? 0 : (params.page - 1) * PAGE_SIZE;
      const at = Prisma.sql`p.termination_date`;
      const unitCols = dimensions.length
        ? Prisma.sql`${Prisma.join(dimensions.map((dm, i) => Prisma.sql`${orgUnitNameAt(dm.code, at)} AS ${Prisma.raw(`u${i}`)}`), ", ")},`
        : Prisma.empty;

      const from = Prisma.sql`
        FROM hr_people p
        LEFT JOIN cfg_termination_reasons r ON r.code = p.termination_reason_code
        WHERE p.tenant_id = ${tenantId}::uuid AND p.deleted_at IS NULL
          AND p.termination_date BETWEEN ${effStart}::date AND ${end}::date
          ${eventFilter({ dims: eff.dims }, "p.termination_date")}
          ${reasonFilters(eff)}
          ${extra} ${search}`;

      const [tot] = await tx.$queryRaw<{ total: number; early: number }[]>(Prisma.sql`
        SELECT count(*)::int AS total, (count(*) FILTER (WHERE ${TENURE_MONTHS} < ${EARLY_MONTHS}))::int AS early ${from}`);
      const rows = await tx.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        SELECT p.id, p.employee_code AS code, p.full_name AS name, ${unitCols}
               to_char(p.hire_date, 'YYYY-MM-DD') AS hire_date, to_char(p.termination_date, 'YYYY-MM-DD') AS term_date,
               (SELECT name FROM cfg_termination_reasons rr WHERE rr.code = p.termination_reason_code) AS reason,
               r.category AS category, ${TENURE_MONTHS} AS tenure
        ${from}
        ORDER BY ${orderCol} ${dir}, p.id
        LIMIT ${limit} OFFSET ${offset}`);

      return {
        status: "ok",
        period,
        title,
        total: tot?.total ?? 0,
        early: tot?.early ?? 0,
        rows: rows.map((r) => ({
          id: r.id as number,
          code: r.code as string,
          name: r.name as string,
          units: Object.fromEntries(dimensions.map((dm, i) => [dm.code, (r[`u${i}`] as string | null) ?? null])),
          hireDate: r.hire_date as string,
          terminationDate: r.term_date as string,
          reason: (r.reason as string | null) ?? UNSPECIFIED_LABEL,
          category: r.category ? (CATEGORY_LABELS[r.category as string] ?? (r.category as string)) : UNSPECIFIED_LABEL,
          tenureMonths: r.tenure as number,
        })),
      } as const;
    },
    TX_OPTIONS
  );
}
