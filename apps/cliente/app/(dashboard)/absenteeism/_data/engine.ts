/**
 * Motor de cálculo del ausentismo (SQL). Todo el cálculo vive acá; las consultas del dashboard solo agregan.
 *
 * Modelo
 *  - Cada persona se divide en TRAMOS en los que no cambia ningún atributo que importe (turno, y las unidades
 *    usadas como filtro o agrupación). Un tramo va de max(ingreso, desde) a min(baja − 1, hasta): la persona
 *    deja de contar desde el día de la baja, igual que el headcount del Dashboard 1.
 *  - Cada tramo se parte por mes en PIEZAS. En cada pieza se cuentan los días laborables según la semana del
 *    turno vigente (o la de la empresa si no tiene turno) y las horas programadas = días × horas diarias.
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
  const groups = o.groupTypes ?? [];
  const types = [...new Set(["SHIFT", ...Object.keys(o.dims), ...groups])];
  const alias = new Map(types.map((t, i) => [t, `u${i}`]));

  // Una unión por tipo: la persona tiene como máximo una unidad de cada tipo en una fecha (restricción de no solapamiento)
  const joins = types.map(
    (t) => Prisma.sql`
      LEFT JOIN hr_people_org_assignments ${Prisma.raw(alias.get(t)!)}
        ON ${Prisma.raw(alias.get(t)!)}.tenant_id = ${T}::uuid
       AND ${Prisma.raw(alias.get(t)!)}.person_id = pr.person_id
       AND ${Prisma.raw(alias.get(t)!)}.org_unit_type_code = ${t}
       AND ${Prisma.raw(alias.get(t)!)}.valid_from <= pr.ps
       AND (${Prisma.raw(alias.get(t)!)}.valid_to IS NULL OR ${Prisma.raw(alias.get(t)!)}.valid_to >= pr.ps)`
  );
  const unitCol = (t: string) => Prisma.raw(`${alias.get(t)!}.org_unit_id`);

  const dimConds = Object.entries(o.dims).flatMap(([type, sel]) => {
    const conds: Prisma.Sql[] = [];
    if (sel.ids.length) conds.push(Prisma.sql`${unitCol(type)} IN (${Prisma.join(sel.ids)})`);
    if (sel.none) conds.push(Prisma.sql`${unitCol(type)} IS NULL`);
    return conds.length ? [Prisma.sql`(${Prisma.join(conds, " OR ")})`] : [];
  });
  const piecesWhere = dimConds.length ? Prisma.sql`WHERE ${Prisma.join(dimConds, " AND ")}` : Prisma.empty;

  const grpCols = groups.length
    ? Prisma.join(groups.map((g, i) => Prisma.sql`${unitCol(g)} AS ${Prisma.raw(`g${i}`)}`), ", ")
    : Prisma.sql`NULL::int AS g0`;
  const grpCarry = groups.length
    ? Prisma.join(groups.map((_, i) => Prisma.sql`ex.${Prisma.raw(`g${i}`)}`), ", ")
    : Prisma.sql`ex.g0`;
  const shiftCol = unitCol("SHIFT");

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
    WITH cfg AS (
      SELECT
        COALESCE((SELECT default_work_week FROM cfg_tenant_settings WHERE tenant_id = ${T}::uuid), '1111100') AS ww,
        COALESCE((SELECT default_daily_hours FROM cfg_tenant_settings WHERE tenant_id = ${T}::uuid), 8)::numeric AS dh
    ),
    win AS (
      SELECT p.id AS person_id,
             GREATEST(p.hire_date, ${o.from}::date) AS s,
             LEAST(COALESCE(p.termination_date - 1, ${o.to}::date), ${o.to}::date) AS e
      FROM hr_people p
      WHERE p.tenant_id = ${T}::uuid
        AND p.deleted_at IS NULL
        AND p.hire_date <= ${o.to}::date
        AND (p.termination_date IS NULL OR p.termination_date > ${o.from}::date)
    ),
    cuts AS (
      SELECT a.person_id, a.valid_from AS day
      FROM hr_people_org_assignments a
      WHERE a.tenant_id = ${T}::uuid AND a.org_unit_type_code IN (${Prisma.join(types)})
      UNION
      SELECT a.person_id, a.valid_to + 1
      FROM hr_people_org_assignments a
      WHERE a.tenant_id = ${T}::uuid AND a.org_unit_type_code IN (${Prisma.join(types)}) AND a.valid_to IS NOT NULL
    ),
    pts AS (
      SELECT person_id, s AS day FROM win WHERE s <= e
      UNION
      SELECT w.person_id, c.day
      FROM win w JOIN cuts c ON c.person_id = w.person_id
      WHERE w.s <= w.e AND c.day > w.s AND c.day <= w.e
    ),
    segs AS (
      SELECT pt.person_id, pt.day AS seg_start,
             COALESCE(LEAD(pt.day) OVER (PARTITION BY pt.person_id ORDER BY pt.day) - 1, w.e) AS seg_end
      FROM pts pt JOIN win w ON w.person_id = pt.person_id
    ),
    pr AS (
      SELECT sg.person_id, m.month_start::date AS month_start,
             GREATEST(sg.seg_start, m.month_start::date) AS ps,
             LEAST(sg.seg_end, (m.month_start + interval '1 month - 1 day')::date) AS pe
      FROM segs sg
      CROSS JOIN LATERAL generate_series(
        date_trunc('month', sg.seg_start)::date, date_trunc('month', sg.seg_end)::date, interval '1 month'
      ) AS m(month_start)
    ),
    expo AS (
      SELECT pr.person_id, pr.month_start, pr.ps, pr.pe,
             COALESCE(sh.work_week, cfg.ww) AS ww,
             COALESCE(sh.daily_hours, cfg.dh) AS dh,
             wla_workdays(pr.ps, pr.pe, COALESCE(sh.work_week, cfg.ww)) AS wd,
             ${grpCols}
      FROM pr
      CROSS JOIN cfg
      ${Prisma.join(joins, " ")}
      LEFT JOIN hr_shift_schedules sh ON sh.org_unit_id = ${shiftCol}
      ${piecesWhere}
    ),
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
      SELECT ev.event_id, ev.person_id, ev.class, ev.type_code, ev.counts, ev.in_scope, ex.month_start, ${grpCarry},
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
