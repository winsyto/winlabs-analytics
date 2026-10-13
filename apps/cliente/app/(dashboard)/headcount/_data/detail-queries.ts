import { z } from "zod";
import { withTenantContext } from "@wla/auth";
import { Prisma } from "@wla/db";
import type { HeadcountFilters } from "./filters";
import type { DetailScope } from "./hrefs";
import { buildPeriod, monthEnd, type PeriodRange } from "./period";
import { personFilter, snapFilter } from "./queries";

export const PAGE_SIZE = 50;
export const EXPORT_MAX_ROWS = 20000;

export const SORTS = {
  name: "p.full_name",
  code: "p.employee_code",
  hire: "p.hire_date",
  term: "p.termination_date",
  tenure: "p.hire_date",
} as const;
export type SortKey = keyof typeof SORTS;

export const detailParamsSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).catch(1),
  q: z.string().trim().max(100).catch(""),
  s: z.enum(["name", "code", "hire", "term", "tenure"]).catch("name"),
  d: z.enum(["asc", "desc"]).catch("asc"),
});
export type DetailParams = z.infer<typeof detailParamsSchema>;

export interface PersonRow {
  id: number;
  code: string;
  name: string;
  area: string | null;
  location: string | null;
  position: string | null;
  contract: string | null;
  hireDate: string;
  terminationDate: string | null;
  reason: string | null;
  tenureMonths: number;
}

export interface Demographics {
  gender: { label: string; value: number }[];
  ageBands: { label: string; value: number }[];
  unknownAge: number;
}

export type DetailData =
  | { status: "empty" }
  | { status: "notfound" }
  | {
      status: "ok";
      period: PeriodRange;
      title: string;
      description: string;
      total: number;
      rows: PersonRow[];
      demographics: Demographics;
      showTermination: boolean;
    };

const CONTRACT_LABELS: Record<string, string> = {
  indefinido: "Indefinido",
  plazo_fijo: "Plazo fijo",
  temporal: "Temporal",
  contractor: "Contratista",
  sin_dato: "Sin dato",
};
const GENDER_LABELS: Record<string, string> = { F: "Femenino", M: "Masculino", X: "No binario / otro", no_decl: "No declarado" };

// Última asignación (por vigencia) de cada tipo de unidad organizativa
const orgUnitName = (type: string) =>
  Prisma.sql`(SELECT ou.name
    FROM hr_people_org_assignments a JOIN hr_org_units ou ON ou.id = a.org_unit_id
    WHERE a.person_id = p.id AND a.org_unit_type_code = ${type}
    ORDER BY a.valid_from DESC LIMIT 1)`;

export async function loadDetail(
  tenantId: string,
  filters: HeadcountFilters,
  scope: DetailScope,
  key: string | undefined,
  params: DetailParams,
  opts: { all?: boolean } = {}
): Promise<DetailData> {
  return withTenantContext(tenantId, async (tx) => {
    const latest = await tx.$queryRaw<{ ref: string | null }[]>`
      SELECT to_char(max(snapshot_date), 'YYYY-MM-DD') AS ref
      FROM hr_people_history WHERE tenant_id = ${tenantId}::uuid`;
    const refMonth = latest[0]?.ref;
    if (!refMonth) return { status: "empty" } as const;

    const period = buildPeriod(filters.p, refMonth);
    const end = monthEnd(refMonth);
    const fromTable = Prisma.sql`FROM hr_people p`;
    let pop: Prisma.Sql;
    let title: string;
    let description = period.label;
    let showTermination = false;

    const orgScope = (type: "AREA" | "LOCATION") => {
      if (key === "none") {
        return Prisma.sql`AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(h.org_assignments_snapshot) = 'array' THEN h.org_assignments_snapshot ELSE '[]'::jsonb END) se
          WHERE se->>'orgUnitTypeCode' = ${type})`;
      }
      return Prisma.sql`AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(h.org_assignments_snapshot) = 'array' THEN h.org_assignments_snapshot ELSE '[]'::jsonb END) se
        WHERE (se->>'orgUnitId')::int = ${Number(key)} AND COALESCE((se->>'isPrimary')::boolean, true))`;
    };

    const snapshotPop = (extra: Prisma.Sql) => Prisma.sql`
      FROM hr_people_history h
      JOIN hr_people p ON p.id = h.person_id
      WHERE h.tenant_id = ${tenantId}::uuid AND h.snapshot_date = ${refMonth}::date
      ${snapFilter(filters)} ${extra}`;

    if (scope === "altas" || scope === "bajas") {
      const col = Prisma.raw(scope === "altas" ? "p.hire_date" : "p.termination_date");
      pop = Prisma.sql`${fromTable}
        WHERE p.tenant_id = ${tenantId}::uuid AND p.deleted_at IS NULL
          AND ${col} BETWEEN ${period.start}::date AND ${end}::date
          ${personFilter(filters)}`;
      title = scope === "altas" ? "Altas del período" : "Bajas del período";
      showTermination = scope === "bajas";
    } else if (scope === "activos") {
      pop = snapshotPop(Prisma.empty);
      title = "Headcount al cierre";
    } else if (scope === "contrato") {
      if (!key) return { status: "notfound" } as const;
      pop = snapshotPop(Prisma.sql`AND COALESCE(p.contract_type, 'sin_dato') = ${key}`);
      title = `Contrato: ${CONTRACT_LABELS[key] ?? key}`;
    } else {
      const type = scope === "area" ? "AREA" : "LOCATION";
      if (!key || (key !== "none" && !/^\d+$/.test(key))) return { status: "notfound" } as const;
      if (key === "none") {
        title = `${scope === "area" ? "Área" : "Sede"}: Sin asignar`;
      } else {
        const unit = await tx.hrOrgUnit.findFirst({
          where: { id: Number(key), tenantId, orgUnitTypeCode: type, deletedAt: null },
          select: { name: true },
        });
        if (!unit) return { status: "notfound" } as const;
        title = `${scope === "area" ? "Área" : "Sede"}: ${unit.name}`;
      }
      pop = snapshotPop(orgScope(type));
    }
    if (scope !== "altas" && scope !== "bajas") description = `Cierre de ${period.refMonth.slice(0, 7)}`;

    const like = params.q ? `%${params.q.replace(/[\\%_]/g, "\\$&")}%` : null;
    const search = like
      ? Prisma.sql`AND (p.full_name ILIKE ${like} OR p.employee_code ILIKE ${like})`
      : Prisma.empty;

    const [{ total }] = await tx.$queryRaw<{ total: number }[]>(
      Prisma.sql`SELECT count(*)::int AS total ${pop} ${search}`
    );

    const demoRows = await tx.$queryRaw<{ gender: string | null; age: number | null; n: number }[]>(
      Prisma.sql`SELECT p.gender AS gender,
          CASE WHEN p.birth_date IS NULL THEN NULL
               ELSE CASE WHEN date_part('year', age(${end}::date, p.birth_date)) < 30 THEN 0
                         WHEN date_part('year', age(${end}::date, p.birth_date)) < 40 THEN 1
                         WHEN date_part('year', age(${end}::date, p.birth_date)) < 50 THEN 2
                         ELSE 3 END END AS age,
          count(*)::int AS n
        ${pop} ${search}
        GROUP BY 1, 2`
    );
    const genderMap = new Map<string, number>();
    const bands = [0, 0, 0, 0];
    let unknownAge = 0;
    for (const r of demoRows) {
      const g = r.gender ?? "no_decl";
      genderMap.set(g, (genderMap.get(g) ?? 0) + r.n);
      if (r.age === null) unknownAge += r.n;
      else bands[r.age] = (bands[r.age] ?? 0) + r.n;
    }

    const orderCol = Prisma.raw(SORTS[params.s]);
    const dir = Prisma.raw(
      params.s === "tenure" ? (params.d === "asc" ? "DESC" : "ASC") : params.d === "asc" ? "ASC" : "DESC"
    );
    const rows = await tx.$queryRaw<
      {
        id: number; code: string; name: string; area: string | null; location: string | null;
        position: string | null; contract: string | null; hire_date: string; termination_date: string | null;
        reason: string | null; tenure: number;
      }[]
    >(Prisma.sql`
      SELECT p.id, p.employee_code AS code, p.full_name AS name,
        ${orgUnitName("AREA")} AS area, ${orgUnitName("LOCATION")} AS location, ${orgUnitName("POSITION")} AS position,
        p.contract_type AS contract,
        to_char(p.hire_date, 'YYYY-MM-DD') AS hire_date,
        to_char(p.termination_date, 'YYYY-MM-DD') AS termination_date,
        (SELECT name FROM cfg_termination_reasons r WHERE r.code = p.termination_reason_code) AS reason,
        (date_part('year', age(COALESCE(p.termination_date, ${end}::date), p.hire_date)) * 12
          + date_part('month', age(COALESCE(p.termination_date, ${end}::date), p.hire_date)))::int AS tenure
      ${pop} ${search}
      ORDER BY ${orderCol} ${dir} NULLS LAST, p.id
      LIMIT ${opts.all ? EXPORT_MAX_ROWS : PAGE_SIZE} OFFSET ${opts.all ? 0 : (params.page - 1) * PAGE_SIZE}`);

    return {
      status: "ok",
      period,
      title,
      description,
      total,
      rows: rows.map((r) => ({
        id: r.id, code: r.code, name: r.name, area: r.area, location: r.location, position: r.position,
        contract: r.contract, hireDate: r.hire_date, terminationDate: r.termination_date,
        reason: r.reason, tenureMonths: r.tenure,
      })),
      demographics: {
        gender: [...genderMap].map(([g, value]) => ({ label: GENDER_LABELS[g] ?? g, value })).sort((a, b) => b.value - a.value),
        ageBands: [
          { label: "< 30", value: bands[0]! },
          { label: "30–39", value: bands[1]! },
          { label: "40–49", value: bands[2]! },
          { label: "50+", value: bands[3]! },
        ],
        unknownAge,
      },
      showTermination,
    } as const;
  });
}
