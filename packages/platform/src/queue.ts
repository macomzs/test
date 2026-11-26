import { PgBoss } from "pg-boss";

/**
 * Kolejka zadań oparta o PostgreSQL (pg-boss) – bez dodatkowej usługi typu Redis.
 * Nazwy kolejek trzymamy w jednym miejscu.
 */
export const QUEUES = {
  systemPing: "system.ping",
  outboxDispatch: "system.outbox-dispatch",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

const g = globalThis as unknown as { __appBoss?: Promise<PgBoss> };

export function getQueue(): Promise<PgBoss> {
  g.__appBoss ??= (async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Brak zmiennej środowiskowej DATABASE_URL");
    const boss = new PgBoss({ connectionString: url, schema: "pgboss" });
    boss.on("error", (err: unknown) => console.error("[kolejka]", err));
    await boss.start();
    for (const name of Object.values(QUEUES)) await boss.createQueue(name);
    return boss;
  })();
  return g.__appBoss;
}
