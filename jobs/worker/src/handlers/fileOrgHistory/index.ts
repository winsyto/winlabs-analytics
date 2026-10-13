import type { Pool } from "pg";
import type { JobRow } from "../../types.js";
import { downloadFileBuffer } from "../../storage.js";
import { parseFileOrgHistory } from "./parser.js";
import { upsertOrgHistory } from "./upsert.js";
import type { FileOrgHistoryConfig } from "./types.js";
import { loadOrgSchema, todayIso, withTenantClient } from "../shared/orgSchema.js";
import { rebuildTenantSnapshots } from "../../snapshots/peopleSnapshots.js";
import { markIntegrationSuccess } from "../shared/integration.js";
import { logger } from "../../utils/logger.js";

interface Payload {
  storagePath: string;
  filename: string;
}

async function loadIntegrationConfig(pool: Pool, tenantId: string, integrationId: number): Promise<FileOrgHistoryConfig> {
  const result = await withTenantClient(pool, tenantId, (client) =>
    client.query<{ config: unknown }>(`SELECT config FROM int_tenant_integrations WHERE id = $1`, [integrationId])
  );
  const raw = result.rows[0]?.config;
  if (!raw || typeof raw !== "object") return {};
  return (raw as { fileOrgHistory?: FileOrgHistoryConfig }).fileOrgHistory ?? {};
}

export async function handleFileOrgHistory(job: JobRow, pool: Pool): Promise<void> {
  const payload = job.payload as unknown as Payload;
  if (!payload.storagePath) throw new Error("Job payload missing storagePath");
  if (!payload.filename) throw new Error("Job payload missing filename");
  if (!job.integration_id) throw new Error("Job missing integration_id");

  logger.info("file_org_history: downloading", { path: payload.storagePath });
  const buffer = await downloadFileBuffer(payload.storagePath);

  const cfg = await loadIntegrationConfig(pool, job.tenant_id, job.integration_id);
  const orgSchema = await loadOrgSchema(pool, job.tenant_id);

  const { rows, errors } = await parseFileOrgHistory(buffer, payload.filename, cfg, orgSchema);
  logger.info("file_org_history: parse complete", { valid_rows: rows.length, error_rows: errors.length });

  if (rows.length === 0) {
    const first = errors[0];
    throw new Error(
      `No se encontraron filas válidas en el archivo. Errores: ${errors.length}` +
        (first ? ` (ej.: fila ${first.rowIndex}, ${first.field}: ${first.message})` : "")
    );
  }

  const stats = await upsertOrgHistory(pool, job.tenant_id, rows, todayIso());
  logger.info("file_org_history: done", { ...stats, row_errors: stats.row_errors.length, parse_errors: errors.length });

  await markIntegrationSuccess(pool, job.tenant_id, job.integration_id);

  // Cierres mensuales: se regeneran porque la carga puede cambiar cualquier mes de la ventana.
  // Si falla, la carga ya quedó hecha: se informa como aviso y el tick horario lo reintenta.
  let snapshots: Record<string, unknown>;
  try {
    const snap = await rebuildTenantSnapshots(pool, job.tenant_id);
    snapshots = snap ? { snapshot_months: snap.months, snapshot_rows: snap.rows } : { snapshot_months: 0 };
    logger.info("file_org_history: snapshots rebuilt", snapshots);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("file_org_history: snapshot rebuild failed", { err: message });
    snapshots = { snapshot_error: message };
  }

  const { row_errors, ...counts } = stats;
  (job as JobRow & { _result?: unknown })._result = {
    rows_read: rows.length + new Set(errors.map((e) => e.rowIndex)).size,
    rows_ok: rows.length,
    rows_error: new Set(errors.map((e) => e.rowIndex)).size,
    ...counts,
    ...snapshots,
    errors: row_errors.slice(0, 100),
    parse_errors: errors.slice(0, 100).map((e) => ({ row: e.rowIndex, employee_code: e.employee_code, field: e.field, message: e.message })),
    warnings: [
      ...(typeof snapshots.snapshot_error === "string" ? [`No se pudieron regenerar los cierres mensuales (${snapshots.snapshot_error}). Se reintentará automáticamente cada hora.`] : []),
    ],
  };
}
