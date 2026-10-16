import { z } from "zod";
import { withTenantContext } from "@wla/auth";
import { Prisma } from "@wla/db";
import { firstParam } from "../../../_dashboard-kit/dimension-filters";
import type { Dimension } from "../../../_dashboard-kit/dimensions";
import { engineCtes } from "../../_data/engine";
import { CLASS_LABELS, parseFilters, type AbsenteeismFilters } from "../../_data/filters";
import { filtersQuery } from "../../_data/hrefs";
import { resolveRange } from "../../_data/queries";
import type { AbsenceDisplay } from "../../_data/types";

export type Measure = "events" | "days" | "hours";

export interface TypeReportParams {
  filters: AbsenteeismFilters;
  /** Tipo de unidad de las columnas; null = solo total */
  groupBy: string | null;
  measure: Measure;
  /** Mostrar también los tipos sin ausencias en el período */
  showAll: boolean;
}

const measureSchema = z.enum(["events", "days", "hours"]);

/** Lee y valida los parámetros de URL (período y filtros del dashboard más columnas, medida y tipos sin datos). */
export function parseTypeReportParams(
  sp: Record<string, string | string[] | undefined>,
  dimensions: Dimension[],
  defaultMeasure: Measure = "events"
): TypeReportParams {
  const g = firstParam(sp.g);
  const m = measureSchema.safeParse(firstParam(sp.m));
  return {
    filters: parseFilters(sp, dimensions),
    groupBy: g === "total" ? null : (dimensions.find((d) => d.slug === g)?.code ?? dimensions[0]?.code ?? null),
    measure: m.success ? m.data : defaultMeasure,
    showAll: firstParam(sp.all) === "1",
  };
}

export function typeReportQuery(p: TypeReportParams, dimensions: Dimension[]): URLSearchParams {
  const q = filtersQuery(p.filters);
  const g = dimensions.find((d) => d.code === p.groupBy);
  q.set("g", g ? g.slug : "total");
  if (p.measure !== "events") q.set("m", p.measure);
  if (p.showAll) q.set("all", "1");
  return q;
}

export interface Cell {
  events: number;
  days: number;
  hours: number;
}

export interface TypeRow {
  code: string;
  name: string;
  className: string;
  /** Por unidad (clave de la columna) */
  cells: Record<string, Cell>;
  total: Cell;
}

export interface UnitColumn {
  key: string;
  label: string;
  /** Personas con horas programadas en el período */
  people: number;
}

export type TypeReportData =
  | { status: "empty" }
  | {
      status: "ok";
      params: TypeReportParams;
      periodLabel: string;
      display: AbsenceDisplay;
      groupName: string | null;
      columns: UnitColumn[];
      rows: TypeRow[];
      /** Total de ausencias por unidad y general (en las tres medidas) */
      totals: { byUnit: Record<string, Cell>; all: Cell };
      /** Personas con horas programadas en el período, sin repetir entre unidades */
      people: number;
      unclassifiedTypes: number;
      dimensionOptions: { code: string; name: string; slug: string; options: { value: string; label: string }[] }[];
      classOptions: { value: string; label: string }[];
      typeOptions: { value: string; label: string }[];
    };

const val = (c: Cell, m: Measure) => (m === "events" ? c.events : m === "days" ? c.days : c.hours);
export const cellValue = val;

/** Índices: la medida elegida cada 100 personas. */
export const per100 = (n: number, people: number) => (people > 0 ? (n / people) * 100 : null);

interface RawCell { t: string; g: number | null; ev: number; h: number; d: number }

export async function loadTypeReport(
  tenantId: string,
  dimensions: Dimension[],
  params: TypeReportParams
): Promise<TypeReportData> {
  return withTenantContext(
    tenantId,
    async (tx) => {
      const rng = await resolveRange(tx, tenantId, params.filters);
      if (!rng) return { status: "empty" } as const;
      const { curStart, curEnd, period } = rng;
      const groups = params.groupBy ? [params.groupBy] : [];
      const engine = engineCtes({
        tenantId,
        from: curStart,
        to: curEnd,
        dims: params.filters.dims,
        classes: params.filters.classes,
        types: params.filters.types,
        groupTypes: groups,
      });
      const counted = Prisma.sql`counts AND in_scope`;
      const [row] = await tx.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        ${engine}
        SELECT
          (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
             SELECT type_code AS t, g0 AS g, count(DISTINCT event_id) FILTER (WHERE hours > 0)::int AS ev,
                    SUM(hours)::float8 AS h, SUM(hours / dh)::float8 AS d
             FROM absn WHERE ${counted} GROUP BY 1, 2) x) AS cells,
          (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
             SELECT type_code AS t, count(DISTINCT event_id) FILTER (WHERE hours > 0)::int AS ev,
                    SUM(hours)::float8 AS h, SUM(hours / dh)::float8 AS d
             FROM absn WHERE ${counted} GROUP BY 1) x) AS type_totals,
          (SELECT row_to_json(x) FROM (
             SELECT count(DISTINCT event_id) FILTER (WHERE hours > 0)::int AS ev,
                    COALESCE(SUM(hours), 0)::float8 AS h, COALESCE(SUM(hours / dh), 0)::float8 AS d
             FROM absn WHERE ${counted}) x) AS grand,
          (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
             SELECT g0 AS g, count(DISTINCT person_id) FILTER (WHERE wd > 0)::int AS people
             FROM expo GROUP BY 1) x) AS people_by_unit,
          (SELECT count(DISTINCT person_id) FILTER (WHERE wd > 0)::int FROM expo) AS people_total,
          (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
             SELECT g0 AS g, count(DISTINCT event_id) FILTER (WHERE hours > 0)::int AS ev,
                    SUM(hours)::float8 AS h, SUM(hours / dh)::float8 AS d
             FROM absn WHERE ${counted} GROUP BY 1) x) AS unit_totals`);

      const cells = row!.cells as RawCell[];
      const typeTotals = row!.type_totals as { t: string; ev: number; h: number; d: number }[];
      const grand = row!.grand as { ev: number; h: number; d: number };
      const peopleByUnit = row!.people_by_unit as { g: number | null; people: number }[];
      const unitTotals = row!.unit_totals as { g: number | null; ev: number; h: number; d: number }[];
      const keyOf = (g: number | null) => (g === null ? "none" : String(g));
      const toCell = (x: { ev: number; h: number; d: number }): Cell => ({ events: x.ev, hours: x.h, days: x.d });
      const empty: Cell = { events: 0, days: 0, hours: 0 };

      const names = new Map<number, string>();
      if (params.groupBy) {
        const units = await tx.hrOrgUnit.findMany({
          where: { tenantId, orgUnitTypeCode: params.groupBy },
          select: { id: true, name: true },
        });
        for (const u of units) names.set(u.id, u.name);
      }

      const colKeys = new Set<string | null>(
        [...peopleByUnit.map((p) => p.g === null ? "none" : String(p.g)), ...unitTotals.map((u) => keyOf(u.g))]
      );
      const columns: UnitColumn[] = params.groupBy
        ? [...colKeys]
            .map((k) => {
              const id = k === "none" ? null : Number(k);
              return {
                key: k as string,
                label: id === null ? "Sin asignar" : (names.get(id) ?? `Unidad ${id}`),
                people: peopleByUnit.find((p) => keyOf(p.g) === k)?.people ?? 0,
              };
            })
            .sort((a, b) => (a.key === "none" ? 1 : b.key === "none" ? -1 : a.label.localeCompare(b.label, "es")))
        : [{ key: "none", label: "Total", people: (row!.people_total as number) ?? 0 }];

      const types = await tx.cfgAbsenteeismType.findMany({
        where: { tenantId, countsAsAbsence: true },
        select: { code: true, name: true, class: true },
        orderBy: { name: "asc" },
      });
      const totalOf = new Map(typeTotals.map((t) => [t.t, toCell(t)]));
      const rows: TypeRow[] = types
        .map((t) => ({
          code: t.code,
          name: t.name,
          className: CLASS_LABELS[t.class] ?? t.class,
          cells: Object.fromEntries(
            cells.filter((c) => c.t === t.code).map((c) => [keyOf(c.g), toCell(c)])
          ) as Record<string, Cell>,
          total: totalOf.get(t.code) ?? empty,
        }))
        .filter((r) => params.showAll || r.total.events > 0 || r.total.hours > 0)
        .sort((a, b) => val(b.total, params.measure) - val(a.total, params.measure) || a.name.localeCompare(b.name, "es"));

      const settings = await tx.cfgTenantSetting.findUnique({ where: { tenantId }, select: { absenceDisplay: true } });
      const dimOptions = dimensions.length
        ? await tx.hrOrgUnit.findMany({
            where: { tenantId, deletedAt: null, isActive: true, orgUnitTypeCode: { in: dimensions.map((d) => d.code) } },
            select: { id: true, name: true, orgUnitTypeCode: true },
            orderBy: { name: "asc" },
          })
        : [];

      const byUnit: Record<string, Cell> = {};
      for (const u of unitTotals) byUnit[keyOf(u.g)] = toCell(u);
      if (!params.groupBy) byUnit.none = toCell(grand);

      return {
        status: "ok",
        params,
        periodLabel: period.label,
        display: (settings?.absenceDisplay ?? "both") as AbsenceDisplay,
        groupName: dimensions.find((d) => d.code === params.groupBy)?.name ?? null,
        columns,
        rows,
        totals: { byUnit, all: toCell(grand) },
        people: (row!.people_total as number) ?? 0,
        unclassifiedTypes: await tx.cfgAbsenteeismType.count({ where: { tenantId, isClassified: false } }),
        dimensionOptions: dimensions.map((d) => ({
          code: d.code,
          name: d.name,
          slug: d.slug,
          options: dimOptions.filter((u) => u.orgUnitTypeCode === d.code).map((u) => ({ value: String(u.id), label: u.name })),
        })),
        classOptions: [...new Set(types.map((t) => t.class))].map((c) => ({ value: c, label: CLASS_LABELS[c] ?? c })),
        typeOptions: types.map((t) => ({ value: t.code, label: t.name })),
      } as const;
    },
    { timeout: 60_000, maxWait: 10_000 }
  );
}
