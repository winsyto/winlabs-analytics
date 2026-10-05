import type { PoolClient } from "pg";
import type { PayrollRow } from "./types.js";
import { parseDecimal } from "../shared/parseFile.js";

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

async function upsertPeriod(
  client: PoolClient,
  tenantId: string,
  row: PayrollRow
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `INSERT INTO pay_periods (tenant_id, period_code, start_date, end_date)
     VALUES ($1::uuid, $2::text, $3::date, $4::date)
     ON CONFLICT (tenant_id, period_code) DO UPDATE SET
       start_date = EXCLUDED.start_date,
       end_date   = EXCLUDED.end_date,
       updated_at = now()
     RETURNING id`,
    [tenantId, row.period_code, row.period_start, row.period_end]
  );
  return result.rows[0].id;
}

async function upsertConcept(
  client: PoolClient,
  tenantId: string,
  row: PayrollRow
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `INSERT INTO pay_concepts (tenant_id, code, name, category)
     VALUES ($1::uuid, $2::text, $3::text, $4::text)
     ON CONFLICT (tenant_id, code) DO UPDATE SET
       name     = EXCLUDED.name,
       category = EXCLUDED.category
     RETURNING id`,
    [tenantId, row.concept_code, row.concept_name, row.concept_category]
  );
  return result.rows[0].id;
}

async function upsertEntry(
  client: PoolClient,
  tenantId: string,
  periodId: number,
  personId: number,
  conceptId: number,
  row: PayrollRow,
  sourceIntegrationId: number
): Promise<"inserted" | "updated"> {
  const amount = parseDecimal(row.amount) ?? "0";
  const hours = row.hours ? parseDecimal(row.hours) : null;

  const result = await client.query<{ xmax: string }>(
    `INSERT INTO pay_entries (
      tenant_id, period_id, person_id, concept_id,
      amount, hours, source_integration_id
    ) VALUES (
      $1::uuid, $2::int, $3::int, $4::int,
      $5::numeric, $6::numeric, $7::int
    )
    ON CONFLICT (tenant_id, period_id, person_id, concept_id)
    DO UPDATE SET
      amount               = EXCLUDED.amount,
      hours                = EXCLUDED.hours,
      source_integration_id = EXCLUDED.source_integration_id
    RETURNING xmax::text`,
    [tenantId, periodId, personId, conceptId, amount, hours, sourceIntegrationId]
  );

  return result.rows[0]?.xmax === "0" ? "inserted" : "updated";
}

export interface UpsertPayrollResult {
  rows_read: number;
  rows_inserted: number;
  rows_updated: number;
  rows_skipped: number;
  rows_error: number;
  errors: Array<{ row: number; employee_code: string; message: string }>;
}

export async function upsertPayroll(
  client: PoolClient,
  tenantId: string,
  sourceIntegrationId: number,
  rows: PayrollRow[]
): Promise<UpsertPayrollResult> {
  const result: UpsertPayrollResult = {
    rows_read: rows.length,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    rows_error: 0,
    errors: [],
  };

  // Cache period and concept IDs to avoid repeated lookups per row
  const periodCache = new Map<string, number>();
  const conceptCache = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const personId = await getPersonId(client, tenantId, row.employee_code);
      if (!personId) {
        result.rows_skipped++;
        result.errors.push({ row: i + 1, employee_code: row.employee_code, message: `Persona no encontrada: ${row.employee_code}` });
        continue;
      }

      let periodId = periodCache.get(row.period_code);
      if (!periodId) {
        periodId = await upsertPeriod(client, tenantId, row);
        periodCache.set(row.period_code, periodId);
      }

      let conceptId = conceptCache.get(row.concept_code);
      if (!conceptId) {
        conceptId = await upsertConcept(client, tenantId, row);
        conceptCache.set(row.concept_code, conceptId);
      }

      const op = await upsertEntry(client, tenantId, periodId, personId, conceptId, row, sourceIntegrationId);
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
