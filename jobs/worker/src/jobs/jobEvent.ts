import type { Pool } from "pg";

export async function createJobEvent(
  pool: Pool,
  jobId: number,
  runId: number | null,
  eventType: string,
  level: "debug" | "info" | "warning" | "error",
  message: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  await pool.query(
    `INSERT INTO job_events (job_id, job_run_id, tenant_id, event_type, level, message, data)
     SELECT $1, $2, tenant_id, $3, $4, $5, $6::jsonb FROM jobs WHERE id = $1`,
    [jobId, runId, eventType, level, message, JSON.stringify(data)]
  );
}
