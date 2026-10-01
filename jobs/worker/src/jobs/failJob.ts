import type { Pool } from "pg";

const RETRY_DELAYS_MS = [5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];

function retryDelay(attempts: number): number {
  return RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)] ?? RETRY_DELAYS_MS[0]!;
}

export async function failJob(
  pool: Pool,
  jobId: number,
  errorMessage: string,
  currentAttempts: number,
  maxAttempts: number
): Promise<void> {
  const canRetry = currentAttempts < maxAttempts;
  const nextStatus = canRetry ? "retry_scheduled" : "failed";
  const nextRetry = canRetry ? new Date(Date.now() + retryDelay(currentAttempts)) : null;

  await pool.query(`
    UPDATE jobs SET
      status        = $2,
      finished_at   = CASE WHEN $2 = 'failed' THEN now() ELSE NULL END,
      next_retry_at = $3,
      locked_at     = NULL,
      locked_by     = NULL,
      last_error    = $4,
      updated_at    = now()
    WHERE id = $1
  `, [jobId, nextStatus, nextRetry, errorMessage]);
}
