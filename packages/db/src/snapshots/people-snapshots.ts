import type { Prisma } from "@prisma/client";

/**
 * Reconstruye los snapshots mensuales de hr_people_history para un rango de meses.
 * Las unidades organizativas se toman de las asignaciones vigentes a fin de mes (hr_people_org_assignments).
 * Cada snapshot representa el estado al CIERRE del mes (snapshot_date = primer día del mes):
 * incluye solo personas con ingreso <= fin de mes y sin egreso anterior o igual a esa fecha.
 * Debe ejecutarse dentro de withTenantContext.
 */
export async function rebuildPeopleSnapshots(
  tx: Prisma.TransactionClient,
  tenantId: string,
  fromMonth: string,
  toMonth: string
): Promise<number> {
  await tx.$executeRaw`
    DELETE FROM hr_people_history
    WHERE tenant_id = ${tenantId}::uuid
      AND snapshot_date BETWEEN ${fromMonth}::date AND ${toMonth}::date`;

  return tx.$executeRaw`
    INSERT INTO hr_people_history (
      tenant_id, snapshot_date, person_id, employee_code, status,
      org_assignments_snapshot, manager_id, salary_band, tenure_months, custom_fields_snapshot
    )
    SELECT
      p.tenant_id,
      m.month_start::date,
      p.id,
      p.employee_code,
      'active',
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'orgUnitId', a.org_unit_id,
          'orgUnitTypeCode', a.org_unit_type_code
        )), '[]'::jsonb)
        FROM hr_people_org_assignments a
        WHERE a.person_id = p.id
          AND a.valid_from <= (m.month_start + interval '1 month - 1 day')::date
          AND (a.valid_to IS NULL OR a.valid_to >= (m.month_start + interval '1 month - 1 day')::date)
      ),
      p.manager_id,
      p.salary_band,
      (
        EXTRACT(YEAR FROM age((m.month_start + interval '1 month - 1 day')::date, p.hire_date)) * 12
        + EXTRACT(MONTH FROM age((m.month_start + interval '1 month - 1 day')::date, p.hire_date))
      )::int,
      '{"source":"reconstructed"}'::jsonb
    FROM generate_series(${fromMonth}::date, ${toMonth}::date, interval '1 month') AS m(month_start)
    JOIN hr_people p
      ON p.tenant_id = ${tenantId}::uuid
     AND p.deleted_at IS NULL
     AND p.hire_date <= (m.month_start + interval '1 month - 1 day')::date
     AND (p.termination_date IS NULL
          OR p.termination_date > (m.month_start + interval '1 month - 1 day')::date)
    ON CONFLICT (tenant_id, snapshot_date, person_id) DO NOTHING`;
}
