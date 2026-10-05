import type { Pool } from "pg";
import { config } from "./config.js";
import { claimJob } from "./jobs/claimJob.js";
import { completeJob } from "./jobs/completeJob.js";
import { failJob } from "./jobs/failJob.js";
import { startHeartbeat, stopHeartbeat } from "./jobs/heartbeat.js";
import { createJobRun, completeJobRun, failJobRun } from "./jobs/jobRun.js";
import { createJobEvent } from "./jobs/jobEvent.js";
import { handlers } from "./handlers/index.js";
import { logger } from "./utils/logger.js";

let activeJobs = 0;

export async function runProcessorTick(pool: Pool): Promise<void> {
  if (activeJobs >= config.maxConcurrentJobs) return;

  const job = await claimJob(pool, config.workerId);
  if (!job) return;

  activeJobs++;
  const runId = await createJobRun(pool, job, config.workerId);
  const heartbeatTimer = startHeartbeat(pool, job.id);
  const startTime = Date.now();

  logger.info("job claimed", { jobId: job.id, jobType: job.job_type, attempt: job.attempts });

  try {
    const handler = handlers[job.job_type];
    if (!handler) throw new Error(`Unknown job type: "${job.job_type}"`);

    await handler(job, pool);

    const durationMs = Date.now() - startTime;
    // Algunos handlers adjuntan un resultado en job._result (ej: file_people con stats)
    const result = (job as { _result?: Record<string, unknown> })._result ?? {};
    await completeJob(pool, job.id, result);
    await completeJobRun(pool, runId, durationMs);
    await createJobEvent(pool, job.id, runId, "job_completed", "info", `Completed in ${durationMs}ms`);

    logger.info("job completed", { jobId: job.id, durationMs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startTime;

    await failJob(pool, job.id, message, job.attempts, job.max_attempts);
    await failJobRun(pool, runId, durationMs, message);
    await createJobEvent(pool, job.id, runId, "job_failed", "error", message);

    logger.error("job failed", { jobId: job.id, error: message, attempt: job.attempts });
  } finally {
    stopHeartbeat(heartbeatTimer);
    activeJobs--;
  }
}
