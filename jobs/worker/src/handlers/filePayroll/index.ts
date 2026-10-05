import type { Pool } from "pg";
import type { JobRow } from "../../types.js";
import { downloadFileBuffer } from "../../storage.js";
import { parseFilePayroll } from "./parser.js";
import { upsertPayroll } from "./upsert.js";
import type { FilePayrollConfig } from "./types.js";
import { logger } from "../../utils/logger.js";

interface FilePayrollPayload {
  storagePath: string;
  filename: string;
}

async function loadIntegrationConfig(
  pool: Pool,
  integrationId: number
): Promise<FilePayrollConfig> {
  const result = await pool.query<{ config: unknown }>(
    `SELECT config FROM int_tenant_integrations WHERE id = $1`,
    [integrationId]
  );
  const raw = result.rows[0]?.config;
  if (!raw || typeof raw !== "object") return {};
  return (raw as { filePayroll?: FilePayrollConfig }).filePayroll ?? {};
}

export async function handleFilePayroll(job: JobRow, pool: Pool): Promise<void> {
  const payload = job.payload as unknown as FilePayrollPayload;
  if (!payload.storagePath) throw new Error("Job payload missing storagePath");
  if (!payload.filename) throw new Error("Job payload missing filename");
  if (!job.integration_id) throw new Error("Job missing integration_id");

  logger.info("file_payroll: downloading", { path: payload.storagePath });
  const buffer = await downloadFileBuffer(payload.storagePath);

  const cfg = await loadIntegrationConfig(pool, job.integration_id);

  logger.info("file_payroll: parsing", { filename: payload.filename, bytes: buffer.length });
  const { rows, errors } = await parseFilePayroll(buffer, payload.filename, cfg);

  logger.info("file_payroll: parse complete", { valid_rows: rows.length, error_rows: errors.length });

  if (errors.length > 0) {
    logger.warn("file_payroll: parse errors", { count: errors.length, sample: errors.slice(0, 5) });
  }

  if (rows.length === 0) {
    throw new Error(`No se encontraron filas válidas en el archivo. Errores: ${errors.length}`);
  }

  const client = await pool.connect();
  try {
    const stats = await upsertPayroll(client, job.tenant_id, job.integration_id, rows);
    logger.info("file_payroll: done", { ...stats, parse_errors: errors.length });

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
