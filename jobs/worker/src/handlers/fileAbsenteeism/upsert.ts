import type { PoolClient } from "pg";
import { NON_ABSENCE_CLASSES, type AbsenteeismRow } from "./types.js";
import { parseBool } from "../shared/parseFile.js";

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

/**
 * Devuelve el id del tipo de ausencia; si no existe lo crea.
 * Un tipo existente NO se modifica (manda lo editado en el portal). Un tipo nuevo se clasifica con, en orden:
 * 1) la clase que trae el archivo, 2) el catálogo global de tipos por defecto (mismo código),
 * 3) nada: queda "sin clasificar" (clase other, cuenta como ausentismo).
 */
async function ensureAbsenteeismType(
  client: PoolClient,
  tenantId: string,
  row: AbsenteeismRow
): Promise<{ id: number; created: boolean; classified: boolean }> {
  const code = row.absenteeism_type_code;
  const existing = await client.query<{ id: number; is_classified: boolean }>(
    `SELECT id, is_classified FROM cfg_absenteeism_types WHERE tenant_id = $1::uuid AND code = $2::text`,
    [tenantId, code]
  );
  if (existing.rows[0]) {
    return { id: existing.rows[0].id, created: false, classified: existing.rows[0].is_classified };
  }

  let name = row.absenteeism_type_name ?? code;
  let cls = "other";
  let counts = true;
  let classified = false;

  if (row.absenteeism_class) {
    cls = row.absenteeism_class;
    counts = row.counts_as_absence ?? !NON_ABSENCE_CLASSES.includes(cls);
    classified = true;
  } else {
    const def = await client.query<{ name: string; class: string; counts_as_absence: boolean }>(
      `SELECT name, class, counts_as_absence FROM cfg_absenteeism_type_defaults WHERE code = $1::text AND is_active = true`,
      [code]
    );
    if (def.rows[0]) {
      cls = def.rows[0].class;
      counts = row.counts_as_absence ?? def.rows[0].counts_as_absence;
      if (!row.absenteeism_type_name) name = def.rows[0].name;
      classified = true;
    } else if (row.counts_as_absence !== null) {
      counts = row.counts_as_absence;
    }
  }

  const ins = await client.query<{ id: number }>(
    `INSERT INTO cfg_absenteeism_types (tenant_id, code, name, class, counts_as_absence, is_classified)
     VALUES ($1::uuid, $2::text, $3::text, $4::text, $5::boolean, $6::boolean)
     ON CONFLICT (tenant_id, code) DO NOTHING
     RETURNING id`,
    [tenantId, code, name, cls, counts, classified]
  );
  if (ins.rows[0]) return { id: ins.rows[0].id, created: true, classified };

  const sel = await client.query<{ id: number; is_classified: boolean }>(
    `SELECT id, is_classified FROM cfg_absenteeism_types WHERE tenant_id = $1::uuid AND code = $2::text`,
    [tenantId, code]
  );
  return { id: sel.rows[0].id, created: false, classified: sel.rows[0].is_classified };
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
      [existing.rows[0].id, row.end_date, row.days_count, row.hours_count, justified, status, row.notes ?? null, sourceIntegrationId]
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
    [tenantId, personId, absenteeismTypeId, row.start_date, row.end_date, row.days_count, row.hours_count, justified, status, row.notes ?? null, sourceIntegrationId]
  );
  return "inserted";
}

export interface UpsertAbsenteeismResult {
  rows_read: number;
  rows_inserted: number;
  rows_updated: number;
  rows_skipped: number;
  rows_error: number;
  types_created: number;
  errors: Array<{ row: number; employee_code: string; message: string }>;
  warnings: string[];
}

const SAMPLE = 10;
const sample = (items: string[]) =>
  items.length > SAMPLE ? `${items.slice(0, SAMPLE).join(", ")} y ${items.length - SAMPLE} más` : items.join(", ");

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
    types_created: 0,
    errors: [],
    warnings: [],
  };

  const people = new Map<string, number | null>();
  const types = new Map<string, number>();
  const missingPeople = new Map<string, number>(); // código -> filas omitidas
  const createdUnclassified = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      let personId = people.get(row.employee_code);
      if (personId === undefined) {
        personId = await getPersonId(client, tenantId, row.employee_code);
        people.set(row.employee_code, personId);
      }
      if (!personId) {
        result.rows_skipped++;
        missingPeople.set(row.employee_code, (missingPeople.get(row.employee_code) ?? 0) + 1);
        result.errors.push({ row: row.source_row, employee_code: row.employee_code, message: `Persona no encontrada: ${row.employee_code}` });
        continue;
      }

      let typeId = types.get(row.absenteeism_type_code);
      if (typeId === undefined) {
        const t = await ensureAbsenteeismType(client, tenantId, row);
        typeId = t.id;
        types.set(row.absenteeism_type_code, typeId);
        if (t.created) result.types_created++;
        if (!t.classified) createdUnclassified.add(row.absenteeism_type_code);
      }

      const op = await upsertAbsenteeismEvent(client, tenantId, personId, typeId, row, sourceIntegrationId);
      if (op === "inserted") result.rows_inserted++;
      else result.rows_updated++;
    } catch (err: unknown) {
      result.rows_error++;
      result.errors.push({
        row: row.source_row,
        employee_code: row.employee_code,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (missingPeople.size > 0) {
    result.warnings.push(
      `${result.rows_skipped} fila(s) omitidas porque la persona no existe (${missingPeople.size} código(s) distintos): ${sample([...missingPeople.keys()])}. Cargá primero el archivo de Personas.`
    );
  }
  if (createdUnclassified.size > 0) {
    result.warnings.push(
      `Tipos de ausencia nuevos sin clasificar: ${sample([...createdUnclassified])}. Mientras tanto cuentan como ausentismo; clasificalos en Configuración > Tipos de ausencia.`
    );
  }

  return result;
}
