import type { Pool } from "pg";

export async function completeJob(
  pool: Pool,
  jobId: number,
  result: Record<string, unknown>
): Promise<void> {
  await pool.query(`
    UPDATE jobs SET
      status      = 'completed',
      finished_at = now(),
      locked_at   = NULL,
      locked_by   = NULL,
      result      = $2::jsonb,
      updated_at  = now()
    WHERE id = $1
  `, [jobId, JSON.stringify(result)]);
}
