import { z } from "zod";
import { withTenantContext } from "@wla/auth";
import { ABSENTEEISM_CLASSES, Prisma } from "@wla/db";
import { filterTokens, parseDimensionFilters, type DimensionFilter } from "../../../_dashboard-kit/dimension-filters";
import type { Dimension } from "../../../_dashboard-kit/dimensions";
import { monthEnd } from "../../../_dashboard-kit/period";
import { engineCtes } from "../../_data/engine";
import { lastClosedMonth } from "../../_data/queries";

/** Clases que cuentan como ausentismo (columnas "Ausentismo" del reporte); `personal` y `other` se agrupan en "Otras". */
export const COUNTING_CLASSES = ["unjustified", "unpaid", "medical", "accident", "suspension", "personal", "other"] as const;
const CLASS_CODES = ABSENTEEISM_CLASSES.map((c) => c.code);

export const MAX_RANGE_DAYS = 366;

export interface DateReportParams {
  from: string;
  to: string;
  /** Tipo de unidad de las filas; null = solo total general */
  groupBy: string | null;
  dims: Record<string, DimensionFilter>;
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isRealDate = (s: string) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/** Último día hábil (lunes a viernes) del mes de referencia: fecha por defecto del reporte. */
export function defaultReportDate(now: Date = new Date()): string {
  const d = new Date(`${monthEnd(lastClosedMonth(now))}T00:00:00Z`);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Lee y valida los parámetros de URL: fechas reales, rango máximo de un año y dimensión de filas existente. */
export function parseDateReportParams(
  sp: Record<string, string | string[] | undefined>,
  dimensions: Dimension[]
): DateReportParams {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const dflt = defaultReportDate();
  const okDate = (v: string | undefined) => (v && ymd.safeParse(v).success && isRealDate(v) ? v : null);
  const from = okDate(first(sp.from)) ?? dflt;
  let to = okDate(first(sp.to)) ?? from;
  if (to < from) to = from;
  const maxTo = new Date(Date.parse(`${from}T00:00:00Z`) + (MAX_RANGE_DAYS - 1) * 86400000).toISOString().slice(0, 10);
  if (to > maxTo) to = maxTo;
  const g = first(sp.g);
  const groupBy = g === "total" ? null : (dimensions.find((d) => d.slug === g)?.code ?? dimensions[0]?.code ?? null);
  return { from, to, groupBy, dims: parseDimensionFilters(sp, dimensions) };
}

export function dateReportQuery(p: DateReportParams, dimensions: Dimension[]): URLSearchParams {
  const q = new URLSearchParams();
  q.set("from", p.from);
  if (p.to !== p.from) q.set("to", p.to);
  const g = dimensions.find((d) => d.code === p.groupBy);
  q.set("g", g ? g.slug : "total");
  for (const [code, sel] of Object.entries(p.dims)) {
    const tokens = filterTokens(sel);
    if (tokens.length) q.set(`f_${code.toLowerCase()}`, tokens.join(","));
  }
  return q;
}

export interface DateReportRow {
  key: string;
  label: string;
  /** Dotación asignada: personas con día laborable según su turno (personas-día en un rango) */
  assigned: number;
  dayOff: number;
  vacation: number;
  legalLeave: number;
  unjustified: number;
  unpaid: number;
  medical: number;
  accident: number;
  suspension: number;
  other: number;
  /** Total de ausentes (clases que cuentan como ausentismo) */
  absent: number;
  /** Presentes estimados: dotación asignada menos francos, vacaciones, licencias y ausentes */
  present: number;
  /** % de ausentismo = ausentes ÷ dotación asignada */
  pct: number | null;
}

export type DateReportData =
  | { status: "empty" }
  | {
      status: "ok";
      params: DateReportParams;
      firstDate: string;
      singleDay: boolean;
      groupName: string | null;
      rows: DateReportRow[];
      total: DateReportRow;
      unclassifiedTypes: number;
      dimensionOptions: { code: string; name: string; slug: string; options: { value: string; label: string }[] }[];
    };

interface RawRow {
  g: number | null;
  assigned: number;
  [cls: string]: number | null;
}

function build(key: string, label: string, r: Record<string, number>): DateReportRow {
  const n = (k: string) => r[k] ?? 0;
  const absent = COUNTING_CLASSES.reduce((s, c) => s + n(c), 0);
  const assigned = n("assigned");
  const nonWork = n("day_off") + n("vacation") + n("legal_leave");
  return {
    key,
    label,
    assigned,
    dayOff: n("day_off"),
    vacation: n("vacation"),
    legalLeave: n("legal_leave"),
    unjustified: n("unjustified"),
    unpaid: n("unpaid"),
    medical: n("medical"),
    accident: n("accident"),
    suspension: n("suspension"),
    other: n("personal") + n("other"),
    absent,
    present: Math.max(0, assigned - nonWork - absent),
    pct: assigned > 0 ? (absent / assigned) * 100 : null,
  };
}

/**
 * Resumen por fecha y unidad. Usa el mismo motor que el dashboard: la dotación asignada son las personas con día
 * laborable según su turno, y cada ausencia se clasifica por su clase. Para un solo día, una persona con más de un
 * evento se cuenta una vez (prioridad al que cuenta como ausentismo); en un rango se suman las personas-día.
 */
export async function loadDateReport(
  tenantId: string,
  dimensions: Dimension[],
  params: DateReportParams
): Promise<DateReportData> {
  return withTenantContext(
    tenantId,
    async (tx) => {
      const [cov] = await tx.$queryRaw<{ first: string | null }[]>`
        SELECT to_char(min(start_date), 'YYYY-MM-DD') AS first
        FROM att_absenteeism_events WHERE tenant_id = ${tenantId}::uuid`;
      if (!cov?.first) return { status: "empty" } as const;

      const { from, to, groupBy } = params;
      const single = from === to;
      const groups = groupBy ? [groupBy] : [];
      const engine = engineCtes({ tenantId, from, to, dims: params.dims, groupTypes: groups });
      const classCols = Prisma.join(
        CLASS_CODES.map((c) => Prisma.sql`SUM(hours / dh) FILTER (WHERE class = ${c}) AS ${Prisma.raw(`c_${c}`)}`),
        ", "
      );
      const absences = single
        ? Prisma.sql`SELECT DISTINCT ON (person_id) person_id, class, g0, hours, dh
                     FROM absn WHERE hours > 0
                     ORDER BY person_id, (CASE WHEN counts THEN 0 ELSE 1 END), hours DESC`
        : Prisma.sql`SELECT person_id, class, g0, hours, dh FROM absn WHERE hours > 0`;
      const classSelect = Prisma.join(
        CLASS_CODES.map((c) => Prisma.sql`COALESCE(a.${Prisma.raw(`c_${c}`)}, 0)::float8 AS ${Prisma.raw(c)}`),
        ", "
      );

      const raw = await tx.$queryRaw<RawRow[]>(Prisma.sql`
        ${engine}
        , ab AS (${absences})
        SELECT COALESCE(s.g, a.g) AS g, COALESCE(s.assigned, 0)::float8 AS assigned, ${classSelect}
        FROM (SELECT g0 AS g, SUM(wd) AS assigned FROM expo GROUP BY 1) s
        FULL JOIN (SELECT g0 AS g, ${classCols} FROM ab GROUP BY 1) a ON COALESCE(a.g, -1) = COALESCE(s.g, -1)`);

      const unitNames = new Map<number, string>();
      if (groupBy) {
        const units = await tx.hrOrgUnit.findMany({
          where: { tenantId, orgUnitTypeCode: groupBy },
          select: { id: true, name: true },
        });
        for (const u of units) unitNames.set(u.id, u.name);
      }

      const toNums = (r: RawRow) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v ?? 0)]));
      const rows = raw
        .filter((r) => Number(r.assigned) > 0 || CLASS_CODES.some((c) => Number(r[c] ?? 0) > 0))
        .map((r) =>
          build(
            r.g === null ? "none" : String(r.g),
            groupBy ? (r.g === null ? "Sin asignar" : (unitNames.get(r.g) ?? `Unidad ${r.g}`)) : "Total",
            toNums(r)
          )
        )
        .sort((a, b) => {
          if ((a.key === "none") !== (b.key === "none")) return a.key === "none" ? 1 : -1;
          return b.assigned - a.assigned || a.label.localeCompare(b.label, "es");
        });

      const sum = (k: keyof DateReportRow) => rows.reduce((s, r) => s + (r[k] as number), 0);
      const totalNums: Record<string, number> = {
        assigned: sum("assigned"),
        day_off: sum("dayOff"),
        vacation: sum("vacation"),
        legal_leave: sum("legalLeave"),
        unjustified: sum("unjustified"),
        unpaid: sum("unpaid"),
        medical: sum("medical"),
        accident: sum("accident"),
        suspension: sum("suspension"),
        other: sum("other"),
        personal: 0,
      };
      const total = build("total", "Total general", totalNums);

      const codes = dimensions.map((d) => d.code);
      const units = codes.length
        ? await tx.hrOrgUnit.findMany({
            where: { tenantId, deletedAt: null, isActive: true, orgUnitTypeCode: { in: codes } },
            select: { id: true, name: true, orgUnitTypeCode: true },
            orderBy: { name: "asc" },
          })
        : [];
      const unclassifiedTypes = await tx.cfgAbsenteeismType.count({ where: { tenantId, isClassified: false } });

      return {
        status: "ok",
        params,
        firstDate: cov.first,
        singleDay: single,
        groupName: dimensions.find((d) => d.code === groupBy)?.name ?? null,
        rows,
        total,
        unclassifiedTypes,
        dimensionOptions: dimensions.map((d) => ({
          code: d.code,
          name: d.name,
          slug: d.slug,
          options: units.filter((u) => u.orgUnitTypeCode === d.code).map((u) => ({ value: String(u.id), label: u.name })),
        })),
      } as const;
    },
    { timeout: 60_000, maxWait: 10_000 }
  );
}
