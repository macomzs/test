import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { closeDb, getDb } from "./client";

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

await migrate(getDb(), { migrationsFolder });
console.log("✔ Migracje bazy danych zastosowane");
await closeDb();
