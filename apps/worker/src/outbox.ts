import { getDb, outboxEvents } from "@app/db";
import { asc, eq, isNull, sql } from "drizzle-orm";

type Handler = (payload: Record<string, unknown>) => Promise<void>;

/**
 * Rejestr obsługi zdarzeń domenowych. Kolejne etapy dopisują tu reakcje, np.
 * "catalog.product.updated" → oznacz tłumaczenia jako nieaktualne.
 */
const handlers: Record<string, Handler[]> = {};

export function onEvent(type: string, handler: Handler) {
  (handlers[type] ??= []).push(handler);
}

/** Przetwarza paczkę oczekujących zdarzeń. FOR UPDATE SKIP LOCKED pozwala uruchomić wiele workerów. */
export async function dispatchOutbox(batchSize = 50): Promise<number> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const events = await tx
      .select()
      .from(outboxEvents)
      .where(isNull(outboxEvents.processedAt))
      .orderBy(asc(outboxEvents.createdAt))
      .limit(batchSize)
      .for("update", { skipLocked: true });

    for (const event of events) {
      try {
        for (const h of handlers[event.type] ?? []) await h(event.payload);
        await tx.update(outboxEvents).set({ processedAt: new Date() }).where(eq(outboxEvents.id, event.id));
      } catch (err) {
        await tx
          .update(outboxEvents)
          .set({ attempts: sql`${outboxEvents.attempts} + 1`, lastError: String(err) })
          .where(eq(outboxEvents.id, event.id));
      }
    }
    return events.length;
  });
}
