import type { Pool } from "pg";
import type { JobRow } from "../types.js";

export async function claimJob(pool: Pool, workerId: string): Promise<JobRow | null> {
  const result = await pool.query<JobRow>(`
    WITH next_job AS (
      SELECT id FROM jobs
      WHERE status IN ('pending', 'retry_scheduled')
        AND scheduled_at <= now()
        AND (next_retry_at IS NULL OR next_retry_at <= now())
      ORDER BY priority DESC, scheduled_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE jobs j
    SET
      status       = 'running',
      locked_at    = now(),
      locked_by    = $1,
      heartbeat_at = now(),
      attempts     = attempts + 1,
      started_at   = COALESCE(started_at, now()),
      updated_at   = now()
    FROM next_job
    WHERE j.id = next_job.id
    RETURNING j.*
  `, [workerId]);

  return result.rows[0] ?? null;
}
