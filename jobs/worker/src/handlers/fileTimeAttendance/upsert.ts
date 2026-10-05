import type { PoolClient } from "pg";
import type { TimeAttendanceRow } from "./types.js";
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

async function upsertTimeDaily(
  client: PoolClient,
  tenantId: string,
  personId: number,
  row: TimeAttendanceRow,
  sourceIntegrationId: number
): Promise<"inserted" | "updated"> {
  const isWorkingDay = parseBool(row.is_working_day ?? "1");
  const hasAbsence = parseBool(row.has_absence ?? "0");
  const scheduledHours = parseDecimal(row.scheduled_hours ?? "0") ?? "0";
  const workedHours = parseDecimal(row.worked_hours) ?? "0";

  const result = await client.query<{ xmax: string }>(
    `INSERT INTO att_time_daily (
      tenant_id, person_id, date,
      is_working_day, scheduled_hours, worked_hours, has_absence,
      source_integration_id, updated_at
    ) VALUES (
      $1::uuid, $2::int, $3::date,
      $4::boolean, $5::numeric, $6::numeric, $7::boolean,
      $8::int, now()
    )
    ON CONFLICT (tenant_id, person_id, date)
    DO UPDATE SET
      is_working_day       = EXCLUDED.is_working_day,
      scheduled_hours      = EXCLUDED.scheduled_hours,
      worked_hours         = EXCLUDED.worked_hours,
      has_absence          = EXCLUDED.has_absence,
      source_integration_id = EXCLUDED.source_integration_id,
      updated_at           = now()
    RETURNING xmax::text`,
    [tenantId, personId, row.date, isWorkingDay, scheduledHours, workedHours, hasAbsence, sourceIntegrationId]
  );

  return result.rows[0]?.xmax === "0" ? "inserted" : "updated";
}

export interface UpsertTimeAttendanceResult {
  rows_read: number;
  rows_inserted: number;
  rows_updated: number;
  rows_skipped: number;
  rows_error: number;
  errors: Array<{ row: number; employee_code: string; message: string }>;
}

export async function upsertTimeAttendance(
  client: PoolClient,
  tenantId: string,
  sourceIntegrationId: number,
  rows: TimeAttendanceRow[]
): Promise<UpsertTimeAttendanceResult> {
  const result: UpsertTimeAttendanceResult = {
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

      const op = await upsertTimeDaily(client, tenantId, personId, row, sourceIntegrationId);
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
