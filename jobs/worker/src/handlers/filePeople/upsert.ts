import type { Pool, PoolClient } from "pg";
import type { PersonRow } from "./types.js";
import { logger } from "../../utils/logger.js";

export interface UpsertStats {
  people_inserted: number;
  people_updated: number;
  org_units_upserted: number;
}

// hr_org_units: (tenant_id, org_unit_type_code, code) unique
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

// hr_people: no tiene manager_code — manager_id es FK a otra persona
// Se hace en 2 pasadas: primero upsert sin manager_id, después se actualiza
async function upsertPerson(
  client: PoolClient,
  tenantId: string,
  row: PersonRow,
): Promise<{ id: number; op: "inserted" | "updated" }> {
  const result = await client.query<{ id: number; xmax: string }>(`
    INSERT INTO hr_people (
      tenant_id, employee_code, full_name, hire_date, status,
      email, birth_date, gender, document_type, document_number,
      contract_type, updated_at
    ) VALUES (
      $1::uuid, $2::text, $3::text, $4::date, $5::text,
      $6::text, $7::date, $8::text, $9::text, $10::text,
      $11::text, now()
    )
    ON CONFLICT (tenant_id, employee_code)
    DO UPDATE SET
      full_name       = EXCLUDED.full_name,
      hire_date       = EXCLUDED.hire_date,
      status          = EXCLUDED.status,
      email           = EXCLUDED.email,
      birth_date      = EXCLUDED.birth_date,
      gender          = EXCLUDED.gender,
      document_type   = EXCLUDED.document_type,
      document_number = EXCLUDED.document_number,
      contract_type   = EXCLUDED.contract_type,
      updated_at      = now()
    RETURNING id, xmax::text
  `, [
    tenantId,
    row.employee_code,
    row.full_name,
    row.hire_date || null,
    row.status,
    row.email || null,
    row.birth_date || null,
    row.gender || null,
    row.document_type || null,
    row.document_number || null,
    row.contract_type || null,
  ]);

  const id = result.rows[0]!.id;
  const op = result.rows[0]!.xmax === "0" ? "inserted" : "updated";
  return { id, op };
}

// Segunda pasada: resolver manager_id por employee_code
async function resolveManagers(
  client: PoolClient,
  tenantId: string,
  rows: PersonRow[],
  codeToId: Map<string, number>
): Promise<void> {
  for (const row of rows) {
    if (!row.manager_code) continue;
    const managerId = codeToId.get(row.manager_code);
    if (!managerId) continue;
    const personId = codeToId.get(row.employee_code);
    if (!personId) continue;

    await client.query(`
      UPDATE hr_people SET manager_id = $2::int, updated_at = now()
      WHERE id = $1::int AND (manager_id IS DISTINCT FROM $2::int)
    `, [personId, managerId]);
  }
}

async function upsertOrgAssignment(
  client: PoolClient,
  tenantId: string,
  personId: number,
  orgUnitId: number
): Promise<void> {
  await client.query(`
    INSERT INTO hr_people_org_assignments (tenant_id, person_id, org_unit_id, is_current, updated_at)
    VALUES ($1::uuid, $2::int, $3::int, true, now())
    ON CONFLICT (tenant_id, person_id, org_unit_id)
    DO UPDATE SET is_current = true, updated_at = now()
  `, [tenantId, personId, orgUnitId]);
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

  const BATCH_SIZE = 50;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.current_tenant_id', $1::text, true)`, [tenantId]);

      const codeToId = new Map<string, number>();

      for (const row of batch) {
        // Org units
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

        // Persona (sin manager_id — se resuelve en segunda pasada)
        const { id: personId, op } = await upsertPerson(client, tenantId, row);
        codeToId.set(row.employee_code, personId);
        if (op === "inserted") stats.people_inserted++;
        else stats.people_updated++;

        // Asignaciones de org units
        if (areaOuId) await upsertOrgAssignment(client, tenantId, personId, areaOuId);
        if (positionOuId) await upsertOrgAssignment(client, tenantId, personId, positionOuId);
      }

      // Segunda pasada: resolver manager_id dentro del mismo batch
      await resolveManagers(client, tenantId, batch, codeToId);

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
