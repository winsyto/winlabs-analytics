import type { Pool } from "pg";
import type { OrgHistoryRow } from "./types.js";
import { withTenantClient } from "../shared/orgSchema.js";
import { unitKey, upsertOrgUnitDefs } from "../shared/orgUnits.js";
import { logger } from "../../utils/logger.js";

export interface OrgHistoryStats {
  people_affected: number;
  org_units_upserted: number;
  assignments_replaced: number;
  assignments_inserted: number;
  row_errors: { employee_code: string; message: string }[];
}

/**
 * Reemplaza, por persona y tipo, el historial de asignaciones con el del archivo (el archivo es la fuente de verdad
 * de las fechas). Un período abierto de una persona con baja cumplida se cierra en su fecha de baja.
 */
export async function upsertOrgHistory(
  pool: Pool,
  tenantId: string,
  rows: OrgHistoryRow[],
  today: string
): Promise<OrgHistoryStats> {
  const stats: OrgHistoryStats = {
    people_affected: 0,
    org_units_upserted: 0,
    assignments_replaced: 0,
    assignments_inserted: 0,
    row_errors: [],
  };

  const unitIds = await upsertOrgUnitDefs(
    pool,
    tenantId,
    rows.map((r) => ({ type: r.org_unit_type, code: r.org_unit_code, name: r.org_unit_name }))
  );
  stats.org_units_upserted = unitIds.size;

  // Agrupar por persona → tipo
  const byPerson = new Map<string, Map<string, OrgHistoryRow[]>>();
  for (const r of rows) {
    const types = byPerson.get(r.employee_code) ?? byPerson.set(r.employee_code, new Map()).get(r.employee_code)!;
    (types.get(r.org_unit_type) ?? types.set(r.org_unit_type, []).get(r.org_unit_type)!).push(r);
  }

  const codes = [...byPerson.keys()];
  const BATCH = 50;
  for (let i = 0; i < codes.length; i += BATCH) {
    const batchCodes = codes.slice(i, i + BATCH);
    await withTenantClient(pool, tenantId, async (client) => {
      const res = await client.query<{ id: number; employee_code: string }>(
        `SELECT id, employee_code FROM hr_people
         WHERE tenant_id = $1::uuid AND deleted_at IS NULL AND employee_code = ANY($2::text[])`,
        [tenantId, batchCodes]
      );
      const idByCode = new Map(res.rows.map((r) => [r.employee_code, r.id]));
      const touched: number[] = [];

      for (const code of batchCodes) {
        const personId = idByCode.get(code);
        if (!personId) {
          stats.row_errors.push({ employee_code: code, message: "Persona inexistente: cargar primero el archivo de Personas" });
          continue;
        }
        await client.query("SAVEPOINT person_sp");
        try {
          for (const [type, periods] of byPerson.get(code)!) {
            const del = await client.query(
              `DELETE FROM hr_people_org_assignments
               WHERE tenant_id = $1::uuid AND person_id = $2::int AND org_unit_type_code = $3::text`,
              [tenantId, personId, type]
            );
            stats.assignments_replaced += del.rowCount ?? 0;
            for (const p of periods) {
              await client.query(
                `INSERT INTO hr_people_org_assignments (tenant_id, person_id, org_unit_id, org_unit_type_code, valid_from, valid_to)
                 VALUES ($1::uuid, $2::int, $3::int, $4::text, $5::date, $6::date)`,
                [tenantId, personId, unitIds.get(unitKey(type, p.org_unit_code)), type, p.valid_from, p.valid_to]
              );
              stats.assignments_inserted++;
            }
          }
          await client.query("RELEASE SAVEPOINT person_sp");
          touched.push(personId);
        } catch (err) {
          await client.query("ROLLBACK TO SAVEPOINT person_sp");
          stats.row_errors.push({ employee_code: code, message: err instanceof Error ? err.message : String(err) });
        }
      }

      if (touched.length > 0) {
        // Persona con baja cumplida: no puede quedar un período abierto
        await client.query(
          `UPDATE hr_people_org_assignments a
           SET valid_to = p.termination_date
           FROM hr_people p
           WHERE a.person_id = p.id AND a.person_id = ANY($1::int[])
             AND a.valid_to IS NULL
             AND p.termination_date IS NOT NULL AND p.termination_date <= $2::date
             AND p.termination_date >= a.valid_from`,
          [touched, today]
        );
        // Espejo transitorio de contrato (hr_people.contract_type) mientras el dashboard no use dimensiones
        await client.query(
          `UPDATE hr_people p
           SET contract_type = ou.code, updated_at = now()
           FROM (
             SELECT DISTINCT ON (a.person_id) a.person_id, o.code
             FROM hr_people_org_assignments a JOIN hr_org_units o ON o.id = a.org_unit_id
             WHERE a.person_id = ANY($1::int[]) AND a.org_unit_type_code = 'CONTRACT'
             ORDER BY a.person_id, a.valid_from DESC
           ) ou
           WHERE p.id = ou.person_id AND length(ou.code) <= 30 AND p.contract_type IS DISTINCT FROM ou.code`,
          [touched]
        );
        stats.people_affected += touched.length;
      }
    });
    logger.info("org history batch", { batch_start: i, batch_size: batchCodes.length });
  }

  return stats;
}
