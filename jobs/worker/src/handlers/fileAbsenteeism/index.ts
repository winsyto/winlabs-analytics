import type { Pool } from "pg";
import type { JobRow } from "../../types.js";
import { downloadFileBuffer } from "../../storage.js";
import { parseFileAbsenteeism } from "./parser.js";
import { upsertAbsenteeism } from "./upsert.js";
import type { FileAbsenteeismConfig } from "./types.js";
import { logger } from "../../utils/logger.js";

interface FileAbsenteeismPayload {
  storagePath: string;
  filename: string;
}

async function loadIntegrationConfig(
  pool: Pool,
  integrationId: number
): Promise<FileAbsenteeismConfig> {
  const result = await pool.query<{ config: unknown }>(
    `SELECT config FROM int_tenant_integrations WHERE id = $1`,
    [integrationId]
  );
  const raw = result.rows[0]?.config;
  if (!raw || typeof raw !== "object") return {};
  return (raw as { fileAbsenteeism?: FileAbsenteeismConfig }).fileAbsenteeism ?? {};
}

export async function handleFileAbsenteeism(job: JobRow, pool: Pool): Promise<void> {
  const payload = job.payload as unknown as FileAbsenteeismPayload;
  if (!payload.storagePath) throw new Error("Job payload missing storagePath");
  if (!payload.filename) throw new Error("Job payload missing filename");
  if (!job.integration_id) throw new Error("Job missing integration_id");

  logger.info("file_absenteeism: downloading", { path: payload.storagePath });
  const buffer = await downloadFileBuffer(payload.storagePath);

  const cfg = await loadIntegrationConfig(pool, job.integration_id);

  logger.info("file_absenteeism: parsing", { filename: payload.filename, bytes: buffer.length });
  const { rows, errors } = await parseFileAbsenteeism(buffer, payload.filename, cfg);

  logger.info("file_absenteeism: parse complete", { valid_rows: rows.length, error_rows: errors.length });

  if (errors.length > 0) {
    logger.warn("file_absenteeism: parse errors", { count: errors.length, sample: errors.slice(0, 5) });
  }

  if (rows.length === 0) {
    throw new Error(`No se encontraron filas válidas en el archivo. Errores: ${errors.length}`);
  }

  const client = await pool.connect();
  try {
    const stats = await upsertAbsenteeism(client, job.tenant_id, job.integration_id, rows);
    logger.info("file_absenteeism: done", { ...stats, parse_errors: errors.length });

    await pool.query(`
      UPDATE int_tenant_integrations
      SET last_run_at = now(), last_success_at = now(), updated_at = now()
      WHERE id = $1::int
    `, [job.integration_id]);

    (job as JobRow & { _result?: unknown })._result = {
      ...stats,
      rows_read: rows.length + errors.length,
      rows_ok: rows.length,
      parse_errors: errors.slice(0, 100),
    };
  } finally {
    client.release();
  }
}
