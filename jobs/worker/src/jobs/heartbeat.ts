import type { Pool } from "pg";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export function startHeartbeat(pool: Pool, jobId: number): ReturnType<typeof setInterval> {
  return setInterval(async () => {
    try {
      await pool.query(
        "UPDATE jobs SET heartbeat_at = now(), updated_at = now() WHERE id = $1",
        [jobId]
      );
    } catch (err) {
      logger.warn("heartbeat update failed", { jobId, err: String(err) });
    }
  }, config.heartbeatIntervalMs);
}

export function stopHeartbeat(timer: ReturnType<typeof setInterval>): void {
  clearInterval(timer);
}
