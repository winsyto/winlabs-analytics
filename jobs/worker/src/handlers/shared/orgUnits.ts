import type { Pool } from "pg";
import { withTenantClient } from "./orgSchema.js";

export interface OrgUnitDef {
  type: string;
  code: string;
  name: string | null;
}

export const unitKey = (type: string, code: string) => `${type}|${code}`;

/**
 * Crea o actualiza unidades organizativas (una por tipo+código). Si se informa nombre se actualiza;
 * si no, se conserva el existente (o el código como nombre inicial).
 * Devuelve un mapa "TIPO|código" → id.
 */
export async function upsertOrgUnitDefs(
  pool: Pool,
  tenantId: string,
  rawDefs: OrgUnitDef[]
): Promise<Map<string, number>> {
  const defs = new Map<string, OrgUnitDef>();
  for (const d of rawDefs) {
    const key = unitKey(d.type, d.code);
    const prev = defs.get(key);
    if (!prev) defs.set(key, { ...d });
    else if (!prev.name && d.name) prev.name = d.name;
  }

  return withTenantClient(pool, tenantId, async (client) => {
    const ids = new Map<string, number>();
    for (const [key, d] of defs) {
      const res = await client.query<{ id: number }>(
        `INSERT INTO hr_org_units (tenant_id, org_unit_type_code, code, name, level, is_active, updated_at)
         VALUES ($1::uuid, $2::text, $3::text, $4::text, 0, true, now())
         ON CONFLICT (tenant_id, org_unit_type_code, code)
         DO UPDATE SET
           name = CASE WHEN $5::boolean THEN EXCLUDED.name ELSE hr_org_units.name END,
           is_active = true,
           updated_at = now()
         RETURNING id`,
        [tenantId, d.type, d.code, d.name ?? d.code, d.name !== null]
      );
      ids.set(key, res.rows[0]!.id);
    }
    return ids;
  });
}
