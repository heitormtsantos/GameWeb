import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const migrationDirectory = new URL("../migrations/", import.meta.url);
export function postgres(config = {}) {
  const pool = new pg.Pool({
    ...(process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {}),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 10,
    ...config,
  });
  pool.on("error", () =>
    console.error("An idle database connection became unavailable."),
  );
  return {
    query: (text, params) => pool.query(text, params),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const value = await fn({
          query: (text, params) => client.query(text, params),
          exec: (text) => client.query(text),
        });
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
export async function migrate(db) {
  await db.transaction(async (tx) => {
    await tx.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum char(64) NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    // A row lock serializes migrations across application processes.
    await tx.exec("LOCK TABLE schema_migrations IN EXCLUSIVE MODE");
    for (const name of (await readdir(migrationDirectory))
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort()) {
      const sql = await readFile(new URL(name, migrationDirectory), "utf8"),
        checksum = createHash("sha256")
          .update(sql.replaceAll("\r\n", "\n"))
          .digest("hex");
      const existing = await tx.query(
        "SELECT checksum FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (existing.rows.length) {
        if (existing.rows[0].checksum !== checksum)
          throw new Error("Applied migration changed: " + name);
        continue;
      }
      await tx.exec(sql);
      await tx.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
    }
  });
}
