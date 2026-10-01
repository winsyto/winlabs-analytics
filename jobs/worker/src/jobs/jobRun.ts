import type { Pool } from "pg";
import type { JobRow } from "../types.js";

export async function createJobRun(pool: Pool, job: JobRow, workerId: string): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `INSERT INTO job_runs (job_id, tenant_id, worker_id, status)
     VALUES ($1, $2, $3, 'running')
     RETURNING id`,
    [job.id, job.tenant_id, workerId]
  );
  return result.rows[0]!.id;
}

export async function completeJobRun(pool: Pool, runId: number, durationMs: number): Promise<void> {
  await pool.query(
    `UPDATE job_runs SET status = 'completed', finished_at = now(), duration_ms = $2 WHERE id = $1`,
    [runId, durationMs]
  );
}

export async function failJobRun(
  pool: Pool,
  runId: number,
  durationMs: number,
  errorMessage: string
): Promise<void> {
  await pool.query(
    `UPDATE job_runs SET status = 'failed', finished_at = now(), duration_ms = $2, error_message = $3 WHERE id = $1`,
    [runId, durationMs, errorMessage]
  );
}
