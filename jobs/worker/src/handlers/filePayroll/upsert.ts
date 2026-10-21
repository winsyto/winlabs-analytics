import type { PoolClient } from "pg";
import type { PayrollRow } from "./types.js";

/** Filas por bloque: cada bloque se guarda en una transacción propia. */
const CHUNK = 5000;
const SAMPLE = 10;
const sample = (items: string[]) =>
  items.length > SAMPLE ? `${items.slice(0, SAMPLE).join(", ")} y ${items.length - SAMPLE} más` : items.join(", ");

export interface UpsertPayrollResult {
  rows_read: number;
  rows_inserted: number;
  rows_updated: number;
  rows_skipped: number;
  rows_error: number;
  periods: number;
  processes: number;
  concepts_created: number;
  errors: Array<{ row: number; employee_code: string; message: string }>;
  warnings: string[];
}

interface Work {
  personId: number;
  processId: number;
  conceptId: number;
  /** Importe y cantidad acumulados en centésimas (varias filas iguales se suman) */
  amountCents: number;
  quantityCents: number | null;
  row: PayrollRow;
}

const toCents = (v: string) => Math.round(Number(v) * 100);
const fromCents = (c: number) => (c / 100).toFixed(2);

/** Primer y último día del mes AAAA-MM. */
function monthBounds(period: string): { start: string; end: string } {
  const [y, m] = period.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${period}-01`, end: `${period}-${String(last).padStart(2, "0")}` };
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
    periods: 0,
    processes: 0,
    concepts_created: 0,
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

  // 2. Períodos (el mes de liquidación) y procesos. Un proceso toma los datos de su primera fila.
  const periods = new Map<string, number>();
  for (const code of new Set(rows.map((r) => r.period_code))) {
    const { start, end } = monthBounds(code);
    const res = await client.query<{ id: number }>(
      `INSERT INTO pay_periods (tenant_id, period_code, start_date, end_date, updated_at)
       VALUES ($1::uuid, $2::text, $3::date, $4::date, now())
       ON CONFLICT (tenant_id, period_code) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [tenantId, code, start, end]
    );
    periods.set(code, res.rows[0]!.id);
  }
  result.periods = periods.size;

  const processes = new Map<string, number>();
  const processSeen = new Map<string, PayrollRow>();
  const processConflicts = new Set<string>();
  for (const row of rows) {
    const key = `${row.period_code}|${row.process_code}`;
    const first = processSeen.get(key);
    if (!first) {
      processSeen.set(key, row);
    } else if (
      first.process_start !== row.process_start ||
      first.process_end !== row.process_end ||
      first.process_type !== row.process_type
    ) {
      processConflicts.add(`${row.period_code}/${row.process_code}`);
    }
  }
  for (const [key, row] of processSeen) {
    const res = await client.query<{ id: number }>(
      `INSERT INTO pay_processes (tenant_id, period_id, code, description, process_type, start_date, end_date, updated_at)
       VALUES ($1::uuid, $2::int, $3::text, $4::text, $5::text, $6::date, $7::date, now())
       ON CONFLICT (tenant_id, period_id, code) DO UPDATE SET
         description  = COALESCE(EXCLUDED.description, pay_processes.description),
         process_type = EXCLUDED.process_type,
         start_date   = EXCLUDED.start_date,
         end_date     = EXCLUDED.end_date,
         updated_at   = now()
       RETURNING id`,
      [tenantId, periods.get(row.period_code)!, row.process_code, row.process_description, row.process_type, row.process_start, row.process_end]
    );
    processes.set(key, res.rows[0]!.id);
  }
  result.processes = processes.size;

  // 3. Conceptos. Uno existente NO se modifica (manda lo editado en el portal); uno nuevo queda sin clasificar.
  const concepts = new Map<string, number>();
  const conceptNames = new Map<string, string>();
  for (const r of rows) if (!conceptNames.has(r.concept_code)) conceptNames.set(r.concept_code, r.concept_name);
  const conceptCodes = [...conceptNames.keys()];
  const existing = await client.query<{ code: string; id: number }>(
    `SELECT code, id FROM pay_concepts WHERE tenant_id = $1::uuid AND code = ANY($2::text[])`,
    [tenantId, conceptCodes]
  );
  for (const c of existing.rows) concepts.set(c.code, c.id);
  const created: string[] = [];
  for (const code of conceptCodes) {
    if (concepts.has(code)) continue;
    const ins = await client.query<{ id: number }>(
      `INSERT INTO pay_concepts (tenant_id, code, name, is_classified)
       VALUES ($1::uuid, $2::text, $3::text, false)
       ON CONFLICT (tenant_id, code) DO NOTHING
       RETURNING id`,
      [tenantId, code, conceptNames.get(code)!]
    );
    if (ins.rows[0]) {
      concepts.set(code, ins.rows[0].id);
      created.push(code);
    } else {
      const sel = await client.query<{ id: number }>(
        `SELECT id FROM pay_concepts WHERE tenant_id = $1::uuid AND code = $2::text`,
        [tenantId, code]
      );
      concepts.set(code, sel.rows[0]!.id);
    }
  }
  result.concepts_created = created.length;

  // 4. Filas de personas inexistentes (se informa una vez por código) y repetidas (se suman)
  const missing = new Map<string, { first: number; count: number }>();
  const work = new Map<string, Work>();
  let summed = 0;
  for (const row of rows) {
    const personId = people.get(row.employee_code);
    if (personId === undefined) {
      result.rows_skipped++;
      const m = missing.get(row.employee_code);
      if (m) m.count++;
      else missing.set(row.employee_code, { first: row.source_row, count: 1 });
      continue;
    }
    const processId = processes.get(`${row.period_code}|${row.process_code}`)!;
    const conceptId = concepts.get(row.concept_code)!;
    const key = `${personId}|${processId}|${conceptId}`;
    const amount = toCents(row.amount);
    const quantity = row.quantity === null ? null : toCents(row.quantity);
    const prev = work.get(key);
    if (prev) {
      summed++;
      prev.amountCents += amount;
      if (quantity !== null) prev.quantityCents = (prev.quantityCents ?? 0) + quantity;
    } else {
      work.set(key, { personId, processId, conceptId, amountCents: amount, quantityCents: quantity, row });
    }
  }
  for (const [code, m] of missing) {
    result.errors.push({ row: m.first, employee_code: code, message: `Persona no encontrada: ${code} (${m.count} fila(s) omitidas)` });
  }

  // 5. Carga por bloques
  const list = [...work.values()];
  for (let i = 0; i < list.length; i += CHUNK) {
    const chunk = list.slice(i, i + CHUNK);
    try {
      await client.query("BEGIN");
      const res = await client.query<{ inserted: boolean }>(
        `INSERT INTO pay_entries (tenant_id, process_id, person_id, concept_id, amount, quantity, source_integration_id)
         SELECT $1::uuid, pr, p, c, a, q, $7::int
         FROM unnest($2::int[], $3::int[], $4::int[], $5::numeric[], $6::numeric[]) AS u(pr, p, c, a, q)
         ON CONFLICT (tenant_id, process_id, person_id, concept_id)
         DO UPDATE SET amount = EXCLUDED.amount, quantity = EXCLUDED.quantity,
                       source_integration_id = EXCLUDED.source_integration_id
         RETURNING (xmax = 0) AS inserted`,
        [
          tenantId,
          chunk.map((w) => w.processId),
          chunk.map((w) => w.personId),
          chunk.map((w) => w.conceptId),
          chunk.map((w) => fromCents(w.amountCents)),
          chunk.map((w) => (w.quantityCents === null ? null : fromCents(w.quantityCents))),
          sourceIntegrationId,
        ]
      );
      await client.query("COMMIT");
      for (const r of res.rows) {
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

  // 6. Avisos
  if (missing.size > 0) {
    result.warnings.push(
      `${result.rows_skipped} fila(s) omitidas porque la persona no existe (${missing.size} código(s) distintos): ${sample([...missing.keys()])}. Cargá primero el archivo de Personas.`
    );
  }
  if (created.length > 0) {
    result.warnings.push(
      `Conceptos nuevos sin clasificar: ${sample(created)}. Mientras tanto no se incluyen en ninguna clase del dashboard; clasificalos en Configuración > Conceptos de liquidación.`
    );
  }
  if (summed > 0) {
    result.warnings.push(`${summed} fila(s) repetían la misma persona, proceso y concepto: se sumaron.`);
  }
  if (processConflicts.size > 0) {
    result.warnings.push(
      `Procesos con fechas o tipo distintos entre filas: ${sample([...processConflicts])}. Se tomaron los de la primera fila de cada proceso.`
    );
  }
  const refs = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pay_concepts WHERE tenant_id = $1::uuid AND reference_total IS NOT NULL`,
    [tenantId]
  );
  if ((refs.rows[0]?.n ?? 0) < 2) {
    result.warnings.push(
      "Todavía no marcaste qué acumulador es el sueldo bruto y cuál el neto: sin eso el dashboard no puede mostrar el neto pagado. Se define en Configuración > Conceptos de liquidación."
    );
  }

  return result;
}
