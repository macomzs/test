import { auditLogs, outboxEvents, type Database } from "@app/db";

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string | null;
}

/** Zapisuje wpis w logu audytowym. Przekaż `tx`, aby wpis był częścią tej samej transakcji. */
export async function writeAudit(db: Database | Tx, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    details: entry.details ?? {},
    ip: entry.ip ?? null,
  });
}

/** Dodaje zdarzenie domenowe do outboxa (najlepiej w tej samej transakcji co zmiana). */
export async function emitEvent(db: Database | Tx, type: string, payload: Record<string, unknown> = {}): Promise<void> {
  await db.insert(outboxEvents).values({ type, payload });
}
