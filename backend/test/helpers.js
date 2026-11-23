import { PGlite } from "@electric-sql/pglite";
import { migrate } from "../src/database.js";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
export async function memoryDatabase() {
  const engine = new PGlite();
  const db = {
    query: (text, params) => engine.query(text, params),
    transaction: (fn) =>
      engine.transaction((tx) =>
        fn({
          query: (text, params) => tx.query(text, params),
          exec: (text) => tx.exec(text),
        }),
      ),
    close: () => engine.close(),
  };
  await migrate(db);
  return db;
}
export async function fixture(overrides = {}) {
  const db = await memoryDatabase(),
    config = { ...readConfig({}), authMax: 1000, ...overrides };
  const app = await buildApp({ db, config });
  await app.ready();
  return { app, db, config };
}
