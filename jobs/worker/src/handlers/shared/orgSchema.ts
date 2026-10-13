import type { Pool, PoolClient } from "pg";

/** Valores por defecto si el tenant todavía no tiene configuración (igual a applyDefaultOrgConfig en @wla/db). */
export const DEFAULT_DIMENSION_TYPES = ["COMPANY", "LOCATION", "AREA", "POSITION", "CONTRACT"] as const;

export interface TenantOrgSchema {
  /** Tipos habilitados para el tenant (columnas aceptadas en el archivo) */
  enabledTypes: string[];
  /** Tipos que son dimensión de algún dashboard (columnas obligatorias) */
  requiredTypes: string[];
  /** Nombre legible por tipo, para mensajes de error */
  typeNames: Record<string, string>;
}

/** Ejecuta fn dentro de una transacción con el contexto de tenant (RLS) aplicado. */
export async function withTenantClient<T>(
  pool: Pool,
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.current_tenant_id', $1::text, true)`, [tenantId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function loadOrgSchema(pool: Pool, tenantId: string): Promise<TenantOrgSchema> {
  return withTenantClient(pool, tenantId, async (client) => {
    const types = await client.query<{ code: string; name: string }>(
      `SELECT code, name FROM cfg_org_unit_types WHERE is_active = true ORDER BY sort_order`
    );
    const typeNames = Object.fromEntries(types.rows.map((t) => [t.code, t.name]));

    const enabled = await client.query<{ org_unit_type_code: string }>(
      `SELECT org_unit_type_code FROM cfg_tenant_org_unit_types
       WHERE tenant_id = $1::uuid AND is_enabled = true ORDER BY sort_order`,
      [tenantId]
    );
    const dims = await client.query<{ org_unit_type_code: string }>(
      `SELECT DISTINCT org_unit_type_code FROM dsh_dimensions WHERE tenant_id = $1::uuid`,
      [tenantId]
    );

    const hasConfig = enabled.rows.length > 0;
    const enabledTypes = hasConfig
      ? enabled.rows.map((r) => r.org_unit_type_code)
      : [...DEFAULT_DIMENSION_TYPES];
    const requiredTypes = dims.rows.length > 0
      ? dims.rows.map((r) => r.org_unit_type_code)
      : [...DEFAULT_DIMENSION_TYPES];

    // Una dimensión siempre cuenta como habilitada
    for (const t of requiredTypes) if (!enabledTypes.includes(t)) enabledTypes.push(t);

    return { enabledTypes, requiredTypes, typeNames };
  });
}

export async function loadTerminationReasons(pool: Pool): Promise<Set<string>> {
  const res = await pool.query<{ code: string }>(
    `SELECT code FROM cfg_termination_reasons WHERE is_active = true`
  );
  return new Set(res.rows.map((r) => r.code));
}

/** Código de columna del archivo para un tipo: AREA -> area_code / area_name */
export const typeCodeColumn = (type: string) => `${type.toLowerCase()}_code`;
export const typeNameColumn = (type: string) => `${type.toLowerCase()}_name`;

/** Fecha de hoy (UTC) en YYYY-MM-DD y utilidades de fechas */
export const todayIso = () => new Date().toISOString().slice(0, 10);

export function addDaysIso(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
