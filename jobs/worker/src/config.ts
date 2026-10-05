function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  databaseUrl: required("DATABASE_URL"),
  workerId: process.env.WORKER_ID ?? `worker-${process.pid}`,
  schedulerEnabled: process.env.SCHEDULER_ENABLED !== "false",
  processorEnabled: process.env.PROCESSOR_ENABLED !== "false",
  schedulerIntervalMs: Number(process.env.SCHEDULER_INTERVAL_SECONDS ?? 60) * 1000,
  processorPollMs: Number(process.env.PROCESSOR_POLL_INTERVAL_SECONDS ?? 10) * 1000,
  heartbeatIntervalMs: Number(process.env.JOB_HEARTBEAT_SECONDS ?? 30) * 1000,
  maxConcurrentJobs: Number(process.env.MAX_CONCURRENT_JOBS ?? 2),
  staleJobThresholdMs: 15 * 60 * 1000,

  // Cloudflare R2 (S3-compatible)
  r2Endpoint: required("R2_ENDPOINT"),
  r2AccessKeyId: required("R2_ACCESS_KEY_ID"),
  r2SecretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  r2Bucket: required("R2_BUCKET"),
};
