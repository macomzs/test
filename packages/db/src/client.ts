import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __appPool?: pg.Pool; __appDb?: Database };

/** Jedna pula połączeń na proces (bezpieczne przy hot-reloadzie w trybie dev). */
export function getDb(): Database {
  if (!globalForDb.__appDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Brak zmiennej środowiskowej DATABASE_URL");
    globalForDb.__appPool = new pg.Pool({ connectionString: url, max: 10 });
    globalForDb.__appDb = drizzle(globalForDb.__appPool, { schema });
  }
  return globalForDb.__appDb;
}

export async function closeDb(): Promise<void> {
  await globalForDb.__appPool?.end();
  globalForDb.__appPool = undefined;
  globalForDb.__appDb = undefined;
}
