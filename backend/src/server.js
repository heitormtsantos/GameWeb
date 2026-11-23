import { postgres, migrate } from "./database.js";
import { buildApp } from "./app.js";
import { readConfig } from "./config.js";
const config = readConfig(),
  db = postgres();
try {
  await migrate(db);
  const app = await buildApp({ db, config, logger: true });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => app.close().then(() => process.exit(0)));
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  console.error("API startup failed:", error.message);
  await db.close();
  process.exitCode = 1;
}
