/**
 * Motor de cálculo del ausentismo (SQL). Todo el cálculo vive acá; las consultas del dashboard solo agregan.
 *
 * Modelo
 *  - Las personas, tramos y piezas (horas programadas) vienen de la exposición común del kit
 *    (`_dashboard-kit/exposure.ts`): cada persona se divide en tramos sin cambio de turno ni de unidades,
 *    y cada tramo en piezas por mes con sus días laborables y horas programadas.
 *  - Cada evento de ausencia se cruza con las piezas de su persona:
 *      horas de la pieza = días laborables de la pieza × horas por día × factor
 *        horas por día = horas del evento si es parcial (con tope en las horas diarias del turno) o las diarias
 *        factor        = días del evento ÷ días laborables del rango, si el archivo trae días; si no, 1
 *    Los días efectivos de la pieza son sus horas ÷ las horas diarias.
 *  - Filtros y agrupaciones por dimensión usan la unidad vigente de cada pieza (vigente en el día).
 *
 * No se tienen en cuenta feriados (ver docs/modules/dashboard-ausentismo.md).
 */
import { Prisma } from "@wla/db";
import { exposureCtes, groupCarry } from "../../_dashboard-kit/exposure";
import type { DimensionFilter } from "../../_dashboard-kit/dimension-filters";

export interface EngineOptions {
  tenantId: string;
  /** Primer y último día del rango a calcular (YYYY-MM-DD) */
  from: string;
  to: string;
  dims: Record<string, DimensionFilter>;
  /** Filtro de clases y tipos de ausencia: solo afectan a las ausencias que cuentan, no a las horas programadas */
  classes?: string[];
  types?: string[];
  /** Tipos de unidad por los que se agrupa: columnas `g0..gN` en las piezas (expo) y en las ausencias (absn) */
  groupTypes?: string[];
}

/**
 * Devuelve `WITH ... expo AS (...), absn AS (...)`. Quien lo usa agrega el SELECT final.
 *  expo: person_id, month_start, ps, pe, ww, dh, wd, g0..gN                   (horas programadas = wd * dh)
 *  absn: event_id, person_id, class, type_code, counts, in_scope, month_start, g0..gN, wd, dh, hours
 *        (días efectivos = hours / dh). `counts` = el tipo cuenta como ausentismo; `in_scope` = pasa el
 *        filtro de clase/tipo. Las ausencias de la tasa son las que tienen counts AND in_scope; las que no
 *        cuentan (vacaciones, licencias, francos) son las de NOT counts.
 */
export function engineCtes(o: EngineOptions): Prisma.Sql {
  const T = o.tenantId;

  const scope: Prisma.Sql[] = [];
  if (o.classes?.length) scope.push(Prisma.sql`t.class IN (${Prisma.join(o.classes)})`);
  if (o.types?.length) scope.push(Prisma.sql`t.code IN (${Prisma.join(o.types)})`);
  const inScope = scope.length ? Prisma.sql`(${Prisma.join(scope, " AND ")})` : Prisma.sql`true`;
  const evConds: Prisma.Sql[] = [
    Prisma.sql`e.tenant_id = ${T}::uuid`,
    Prisma.sql`e.status <> 'cancelled'`,
    Prisma.sql`e.start_date <= ${o.to}::date`,
    Prisma.sql`e.end_date >= ${o.from}::date`,
  ];

  return Prisma.sql`
    WITH ${exposureCtes(o)},
    ev AS (
      SELECT e.id AS event_id, e.person_id, e.start_date, e.end_date, e.days_count, e.hours_count,
             t.class, t.code AS type_code, t.counts_as_absence AS counts, ${inScope} AS in_scope,
             wla_workdays(e.start_date, e.end_date, COALESCE(evs.work_week, cfg.ww)) AS wd_event
      FROM att_absenteeism_events e
      JOIN cfg_absenteeism_types t ON t.id = e.absenteeism_type_id
      CROSS JOIN cfg
      LEFT JOIN (
        SELECT a.person_id, a.valid_from, a.valid_to, s.work_week
        FROM hr_people_org_assignments a
        JOIN hr_shift_schedules s ON s.org_unit_id = a.org_unit_id
        WHERE a.tenant_id = ${T}::uuid AND a.org_unit_type_code = 'SHIFT'
      ) evs
        ON evs.person_id = e.person_id AND evs.valid_from <= e.start_date
       AND (evs.valid_to IS NULL OR evs.valid_to >= e.start_date)
      WHERE ${Prisma.join(evConds, " AND ")}
    ),
    absn AS (
      SELECT ev.event_id, ev.person_id, ev.class, ev.type_code, ev.counts, ev.in_scope, ex.month_start, ${groupCarry(o.groupTypes)},
             wla_workdays(GREATEST(ex.ps, ev.start_date), LEAST(ex.pe, ev.end_date), ex.ww) AS wd,
             ex.dh,
             wla_workdays(GREATEST(ex.ps, ev.start_date), LEAST(ex.pe, ev.end_date), ex.ww)
               * (CASE WHEN ev.hours_count IS NULL THEN ex.dh ELSE LEAST(ev.hours_count, ex.dh) END)
               * (CASE WHEN ev.days_count IS NULL OR ev.wd_event = 0 THEN 1 ELSE ev.days_count / ev.wd_event END) AS hours
      FROM ev
      JOIN expo ex
        ON ex.person_id = ev.person_id AND ex.ps <= ev.end_date AND ex.pe >= ev.start_date
    )`;
}
