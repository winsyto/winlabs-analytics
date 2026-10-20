import type { PoolClient } from "pg";
import type { TimeEntryRow } from "./types.js";

/** Filas por bloque: cada bloque se guarda en una transacción propia. */
const CHUNK = 5000;
const SAMPLE = 10;
const sample = (items: string[]) =>
  items.length > SAMPLE ? `${items.slice(0, SAMPLE).join(", ")} y ${items.length - SAMPLE} más` : items.join(", ");

export interface UpsertTimeAttendanceResult {
  rows_read: number;
  rows_inserted: number;
  rows_updated: number;
  rows_skipped: number;
  rows_error: number;
  types_created: number;
  errors: Array<{ row: number; employee_code: string; message: string }>;
  warnings: string[];
}

interface Work {
  personId: number;
  date: string;
  typeId: number;
  hours: string;
  row: TimeEntryRow;
}

/**
 * Devuelve el id del tipo de hora del tenant; si no existe lo crea.
 * Un tipo existente NO se modifica (manda lo editado en el portal). Un tipo nuevo toma la clasificación del
 * catálogo global (mismo código) o, si no está, queda "sin clasificar" (categoría other: no cuenta como hora extra).
 */
async function ensureTimeEntryType(
  client: PoolClient,
  tenantId: string,
  code: string
): Promise<{ id: number; created: boolean; classified: boolean }> {
  const find = () =>
    client.query<{ id: number; is_classified: boolean }>(
      `SELECT id, is_classified FROM cfg_tenant_time_entry_types WHERE tenant_id = $1::uuid AND code = $2::text`,
      [tenantId, code]
    );
  const existing = await find();
  if (existing.rows[0]) return { id: existing.rows[0].id, created: false, classified: existing.rows[0].is_classified };

  const def = await client.query<{ name: string; category: string; sign: number; sort_order: number }>(
    `SELECT name, category, sign, sort_order FROM cfg_time_entry_types WHERE code = $1::text AND is_active = true`,
    [code]
  );
  const d = def.rows[0];
  const ins = await client.query<{ id: number }>(
    `INSERT INTO cfg_tenant_time_entry_types (tenant_id, code, name, category, sign, is_classified, sort_order, updated_at)
     VALUES ($1::uuid, $2::text, $3::text, $4::text, $5::smallint, $6::boolean, $7::int, now())
     ON CONFLICT (tenant_id, code) DO NOTHING
     RETURNING id`,
    [tenantId, code, d?.name ?? code, d?.category ?? "other", d?.sign ?? 1, !!d, d?.sort_order ?? 1000]
  );
  if (ins.rows[0]) return { id: ins.rows[0].id, created: true, classified: !!d };
  const sel = await find();
  return { id: sel.rows[0]!.id, created: false, classified: sel.rows[0]!.is_classified };
}

export async function upsertTimeAttendance(
  client: PoolClient,
  tenantId: string,
  sourceIntegrationId: number,
  rows: TimeEntryRow[]
): Promise<UpsertTimeAttendanceResult> {
  const result: UpsertTimeAttendanceResult = {
    rows_read: rows.length,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    rows_error: 0,
    types_created: 0,
    errors: [],
    warnings: [],
  };

  // 1. Personas
  const people = new Map<string, number>();
  const codes = [...new Set(rows.map((r) => r.employee_code))];
  for (let i = 0; i < codes.length; i += CHUNK) {
    const res = await client.query<{ employee_code: string; id: number }>(
      `SELECT employee_code, id FROM hr_people WHERE tenant_id = $1::uuid AND employee_code = ANY($2::text[])`,
      [tenantId, codes.slice(i, i + CHUNK)]
    );
    for (const p of res.rows) people.set(p.employee_code, p.id);
  }

  // 2. Tipos de hora
  const types = new Map<string, number>();
  const createdUnclassified = new Set<string>();
  for (const code of new Set(rows.map((r) => r.time_entry_type))) {
    const t = await ensureTimeEntryType(client, tenantId, code);
    types.set(code, t.id);
    if (t.created) result.types_created++;
    if (t.created && !t.classified) createdUnclassified.add(code);
  }

  // 3. Filas de personas inexistentes (se informa una vez por código) y repetidas (gana la última)
  const missing = new Map<string, { first: number; count: number }>();
  const work = new Map<string, Work>();
  let duplicates = 0;
  for (const row of rows) {
    const personId = people.get(row.employee_code);
    if (personId === undefined) {
      result.rows_skipped++;
      const m = missing.get(row.employee_code);
      if (m) m.count++;
      else missing.set(row.employee_code, { first: row.source_row, count: 1 });
      continue;
    }
    const typeId = types.get(row.time_entry_type)!;
    const key = `${personId}|${row.date}|${typeId}`;
    if (work.has(key)) duplicates++;
    work.set(key, { personId, date: row.date, typeId, hours: row.hours, row });
  }
  for (const [code, m] of missing) {
    result.errors.push({ row: m.first, employee_code: code, message: `Persona no encontrada: ${code} (${m.count} fila(s) omitidas)` });
  }

  // 4. Carga por bloques: cabecera diaria, horas por tipo y totales del día
  const list = [...work.values()];
  const over24 = new Set<number>();
  for (let i = 0; i < list.length; i += CHUNK) {
    const chunk = list.slice(i, i + CHUNK);
    try {
      await client.query("BEGIN");

      const hdr = await client.query<{ id: number; person_id: number; day: string }>(
        `INSERT INTO att_time_daily (tenant_id, person_id, date, is_working_day, source_integration_id, updated_at)
         SELECT $1::uuid, p, d, true, $4::int, now()
         FROM (SELECT DISTINCT p, d FROM unnest($2::int[], $3::date[]) AS u(p, d)) s
         ON CONFLICT (tenant_id, person_id, date)
         DO UPDATE SET source_integration_id = EXCLUDED.source_integration_id, updated_at = now()
         RETURNING id, person_id, to_char(date, 'YYYY-MM-DD') AS day`,
        [tenantId, chunk.map((w) => w.personId), chunk.map((w) => w.date), sourceIntegrationId]
      );
      const dailyId = new Map(hdr.rows.map((h) => [`${h.person_id}|${h.day}`, h.id]));

      const ent = await client.query<{ inserted: boolean }>(
        `INSERT INTO att_time_daily_entries (tenant_id, time_daily_id, time_entry_type_id, hours)
         SELECT $1::uuid, d, t, h FROM unnest($2::int[], $3::int[], $4::numeric[]) AS u(d, t, h)
         ON CONFLICT (tenant_id, time_daily_id, time_entry_type_id)
         DO UPDATE SET hours = EXCLUDED.hours
         RETURNING (xmax = 0) AS inserted`,
        [
          tenantId,
          chunk.map((w) => dailyId.get(`${w.personId}|${w.date}`)!),
          chunk.map((w) => w.typeId),
          chunk.map((w) => w.hours),
        ]
      );

      // Totales del día: se calculan y se aplican por clave primaria (no dependen de las estadísticas del planificador)
      const ids = [...new Set(dailyId.values())];
      const totals = await client.query<{ id: number; worked: string; absent: boolean }>(
        `SELECT e.time_daily_id AS id,
                COALESCE(SUM(e.hours) FILTER (WHERE t.sign = 1), 0)::text AS worked,
                COALESCE(bool_or(t.category = 'absence' AND e.hours > 0), false) AS absent
         FROM att_time_daily_entries e
         JOIN cfg_tenant_time_entry_types t ON t.id = e.time_entry_type_id
         WHERE e.tenant_id = $1::uuid AND e.time_daily_id = ANY($2::int[])
         GROUP BY e.time_daily_id`,
        [tenantId, ids]
      );
      await client.query(
        `UPDATE att_time_daily d
         SET worked_hours = u.worked, has_absence = u.absent, updated_at = now()
         FROM unnest($2::int[], $3::numeric[], $4::boolean[]) AS u(id, worked, absent)
         WHERE d.id = u.id AND d.tenant_id = $1::uuid`,
        [tenantId, totals.rows.map((t) => t.id), totals.rows.map((t) => t.worked), totals.rows.map((t) => t.absent)]
      );
      const over = await client.query<{ id: number }>(
        `SELECT id FROM att_time_daily WHERE tenant_id = $1::uuid AND id = ANY($2::int[]) AND worked_hours > 24`,
        [tenantId, ids]
      );
      await client.query("COMMIT");

      for (const o of over.rows) over24.add(o.id);
      for (const r of ent.rows) {
        if (r.inserted) result.rows_inserted++;
        else result.rows_updated++;
      }
    } catch (err: unknown) {
      await client.query("ROLLBACK").catch(() => undefined);
      result.rows_error += chunk.length;
      result.errors.push({
        row: chunk[0]!.row.source_row,
        employee_code: chunk[0]!.row.employee_code,
        message: `Error al guardar un bloque de ${chunk.length} filas: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  if (missing.size > 0) {
    result.warnings.push(
      `${result.rows_skipped} fila(s) omitidas porque la persona no existe (${missing.size} código(s) distintos): ${sample([...missing.keys()])}. Cargá primero el archivo de Personas.`
    );
  }
  if (createdUnclassified.size > 0) {
    result.warnings.push(
      `Tipos de hora nuevos sin clasificar: ${sample([...createdUnclassified])}. Mientras tanto no cuentan como hora extra; clasificalos en Configuración > Tipos de hora.`
    );
  }
  if (duplicates > 0) {
    result.warnings.push(`${duplicates} fila(s) repetían la misma persona, día y tipo de hora: se tomó la última.`);
  }
  if (over24.size > 0) {
    result.warnings.push(`${over24.size} día(s) de persona suman más de 24 horas trabajadas: revisá el archivo de origen.`);
  }

  return result;
}
