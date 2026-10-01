import type { JobRow } from "../types.js";
import { logger } from "../utils/logger.js";

export async function handleHelloWorld(job: JobRow): Promise<void> {
  logger.info("Hello from WLA worker!", {
    jobId:    job.id,
    tenantId: job.tenant_id,
    payload:  job.payload,
  });

  // Simulated work
  await new Promise<void>((resolve) => setTimeout(resolve, 500));

  logger.info("hello_world completed", { jobId: job.id });
}
