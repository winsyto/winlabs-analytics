import { pool } from "./db.js";
import { config } from "./config.js";
import { runSchedulerTick } from "./scheduler.js";
import { runProcessorTick } from "./processor.js";
import { recoverStaleJobs } from "./jobs/recoverStale.js";
import { logger } from "./utils/logger.js";

logger.info("WLA worker starting", {
  workerId:         config.workerId,
  schedulerEnabled: config.schedulerEnabled,
  processorEnabled: config.processorEnabled,
});

// Scheduler loop
if (config.schedulerEnabled) {
  const schedulerLoop = setInterval(async () => {
    try {
      await runSchedulerTick(pool);
    } catch (err) {
      logger.error("scheduler tick error", { err: String(err) });
    }
  }, config.schedulerIntervalMs);

  // Run once immediately on startup
  runSchedulerTick(pool).catch((err) =>
    logger.error("scheduler initial tick error", { err: String(err) })
  );

  logger.info("scheduler loop started", { intervalMs: config.schedulerIntervalMs });
  void schedulerLoop;
}

// Recovery loop — runs every 5 minutes to unlock stale jobs
setInterval(async () => {
  try {
    await recoverStaleJobs(pool);
  } catch (err) {
    logger.error("recovery tick error", { err: String(err) });
  }
}, 5 * 60_000);

// Processor loop
if (config.processorEnabled) {
  const processorLoop = setInterval(async () => {
    try {
      await runProcessorTick(pool);
    } catch (err) {
      logger.error("processor tick error", { err: String(err) });
    }
  }, config.processorPollMs);

  logger.info("processor loop started", { pollMs: config.processorPollMs });
  void processorLoop;
}

// Graceful shutdown
function shutdown(signal: string): void {
  logger.info("shutdown signal received", { signal });
  pool.end(() => {
    logger.info("db pool closed — exiting");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
