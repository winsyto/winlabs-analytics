import type { Pool, PoolClient } from "pg";
import type { PersonRow } from "./types.js";
import { addDaysIso, withTenantClient } from "../shared/orgSchema.js";
import { unitKey, upsertOrgUnitDefs } from "../shared/orgUnits.js";
import { logger } from "../../utils/logger.js";

export interface UpsertStats {
  people_inserted: number;
  people_updated: number;
  org_units_upserted: number;
  assignments_opened: number;
  assignments_changed: number;
  assignments_closed: number;
  managers_unresolved: number;
  row_errors: { employee_code: string; message: string }[];
}

interface ExistingAssignment {
  id: number;
  person_id: number;
  org_unit_id: number;
  org_unit_type_code: string;
  valid_from: string;
  valid_to: string | null;
}

type AssignmentOp =
  | { kind: "insert"; type: string; unitId: number; from: string; to: string | null }
  | { kind: "close"; id: number; to: string }
  | { kind: "repoint"; id: number; unitId: number };

const later = (a: string, b: string) => (a > b ? a : b);

// ─── Persona ──────────────────────────────────────────────────────────────────

async function upsertPerson(
  client: PoolClient,
  tenantId: string,
  row: PersonRow
): Promise<{ id: number; op: "inserted" | "updated" }> {
  const result = await client.query<{ id: number; xmax: string }>(
    `INSERT INTO hr_people (
       tenant_id, employee_code, full_name, hire_date, termination_date, termination_reason_code, status,
       email, birth_date, gender, document_type, document_number, updated_at
     ) VALUES (
       $1::uuid, $2::text, $3::text, $4::date, $5::date, $6::text, $7::text,
       $8::text, $9::date, $10::text, $11::text, $12::text, now()
     )
     ON CONFLICT (tenant_id, employee_code)
     DO UPDATE SET
       full_name               = EXCLUDED.full_name,
       hire_date               = EXCLUDED.hire_date,
       termination_date        = EXCLUDED.termination_date,
       termination_reason_code = EXCLUDED.termination_reason_code,
       status                  = EXCLUDED.status,
       email                   = EXCLUDED.email,
       birth_date              = EXCLUDED.birth_date,
       gender                  = EXCLUDED.gender,
       document_type           = EXCLUDED.document_type,
       document_number         = EXCLUDED.document_number,
       deleted_at              = NULL,
       updated_at              = now()
     RETURNING id, xmax::text`,
    [
      tenantId,
      row.employee_code,
      row.full_name,
      row.hire_date,
      row.termination_date,
      row.termination_reason_code,
      row.status,
      row.email,
      row.birth_date,
      row.gender,
      row.document_type,
      row.document_number,
    ]
  );
  const r = result.rows[0]!;
  return { id: r.id, op: r.xmax === "0" ? "inserted" : "updated" };
}

// ─── Asignaciones con vigencia ────────────────────────────────────────────────

/**
 * Reglas (la fecha de efecto del archivo de Personas es la fecha de ingreso):
 *  - Sin asignaciones del tipo: se abre una desde hire_date.
 *  - Misma unidad que la vigente: no se hace nada.
 *  - Unidad distinta: se cierra la vigente el día anterior y se abre la nueva hoy
 *    (si la vigente empezó hoy, se corrige en el lugar). Las fechas exactas se fijan
 *    con el archivo de historial de unidades.
 *  - Persona con baja cumplida: el último período de cada tipo termina en la fecha de baja (se cierra el vigente
 *    o se ajusta el cierre si la fecha de baja cambió) y no se detectan cambios de unidad.
 */
function planAssignments(
  row: PersonRow,
  existing: ExistingAssignment[],
  unitIds: Map<string, number>,
  today: string
): AssignmentOp[] {
  const ops: AssignmentOp[] = [];
  const terminated = row.termination_date !== null && row.termination_date <= today;

  for (const [type, cell] of Object.entries(row.org_units)) {
    const unitId = unitIds.get(unitKey(type, cell.code));
    if (unitId === undefined) continue;
    const list = existing.filter((a) => a.org_unit_type_code === type).sort((a, b) => a.valid_from.localeCompare(b.valid_from));
    const open = list.find((a) => a.valid_to === null);
    const last = list[list.length - 1];

    if (terminated) {
      const end = row.termination_date!;
      if (open) ops.push({ kind: "close", id: open.id, to: later(open.valid_from, end) });
      else if (!last) ops.push({ kind: "insert", type, unitId, from: row.hire_date, to: later(row.hire_date, end) });
      else if (last.valid_to !== later(last.valid_from, end)) {
        // La fecha de baja cambió: el último período debe terminar en la nueva fecha
        ops.push({ kind: "close", id: last.id, to: later(last.valid_from, end) });
      }
      continue;
    }

    if (!open) {
      const from = last?.valid_to ? later(row.hire_date, addDaysIso(last.valid_to, 1)) : row.hire_date;
      ops.push({ kind: "insert", type, unitId, from, to: null });
    } else if (open.org_unit_id !== unitId) {
      if (open.valid_from >= today) {
        ops.push({ kind: "repoint", id: open.id, unitId });
      } else {
        ops.push({ kind: "close", id: open.id, to: addDaysIso(today, -1) });
        ops.push({ kind: "insert", type, unitId, from: today, to: null });
      }
    }
  }
  return ops;
}

async function applyOps(
  client: PoolClient,
  tenantId: string,
  personId: number,
  ops: AssignmentOp[],
  stats: UpsertStats
): Promise<void> {
  // Cerrar y reapuntar antes de insertar, para respetar la restricción de solapamiento
  const ordered = [...ops.filter((o) => o.kind !== "insert"), ...ops.filter((o) => o.kind === "insert")];
  for (const op of ordered) {
    if (op.kind === "close") {
      await client.query(`UPDATE hr_people_org_assignments SET valid_to = $2::date WHERE id = $1::int`, [op.id, op.to]);
      stats.assignments_closed++;
    } else if (op.kind === "repoint") {
      await client.query(`UPDATE hr_people_org_assignments SET org_unit_id = $2::int WHERE id = $1::int`, [op.id, op.unitId]);
      stats.assignments_changed++;
    } else {
      await client.query(
        `INSERT INTO hr_people_org_assignments (tenant_id, person_id, org_unit_id, org_unit_type_code, valid_from, valid_to)
         VALUES ($1::uuid, $2::int, $3::int, $4::text, $5::date, $6::date)
         ON CONFLICT DO NOTHING`,
        [tenantId, personId, op.unitId, op.type, op.from, op.to]
      );
      stats.assignments_opened++;
    }
  }
}

// ─── Jefes directos ───────────────────────────────────────────────────────────

async function resolveManagers(pool: Pool, tenantId: string, rows: PersonRow[], stats: UpsertStats): Promise<void> {
  const withManager = rows.filter((r) => r.manager_code);
  if (withManager.length === 0) return;

  await withTenantClient(pool, tenantId, async (client) => {
    const codes = [...new Set(withManager.flatMap((r) => [r.employee_code, r.manager_code!]))];
    const res = await client.query<{ id: number; employee_code: string }>(
      `SELECT id, employee_code FROM hr_people WHERE tenant_id = $1::uuid AND employee_code = ANY($2::text[])`,
      [tenantId, codes]
    );
    const idByCode = new Map(res.rows.map((r) => [r.employee_code, r.id]));
    for (const row of withManager) {
      const personId = idByCode.get(row.employee_code);
      const managerId = idByCode.get(row.manager_code!);
      if (!personId || !managerId || personId === managerId) {
        stats.managers_unresolved++;
        continue;
      }
      await client.query(
        `UPDATE hr_people SET manager_id = $2::int, updated_at = now()
         WHERE id = $1::int AND manager_id IS DISTINCT FROM $2::int`,
        [personId, managerId]
      );
    }
  });
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function upsertPeople(
  pool: Pool,
  tenantId: string,
  rows: PersonRow[],
  today: string
): Promise<UpsertStats> {
  const stats: UpsertStats = {
    people_inserted: 0,
    people_updated: 0,
    org_units_upserted: 0,
    assignments_opened: 0,
    assignments_changed: 0,
    assignments_closed: 0,
    managers_unresolved: 0,
    row_errors: [],
  };

  const unitIds = await upsertOrgUnitDefs(
    pool,
    tenantId,
    rows.flatMap((r) => Object.entries(r.org_units).map(([type, c]) => ({ type, code: c.code, name: c.name })))
  );
  stats.org_units_upserted = unitIds.size;

  const BATCH_SIZE = 50;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.current_tenant_id', $1::text, true)`, [tenantId]);

      // 1. Personas (cada fila en su savepoint: un error no tira el lote)
      const personIds = new Map<string, number>();
      for (const row of batch) {
        await client.query("SAVEPOINT row_sp");
        try {
          const { id, op } = await upsertPerson(client, tenantId, row);
          personIds.set(row.employee_code, id);
          if (op === "inserted") stats.people_inserted++;
          else stats.people_updated++;
          await client.query("RELEASE SAVEPOINT row_sp");
        } catch (err) {
          await client.query("ROLLBACK TO SAVEPOINT row_sp");
          stats.row_errors.push({ employee_code: row.employee_code, message: err instanceof Error ? err.message : String(err) });
        }
      }

      // 2. Asignaciones: una consulta para todo el lote
      const existing = personIds.size
        ? (
            await client.query<ExistingAssignment>(
              `SELECT id, person_id, org_unit_id, org_unit_type_code,
                      valid_from::text AS valid_from, valid_to::text AS valid_to
               FROM hr_people_org_assignments
               WHERE tenant_id = $1::uuid AND person_id = ANY($2::int[])`,
              [tenantId, [...personIds.values()]]
            )
          ).rows
        : [];

      for (const row of batch) {
        const personId = personIds.get(row.employee_code);
        if (!personId) continue;
        const mine = existing.filter((a) => a.person_id === personId);
        const ops = planAssignments(row, mine, unitIds, today);
        if (ops.length === 0) continue;
        await client.query("SAVEPOINT row_sp");
        try {
          await applyOps(client, tenantId, personId, ops, stats);
          await client.query("RELEASE SAVEPOINT row_sp");
        } catch (err) {
          await client.query("ROLLBACK TO SAVEPOINT row_sp");
          stats.row_errors.push({ employee_code: row.employee_code, message: `Unidades organizativas: ${err instanceof Error ? err.message : String(err)}` });
        }
      }

      await client.query("COMMIT");
      logger.info("batch upserted", { batch_start: i, batch_size: batch.length });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  await resolveManagers(pool, tenantId, rows, stats);
  return stats;
}
