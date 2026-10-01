import type { Pool } from "pg";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export async function recoverStaleJobs(pool: Pool): Promise<number> {
  const thresholdMs = config.staleJobThresholdMs;

  const result = await pool.query<{ id: number }>(`
    UPDATE jobs SET
      status        = CASE WHEN attempts < max_attempts THEN 'retry_scheduled' ELSE 'failed' END,
      next_retry_at = CASE WHEN attempts < max_attempts THEN now() + interval '10 minutes' ELSE NULL END,
      finished_at   = CASE WHEN attempts >= max_attempts THEN now() ELSE NULL END,
      locked_at     = NULL,
      locked_by     = NULL,
      last_error    = 'Job heartbeat expired — recovered by worker',
      updated_at    = now()
    WHERE status = 'running'
      AND heartbeat_at < now() - ($1 || ' milliseconds')::interval
    RETURNING id
  `, [thresholdMs]);

  if (result.rowCount && result.rowCount > 0) {
    logger.warn("recovered stale jobs", { count: result.rowCount, ids: result.rows.map((r: { id: number }) => r.id) });
  }

  return result.rowCount ?? 0;
}
