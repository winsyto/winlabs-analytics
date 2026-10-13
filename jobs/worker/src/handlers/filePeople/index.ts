import type { Pool } from "pg";
import type { JobRow } from "../../types.js";
import { downloadFileBuffer } from "../../storage.js";
import { parseFilePeople } from "./parser.js";
import { upsertPeople } from "./upsert.js";
import type { FilePeopleConfig } from "./types.js";
import { loadOrgSchema, loadTerminationReasons, todayIso, withTenantClient } from "../shared/orgSchema.js";
import { rebuildTenantSnapshots } from "../../snapshots/peopleSnapshots.js";
import { markIntegrationSuccess } from "../shared/integration.js";
import { logger } from "../../utils/logger.js";

interface FilePeoplePayload {
  storagePath: string;  // e.g. "{tenantId}/{integrationId}/2026-10-02_empleados.xlsx"
  filename: string;     // nombre original para detectar extensión
}

// Carga la config de la integración desde la BD
async function loadIntegrationConfig(
  pool: Pool,
  tenantId: string,
  integrationId: number
): Promise<FilePeopleConfig> {
  const result = await withTenantClient(pool, tenantId, (client) =>
    client.query<{ config: unknown }>(`SELECT config FROM int_tenant_integrations WHERE id = $1`, [integrationId])
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
  const cfg = await loadIntegrationConfig(pool, job.tenant_id, job.integration_id);
  const [orgSchema, terminationReasons] = await Promise.all([
    loadOrgSchema(pool, job.tenant_id),
    loadTerminationReasons(pool),
  ]);
  const today = todayIso();

  logger.info("file_people: parsing", { filename: payload.filename, bytes: buffer.length });
  const { rows, errors, warnings } = await parseFilePeople(buffer, payload.filename, cfg, {
    orgSchema,
    terminationReasons,
    today,
  });

  logger.info("file_people: parse complete", {
    valid_rows: rows.length,
    error_rows: errors.length,
    warnings: warnings.length,
  });

  if (errors.length > 0) {
    // Los errores de parseo no detienen el job: las filas válidas se cargan y los errores quedan en el resultado
    logger.warn("file_people: parse errors", { count: errors.length, sample: errors.slice(0, 5) });
  }

  if (rows.length === 0) {
    const first = errors[0];
    throw new Error(
      `No se encontraron filas válidas en el archivo. Errores: ${errors.length}` +
        (first ? ` (ej.: fila ${first.rowIndex}, ${first.field}: ${first.message})` : "")
    );
  }

  logger.info("file_people: upserting people", { tenantId: job.tenant_id, rows: rows.length });
  const stats = await upsertPeople(pool, job.tenant_id, rows, today);

  logger.info("file_people: done", { ...stats, row_errors: stats.row_errors.length, parse_errors: errors.length });

  // Actualizar lastRunAt y lastSuccessAt en la integración
  await markIntegrationSuccess(pool, job.tenant_id, job.integration_id);

  // Cierres mensuales: se regeneran porque la carga puede cambiar cualquier mes de la ventana.
  // Si falla, la carga ya quedó hecha: se informa como aviso y el tick horario lo reintenta.
  let snapshots: Record<string, unknown>;
  try {
    const snap = await rebuildTenantSnapshots(pool, job.tenant_id);
    snapshots = snap ? { snapshot_months: snap.months, snapshot_rows: snap.rows } : { snapshot_months: 0 };
    logger.info("file_people: snapshots rebuilt", snapshots);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("file_people: snapshot rebuild failed", { err: message });
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
      ...warnings,
      ...(typeof snapshots.snapshot_error === "string" ? [`No se pudieron regenerar los cierres mensuales (${snapshots.snapshot_error}). Se reintentará automáticamente cada hora.`] : []),
    ],
  };
}
