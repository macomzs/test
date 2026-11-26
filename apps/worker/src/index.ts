import { closeDb, getDb } from "@app/db";
import { writeAudit } from "@app/platform";
import { getQueue, QUEUES } from "@app/platform/queue";
import { dispatchOutbox } from "./outbox";

/**
 * Worker – przetwarza zadania w tle. W kolejnych etapach dojdą tu:
 * publikacja ofert, synchronizacja wiadomości z marketplace, tłumaczenia AI, liczniki SLA.
 */
const boss = await getQueue();

await boss.work<{ requestedBy?: string }>(QUEUES.systemPing, async ([job]) => {
  if (!job) return;
  await writeAudit(getDb(), {
    actorId: null,
    action: "system.ping.processed",
    entityType: "job",
    entityId: job.id,
    details: { requestedBy: job.data.requestedBy ?? null, processedAt: new Date().toISOString() },
  });
  console.log(`[worker] Zadanie testowe ${job.id} wykonane`);
});

await boss.work(QUEUES.outboxDispatch, async () => {
  const n = await dispatchOutbox();
  if (n > 0) console.log(`[worker] Rozesłano zdarzeń: ${n}`);
});
await boss.schedule(QUEUES.outboxDispatch, "* * * * *");

console.log("[worker] Uruchomiony – oczekuję na zadania");

async function shutdown() {
  console.log("[worker] Zatrzymywanie…");
  await boss.stop({ graceful: true });
  await closeDb();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
