import type { Pool } from "pg";
import type { JobRow } from "../../types.js";
import { downloadFileBuffer } from "../../storage.js";
import { parseFilePayroll } from "./parser.js";
import { upsertPayroll } from "./upsert.js";
import type { FilePayrollConfig } from "./types.js";
import { markIntegrationSuccess } from "../shared/integration.js";
import { withTenantClient } from "../shared/orgSchema.js";
import { logger } from "../../utils/logger.js";

interface FilePayrollPayload {
  storagePath: string;
  filename: string;
}

async function loadIntegrationConfig(
  pool: Pool,
  tenantId: string,
  integrationId: number
): Promise<FilePayrollConfig> {
  const result = await withTenantClient(pool, tenantId, (client) =>
    client.query<{ config: unknown }>(`SELECT config FROM int_tenant_integrations WHERE id = $1`, [integrationId])
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

  const cfg = await loadIntegrationConfig(pool, job.tenant_id, job.integration_id);

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
    await client.query(`SELECT set_config('app.current_tenant_id', $1::text, false)`, [job.tenant_id]);
    const stats = await upsertPayroll(client, job.tenant_id, job.integration_id, rows);
    logger.info("file_payroll: done", { ...stats, parse_errors: errors.length });

    await markIntegrationSuccess(pool, job.tenant_id, job.integration_id);

    // Tras una carga grande las estadísticas quedan viejas y los dashboards pueden elegir malos planes hasta que
    // el autovacuum las actualice: se actualizan acá (no es crítico, un fallo solo se registra).
    await client
      .query("ANALYZE pay_entries")
      .catch((err: unknown) => logger.warn("file_payroll: ANALYZE falló", { error: String(err) }));

    (job as JobRow & { _result?: unknown })._result = {
      ...stats,
      rows_read: rows.length + errors.length,
      rows_ok: rows.length,
      parse_errors: errors.slice(0, 100),
    };
  } finally {
    await client.query("RESET app.current_tenant_id").catch(() => undefined);
    client.release();
  }
}
