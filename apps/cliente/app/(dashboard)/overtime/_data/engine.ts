/**
 * Motor de cálculo de horas extra (SQL). Todo el cálculo vive acá; las consultas del dashboard solo agregan.
 *
 * Modelo
 *  - Las piezas (persona × mes × tramo sin cambio de turno ni de unidades) y sus horas programadas vienen de la
 *    exposición común del kit (`_dashboard-kit/exposure.ts`).
 *  - COBERTURA: solo cuentan en el denominador las personas con horas informadas en el mes (al menos una fila de
 *    asistencia con horas por tipo). Así, si el sistema de origen exporta solo una parte de la empresa, la tasa no
 *    queda artificialmente baja. La cobertura es por persona y mes, no por día.
 *  - DENOMINADOR (base_hours): horas programadas de la pieza (días laborables × horas diarias del turno) o, si el
 *    tenant eligió `worked`, la suma de `worked_hours` de los días de la pieza.
 *  - NUMERADOR: horas por tipo de las categorías `overtime` (forman la tasa) y `overtime_na` (hora extra no
 *    autorizada: se informa aparte y NO entra en ninguna tasa). Cada hora cuenta en la unidad que la persona tenía
 *    ese día (la pieza contiene los días de un mismo tramo).
 *
 * No se tienen en cuenta feriados (ver docs/modules/dashboard-ausentismo.md).
 */
import { Prisma } from "@wla/db";
import { exposureCtes, groupCarry } from "../../_dashboard-kit/exposure";
import type { DimensionFilter } from "../../_dashboard-kit/dimension-filters";

export type OvertimeBase = "scheduled" | "worked";

export interface OvertimeEngineOptions {
  tenantId: string;
  /** Primer y último día del rango a calcular (YYYY-MM-DD) */
  from: string;
  to: string;
  dims: Record<string, DimensionFilter>;
  /** Filtro de tipos de hora: solo afecta al numerador, no al denominador */
  types?: string[];
  /** Ids de los tipos de hora del tenant de categoría overtime y overtime_na (se pasan como lista para que el plan parta de ellos) */
  otTypeIds: number[];
  /** Tipos de unidad por los que se agrupa: columnas `g0..gN` */
  groupTypes?: string[];
  base: OvertimeBase;
}

/**
 * Devuelve `WITH ... expo, cov, cexpo, den, hrs`. Quien lo usa agrega el SELECT final.
 *  expo:  piezas de todas las personas con horas programadas (cobertura o no)
 *  cexpo: piezas de las personas con horas informadas en el mes
 *  den:   cexpo + base_hours (denominador de la pieza)
 *  hrs:   person_id, month_start, ps, g0..gN, type_code, category, in_scope, hours
 *         (solo categorías overtime y overtime_na; `in_scope` = pasa el filtro de tipos)
 */
export function overtimeCtes(o: OvertimeEngineOptions): Prisma.Sql {
  const T = o.tenantId;
  const cx = groupCarry(o.groupTypes, "cx");
  const otTypes = o.otTypeIds.length ? Prisma.sql`en.time_entry_type_id IN (${Prisma.join(o.otTypeIds)})` : Prisma.sql`false`;
  const inScope = o.types?.length ? Prisma.sql`ot.type_code IN (${Prisma.join(o.types)})` : Prisma.sql`true`;

  const den =
    o.base === "worked"
      ? Prisma.sql`
    wk AS (
      SELECT cx.person_id, cx.ps, SUM(d.worked_hours) AS w
      FROM cexpo cx
      JOIN att_time_daily d
        ON d.tenant_id = ${T}::uuid AND d.person_id = cx.person_id AND d.date BETWEEN cx.ps AND cx.pe
      GROUP BY cx.person_id, cx.ps
    ),
    den AS (
      SELECT cx.*, COALESCE(wk.w, 0) AS base_hours
      FROM cexpo cx
      LEFT JOIN wk ON wk.person_id = cx.person_id AND wk.ps = cx.ps
    )`
      : Prisma.sql`
    den AS (
      SELECT cx.*, cx.wd * cx.dh AS base_hours
      FROM cexpo cx
    )`;

  return Prisma.sql`
    WITH ${exposureCtes(o)},
    cov AS (
      SELECT DISTINCT d.person_id, date_trunc('month', d.date)::date AS month_start
      FROM att_time_daily_entries en
      JOIN att_time_daily d ON d.id = en.time_daily_id
      WHERE en.tenant_id = ${T}::uuid
        AND d.date BETWEEN ${o.from}::date AND ${o.to}::date
    ),
    cexpo AS (
      SELECT ex.*
      FROM expo ex
      JOIN cov ON cov.person_id = ex.person_id AND cov.month_start = ex.month_start
    ),
    ${den},
    ote AS (
      SELECT d.person_id, d.date, t.code AS type_code, t.category, en.hours
      FROM att_time_daily_entries en
      JOIN cfg_tenant_time_entry_types t ON t.id = en.time_entry_type_id
      JOIN att_time_daily d ON d.id = en.time_daily_id
      WHERE en.tenant_id = ${T}::uuid
        AND ${otTypes}
        AND d.date BETWEEN ${o.from}::date AND ${o.to}::date
    ),
    hrs AS (
      SELECT cx.person_id, cx.month_start, cx.ps, ${cx},
             ot.type_code, ot.category, ${inScope} AS in_scope, SUM(ot.hours) AS hours
      FROM cexpo cx
      JOIN ote ot ON ot.person_id = cx.person_id AND ot.date BETWEEN cx.ps AND cx.pe
      GROUP BY cx.person_id, cx.month_start, cx.ps, ${cx}, ot.type_code, ot.category
    )`;
}
