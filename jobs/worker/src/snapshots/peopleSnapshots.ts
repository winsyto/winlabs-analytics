/**
 * Cierres mensuales de personas (hr_people_history).
 *
 * Cada snapshot es el estado al CIERRE de un mes (snapshot_date = primer día del mes): personas con ingreso
 * <= fin de mes y sin egreso anterior o igual a esa fecha, con las unidades organizativas VIGENTES a fin de mes
 * (hr_people_org_assignments). Se reconstruyen desde fechas de ingreso/egreso y asignaciones con vigencia.
 *
 * ⚠ La misma lógica SQL existe en packages/db/src/snapshots/people-snapshots.ts (la usa el seed de dev).
 *   Si se cambia una, cambiar la otra.
 */
import type { Pool, PoolClient } from "pg";
import { withTenantClient } from "../handlers/shared/orgSchema.js";
import { logger } from "../utils/logger.js";

/** Cantidad de meses cerrados que se mantienen (ventana de historia del dashboard). */
export const SNAPSHOT_WINDOW_MONTHS = 24;

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-01" desplazado n meses */
export function addMonths(ymd: string, n: number): string {
  const total = Number(ymd.slice(0, 4)) * 12 + (Number(ymd.slice(5, 7)) - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}-01`;
}

/** Primer día del último mes ya cerrado (el mes anterior al actual, UTC). */
export function lastClosedMonth(now: Date = new Date()): string {
  return addMonths(`${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-01`, -1);
}

export interface SnapshotResult {
  months: number;
  rows: number;
  from: string;
  to: string;
}

async function rebuildRange(client: PoolClient, tenantId: string, from: string, to: string): Promise<number> {
  await client.query(
    `DELETE FROM hr_people_history
     WHERE tenant_id = $1::uuid AND snapshot_date BETWEEN $2::date AND $3::date`,
    [tenantId, from, to]
  );
  const res = await client.query(
    `INSERT INTO hr_people_history (
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
     FROM generate_series($2::date, $3::date, interval '1 month') AS m(month_start)
     JOIN hr_people p
       ON p.tenant_id = $1::uuid
      AND p.deleted_at IS NULL
      AND p.hire_date <= (m.month_start + interval '1 month - 1 day')::date
      AND (p.termination_date IS NULL
           OR p.termination_date > (m.month_start + interval '1 month - 1 day')::date)
     ON CONFLICT (tenant_id, snapshot_date, person_id) DO NOTHING`,
    [tenantId, from, to]
  );
  return res.rowCount ?? 0;
}

/** Toma el lock del tenant; con wait=false devuelve false si otro proceso ya lo tiene. */
async function lockTenant(client: PoolClient, tenantId: string, wait: boolean): Promise<boolean> {
  if (wait) {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1::text))`, [`people_snapshots:${tenantId}`]);
    return true;
  }
  const res = await client.query<{ ok: boolean }>(
    `SELECT pg_try_advisory_xact_lock(hashtext($1::text)) AS ok`,
    [`people_snapshots:${tenantId}`]
  );
  return res.rows[0]!.ok;
}

async function firstHireMonth(client: PoolClient): Promise<string | null> {
  const res = await client.query<{ m: string | null }>(
    `SELECT to_char(date_trunc('month', min(hire_date)), 'YYYY-MM-DD') AS m FROM hr_people WHERE deleted_at IS NULL`
  );
  return res.rows[0]?.m ?? null;
}

function monthsBetween(from: string, to: string): number {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7))) + 1;
}

/**
 * Reconstruye la ventana completa (hasta 24 meses cerrados) del tenant. Se usa después de cargar
 * Personas o Historial de unidades, porque pueden cambiar cualquier mes de la ventana.
 * Devuelve null si el tenant no tiene personas con ingreso dentro de la ventana.
 */
export async function rebuildTenantSnapshots(pool: Pool, tenantId: string): Promise<SnapshotResult | null> {
  const to = lastClosedMonth();
  return withTenantClient(pool, tenantId, async (client) => {
    await lockTenant(client, tenantId, true);
    const first = await firstHireMonth(client);
    if (!first) return null;
    const windowStart = addMonths(to, -(SNAPSHOT_WINDOW_MONTHS - 1));
    const from = first > windowStart ? first : windowStart;
    if (from > to) return null;
    const rows = await rebuildRange(client, tenantId, from, to);
    return { months: monthsBetween(from, to), rows, from, to };
  });
}

/**
 * Cierre automático: genera solo los meses cerrados que faltan (o la ventana completa si el tenant nunca tuvo
 * snapshots). No hace nada si ya está al día o si otro proceso está trabajando en el mismo tenant.
 */
export async function ensureTenantSnapshots(pool: Pool, tenantId: string): Promise<SnapshotResult | null> {
  const to = lastClosedMonth();
  return withTenantClient(pool, tenantId, async (client) => {
    if (!(await lockTenant(client, tenantId, false))) return null;

    const first = await firstHireMonth(client);
    if (!first) return null;
    const windowStart = addMonths(to, -(SNAPSHOT_WINDOW_MONTHS - 1));
    const floor = first > windowStart ? first : windowStart;

    const latestRes = await client.query<{ latest: string | null }>(
      `SELECT to_char(max(snapshot_date), 'YYYY-MM-DD') AS latest FROM hr_people_history`
    );
    const latest = latestRes.rows[0]?.latest ?? null;
    let from = latest ? addMonths(latest, 1) : floor;
    if (from < floor) from = floor;
    if (from > to) return null;

    const rows = await rebuildRange(client, tenantId, from, to);
    return { months: monthsBetween(from, to), rows, from, to };
  });
}

/** Tick periódico: asegura el cierre de cada tenant activo. Un error en un tenant no frena a los demás. */
export async function runSnapshotTick(pool: Pool): Promise<void> {
  const tenants = await pool.query<{ id: string; slug: string }>(`SELECT id, slug FROM tenants WHERE is_active = true`);
  for (const t of tenants.rows) {
    try {
      const result = await ensureTenantSnapshots(pool, t.id);
      if (result) logger.info("snapshots: cierre generado", { tenant: t.slug, ...result });
    } catch (err) {
      logger.error("snapshots: error en el cierre del tenant", { tenant: t.slug, err: String(err) });
    }
  }
}
