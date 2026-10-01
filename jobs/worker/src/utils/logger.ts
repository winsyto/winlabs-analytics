type Level = "debug" | "info" | "warn" | "error";

function log(level: Level, msg: string, data?: unknown): void {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
  };
  if (data !== undefined) entry.data = data;

  const line = JSON.stringify(entry) + "\n";
  if (level === "error") process.stderr.write(line);
  else process.stdout.write(line);
}

export const logger = {
  debug: (msg: string, data?: unknown) => log("debug", msg, data),
  info:  (msg: string, data?: unknown) => log("info",  msg, data),
  warn:  (msg: string, data?: unknown) => log("warn",  msg, data),
  error: (msg: string, data?: unknown) => log("error", msg, data),
};
