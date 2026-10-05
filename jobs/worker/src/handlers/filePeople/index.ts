import type { Pool } from "pg";
import type { JobRow } from "../../types.js";
import { downloadFileBuffer } from "../../storage.js";
import { parseFilePeople } from "./parser.js";
import { upsertPeople } from "./upsert.js";
import type { FilePeopleConfig } from "./types.js";
import { logger } from "../../utils/logger.js";

interface FilePeoplePayload {
  storagePath: string;  // e.g. "{tenantId}/{integrationId}/2026-10-02_empleados.xlsx"
  filename: string;     // nombre original para detectar extensión
}

// Carga la config de la integración desde la BD
async function loadIntegrationConfig(
  pool: Pool,
  integrationId: number
): Promise<FilePeopleConfig> {
  const result = await pool.query<{ config: unknown }>(
    `SELECT config FROM int_tenant_integrations WHERE id = $1`,
    [integrationId]
  );
  const raw = result.rows[0]?.config;
  if (!raw || typeof raw !== "object") return {};
  return (raw as { filePeople?: FilePeopleConfig }).filePeople ?? {};
}

export async function handleFilePeople(job: JobRow, pool: Pool): Promise<void> {
  const payload = job.payload as unknown as FilePeoplePayload;
  if (!payload.storagePath) throw new Error("Job payload missing storagePath");
  if (!payload.filename) throw new Error("Job payload missing filename");
  if (!job.integration_id) throw new Error("Job missing integration_id");

  logger.info("file_people: downloading", { path: payload.storagePath });
  const buffer = await downloadFileBuffer(payload.storagePath);

  logger.info("file_people: loading integration config", { integrationId: job.integration_id });
  const cfg = await loadIntegrationConfig(pool, job.integration_id);

  logger.info("file_people: parsing", { filename: payload.filename, bytes: buffer.length });
  const { rows, errors } = await parseFilePeople(buffer, payload.filename, cfg);

  logger.info("file_people: parse complete", {
    valid_rows: rows.length,
    error_rows: errors.length,
  });

  if (errors.length > 0) {
    // Log errores de parseo — no detienen el job, se guardan para el historial
    logger.warn("file_people: parse errors", { count: errors.length, sample: errors.slice(0, 5) });
  }

  if (rows.length === 0) {
    throw new Error(`No se encontraron filas válidas en el archivo. Errores: ${errors.length}`);
  }

  logger.info("file_people: upserting people", { tenantId: job.tenant_id, rows: rows.length });
  const stats = await upsertPeople(pool, job.tenant_id, rows);

  logger.info("file_people: done", { ...stats, parse_errors: errors.length });

  // Actualizar lastRunAt y lastSuccessAt en la integración
  await pool.query(`
    UPDATE int_tenant_integrations
    SET last_run_at = now(), last_success_at = now(), updated_at = now()
    WHERE id = $1::int
  `, [job.integration_id]);

  (job as JobRow & { _result?: unknown })._result = {
    rows_read: rows.length + errors.length,
    rows_ok: rows.length,
    rows_error: errors.length,
    ...stats,
    parse_errors: errors.slice(0, 100),
  };
}
