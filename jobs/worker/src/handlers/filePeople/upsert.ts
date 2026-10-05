import type { Pool, PoolClient } from "pg";
import type { PersonRow } from "./types.js";
import { logger } from "../../utils/logger.js";

export interface UpsertStats {
  people_inserted: number;
  people_updated: number;
  org_units_upserted: number;
}

// Upsert de hr_org_units para area y position de una fila
async function upsertOrgUnit(
  client: PoolClient,
  tenantId: string,
  typeCode: string,
  code: string,
  name: string
): Promise<number | null> {
  if (!code || !name) return null;

  const result = await client.query<{ id: number }>(`
    INSERT INTO hr_org_units (tenant_id, org_unit_type_code, code, name, is_active, updated_at)
    VALUES ($1::uuid, $2::text, $3::text, $4::text, true, now())
    ON CONFLICT (tenant_id, org_unit_type_code, code)
    DO UPDATE SET name = EXCLUDED.name, is_active = true, updated_at = now()
    RETURNING id
  `, [tenantId, typeCode, code, name]);

  return result.rows[0]?.id ?? null;
}

// Upsert de una persona + sus asignaciones de org units
async function upsertPerson(
  client: PoolClient,
  tenantId: string,
  row: PersonRow,
  areaOuId: number | null,
  positionOuId: number | null
): Promise<"inserted" | "updated"> {
  const result = await client.query<{ xmax: string }>(`
    INSERT INTO hr_people (
      tenant_id, employee_code, full_name, hire_date, status,
      email, birth_date, gender, document_type, document_number,
      contract_type, manager_code, is_active, updated_at
    ) VALUES (
      $1::uuid, $2::text, $3::text, $4::date, $5::text,
      $6::text, $7::date, $8::text, $9::text, $10::text,
      $11::text, $12::text, true, now()
    )
    ON CONFLICT (tenant_id, employee_code)
    DO UPDATE SET
      full_name      = EXCLUDED.full_name,
      hire_date      = EXCLUDED.hire_date,
      status         = EXCLUDED.status,
      email          = EXCLUDED.email,
      birth_date     = EXCLUDED.birth_date,
      gender         = EXCLUDED.gender,
      document_type  = EXCLUDED.document_type,
      document_number = EXCLUDED.document_number,
      contract_type  = EXCLUDED.contract_type,
      manager_code   = EXCLUDED.manager_code,
      is_active      = true,
      updated_at     = now()
    RETURNING xmax::text
  `, [
    tenantId,
    row.employee_code,
    row.full_name,
    row.hire_date,
    row.status,
    row.email,
    row.birth_date,
    row.gender,
    row.document_type,
    row.document_number,
    row.contract_type,
    row.manager_code,
  ]);

  const personResult = await client.query<{ id: number }>(`
    SELECT id FROM hr_people WHERE tenant_id = $1::uuid AND employee_code = $2::text
  `, [tenantId, row.employee_code]);

  const personId = personResult.rows[0]?.id;

  // Upsert asignación de área si hay org_unit
  if (personId && areaOuId) {
    await client.query(`
      INSERT INTO hr_people_org_assignments (tenant_id, person_id, org_unit_id, is_current, updated_at)
      VALUES ($1::uuid, $2::int, $3::int, true, now())
      ON CONFLICT (tenant_id, person_id, org_unit_id)
      DO UPDATE SET is_current = true, updated_at = now()
    `, [tenantId, personId, areaOuId]);
  }

  if (personId && positionOuId) {
    await client.query(`
      INSERT INTO hr_people_org_assignments (tenant_id, person_id, org_unit_id, is_current, updated_at)
      VALUES ($1::uuid, $2::int, $3::int, true, now())
      ON CONFLICT (tenant_id, person_id, org_unit_id)
      DO UPDATE SET is_current = true, updated_at = now()
    `, [tenantId, personId, positionOuId]);
  }

  // xmax = 0 → INSERT, > 0 → UPDATE
  return result.rows[0]?.xmax === "0" ? "inserted" : "updated";
}

export async function upsertPeople(
  pool: Pool,
  tenantId: string,
  rows: PersonRow[]
): Promise<UpsertStats> {
  const stats: UpsertStats = {
    people_inserted: 0,
    people_updated: 0,
    org_units_upserted: 0,
  };

  // Procesar en lotes de 50 para no saturar la conexión
  const BATCH_SIZE = 50;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // El worker usa postgres superuser → bypasea RLS, pero igual seteamos el contexto
      // para que sea consistente con el resto de la plataforma
      await client.query(`SELECT set_config('app.current_tenant_id', $1::text, true)`, [tenantId]);

      for (const row of batch) {
        let areaOuId: number | null = null;
        let positionOuId: number | null = null;

        if (row.area_code && row.area_name) {
          areaOuId = await upsertOrgUnit(client, tenantId, "AREA", row.area_code, row.area_name);
          if (areaOuId) stats.org_units_upserted++;
        }
        if (row.position_code && row.position_name) {
          positionOuId = await upsertOrgUnit(client, tenantId, "POSITION", row.position_code, row.position_name);
          if (positionOuId) stats.org_units_upserted++;
        }

        const op = await upsertPerson(client, tenantId, row, areaOuId, positionOuId);
        if (op === "inserted") stats.people_inserted++;
        else stats.people_updated++;
      }

      await client.query("COMMIT");
      logger.info("batch upserted", { batch_start: i, batch_size: batch.length });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  return stats;
}
