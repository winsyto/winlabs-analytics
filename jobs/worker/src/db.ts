import { Pool } from "pg";
import { config } from "./config.js";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err: Error) => {
  process.stderr.write(
    JSON.stringify({ ts: new Date().toISOString(), level: "error", msg: "pg pool error", data: err.message }) + "\n"
  );
});
