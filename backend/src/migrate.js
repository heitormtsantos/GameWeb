import { postgres, migrate } from "./database.js";
const db = postgres();
try {
  await migrate(db);
  console.log("Database migrations applied.");
} finally {
  await db.close();
}
