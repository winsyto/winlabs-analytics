import type { Pool } from "pg";
import type { IntegrationRow } from "./types.js";
import { logger } from "./utils/logger.js";

/**
 * Builds a run_key unique per integration per minute.
 * This prevents the scheduler from creating duplicate jobs if it runs twice
 * within the same minute window.
 */
function buildRunKey(integrationId: number): string {
  const now = new Date();
  const minute = now.toISOString().slice(0, 16); // "2026-10-01T16:06"
  return `hello_world:${integrationId}:${minute}`;
}

export async function runSchedulerTick(pool: Pool): Promise<void> {
  // Fetch all active integrations (worker connects as postgres superuser — bypasses RLS)
  const result = await pool.query<IntegrationRow>(
    `SELECT id, tenant_id, integration_template_code, name, status, schedule_cron, last_run_at
     FROM int_tenant_integrations
     WHERE status = 'active' AND is_active = true AND schedule_cron IS NOT NULL`
  );

  if (result.rows.length === 0) return;

  logger.debug("scheduler tick", { integrations: result.rows.length });

  for (const integration of result.rows) {
    const runKey = buildRunKey(integration.id);

    try {
      // INSERT ... ON CONFLICT DO NOTHING — idempotent
      const inserted = await pool.query<{ id: number }>(
        `INSERT INTO jobs (tenant_id, integration_id, job_type, status, run_key, payload)
         VALUES ($1, $2, 'hello_world', 'pending', $3, $4::jsonb)
         ON CONFLICT ON CONSTRAINT uq_jobs_run_key DO NOTHING
         RETURNING id`,
        [
          integration.tenant_id,
          integration.id,
          runKey,
          JSON.stringify({ integration_name: integration.name, template: integration.integration_template_code }),
        ]
      );

      if (inserted.rowCount && inserted.rowCount > 0) {
        logger.info("job enqueued", {
          jobId:       inserted.rows[0]!.id,
          integration: integration.name,
          runKey,
        });
      }
    } catch (err) {
      logger.error("failed to enqueue job", { integrationId: integration.id, err: String(err) });
    }
  }
}
