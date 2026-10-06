import type { PoolClient } from "pg";
import type { AbsenteeismRow } from "./types.js";
import { parseBool, parseDecimal } from "../shared/parseFile.js";

async function getPersonId(
  client: PoolClient,
  tenantId: string,
  employeeCode: string
): Promise<number | null> {
  const result = await client.query<{ id: number }>(
    `SELECT id FROM hr_people WHERE tenant_id = $1::uuid AND employee_code = $2::text LIMIT 1`,
    [tenantId, employeeCode]
  );
  return result.rows[0]?.id ?? null;
}

async function ensureAbsenteeismType(
  client: PoolClient,
  tenantId: string,
  code: string
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `INSERT INTO cfg_absenteeism_types (tenant_id, code, name, category)
     VALUES ($1::uuid, $2::text, $2::text, 'other')
     ON CONFLICT (tenant_id, code) DO NOTHING
     RETURNING id`,
    [tenantId, code]
  );
  if (result.rows[0]) return result.rows[0].id;
  const sel = await client.query<{ id: number }>(
    `SELECT id FROM cfg_absenteeism_types WHERE tenant_id = $1::uuid AND code = $2::text`,
    [tenantId, code]
  );
  return sel.rows[0].id;
}

async function upsertAbsenteeismEvent(
  client: PoolClient,
  tenantId: string,
  personId: number,
  absenteeismTypeId: number,
  row: AbsenteeismRow,
  sourceIntegrationId: number
): Promise<"inserted" | "updated"> {
  const justified = parseBool(row.justified ?? "0");
  const daysCount = parseDecimal(row.days_count ?? "0") ?? "0";
  const hoursCount = parseDecimal(row.hours_count ?? "0") ?? "0";
  const status = row.status || "open";

  // Check if record already exists (no unique constraint on this table)
  const existing = await client.query<{ id: number }>(
    `SELECT id FROM att_absenteeism_events
     WHERE tenant_id = $1::uuid AND person_id = $2::int AND absenteeism_type_id = $3::int AND start_date = $4::date
     LIMIT 1`,
    [tenantId, personId, absenteeismTypeId, row.start_date]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE att_absenteeism_events SET
        end_date              = $2::date,
        days_count            = $3::numeric,
        hours_count           = $4::numeric,
        justified             = $5::boolean,
        status                = $6::text,
        notes                 = $7::text,
        source_integration_id = $8::int,
        updated_at            = now()
       WHERE id = $1::int`,
      [existing.rows[0].id, row.end_date, daysCount, hoursCount, justified, status, row.notes ?? null, sourceIntegrationId]
    );
    return "updated";
  }

  await client.query(
    `INSERT INTO att_absenteeism_events (
      tenant_id, person_id, absenteeism_type_id,
      start_date, end_date, days_count, hours_count,
      justified, status, notes,
      source_integration_id, updated_at
    ) VALUES (
      $1::uuid, $2::int, $3::int,
      $4::date, $5::date, $6::numeric, $7::numeric,
      $8::boolean, $9::text, $10::text,
      $11::int, now()
    )`,
    [tenantId, personId, absenteeismTypeId, row.start_date, row.end_date, daysCount, hoursCount, justified, status, row.notes ?? null, sourceIntegrationId]
  );
  return "inserted";
}

export interface UpsertAbsenteeismResult {
  rows_read: number;
  rows_inserted: number;
  rows_updated: number;
  rows_skipped: number;
  rows_error: number;
  errors: Array<{ row: number; employee_code: string; message: string }>;
}

export async function upsertAbsenteeism(
  client: PoolClient,
  tenantId: string,
  sourceIntegrationId: number,
  rows: AbsenteeismRow[]
): Promise<UpsertAbsenteeismResult> {
  const result: UpsertAbsenteeismResult = {
    rows_read: rows.length,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    rows_error: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const personId = await getPersonId(client, tenantId, row.employee_code);
      if (!personId) {
        result.rows_skipped++;
        result.errors.push({ row: i + 1, employee_code: row.employee_code, message: `Persona no encontrada: ${row.employee_code}` });
        continue;
      }

      const absenteeismTypeId = await ensureAbsenteeismType(client, tenantId, row.absenteeism_type_code);
      const op = await upsertAbsenteeismEvent(client, tenantId, personId, absenteeismTypeId, row, sourceIntegrationId);

      if (op === "inserted") result.rows_inserted++;
      else result.rows_updated++;
    } catch (err: unknown) {
      result.rows_error++;
      result.errors.push({
        row: i + 1,
        employee_code: row.employee_code,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
