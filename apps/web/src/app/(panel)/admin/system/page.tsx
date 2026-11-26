import { auditLogs, outboxEvents } from "@app/db";
import { count, desc, eq, isNull, sql } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";
import { PingForm } from "./ping-form";

export const metadata = { title: "Zadania w tle" };
export const dynamic = "force-dynamic";

const STATE_LABELS: Record<string, string> = {
  created: "Oczekuje",
  retry: "Ponowienie",
  active: "W trakcie",
  completed: "Zakończone",
  cancelled: "Anulowane",
  failed: "Błąd",
};

export default async function SystemPage() {
  await requirePermission("system.manage");
  const db = getDb();

  let queueStats: { name: string; state: string; n: number }[] = [];
  try {
    const res = await db.execute<{ name: string; state: string; n: number }>(
      sql`select name, state::text as state, count(*)::int as n from pgboss.job group by 1, 2 order by 1, 2`,
    );
    queueStats = res.rows;
  } catch {
    // schemat kolejki powstaje przy pierwszym uruchomieniu workera
  }
  const [[pendingOutbox], lastPings] = await Promise.all([
    db.select({ n: count() }).from(outboxEvents).where(isNull(outboxEvents.processedAt)),
    db.select().from(auditLogs).where(eq(auditLogs.action, "system.ping.processed")).orderBy(desc(auditLogs.createdAt)).limit(5),
  ]);

  return (
    <>
      <PageHeader title="Zadania w tle" description="Kolejka zadań (publikacja ofert, synchronizacja wiadomości, tłumaczenia AI) obsługiwana przez proces „worker”." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Test działania kolejki" description="Wysyła zadanie do workera. Jeśli worker działa, wynik pojawi się poniżej." />
          <CardBody className="space-y-4">
            <PingForm />
            <ul className="space-y-1 text-sm">
              {lastPings.length === 0 ? <li className="text-slate-500">Brak wykonanych zadań testowych.</li> : null}
              {lastPings.map((p) => (
                <li key={p.id} className="flex justify-between"><span>Wykonano zadanie <span className="font-mono text-xs">{p.entityId?.slice(0, 8)}</span></span><span className="text-slate-500">{formatDateTime(p.createdAt)}</span></li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Zdarzenia domenowe (outbox)" />
          <CardBody>
            <p className="text-sm">Nieprzetworzone zdarzenia: <Badge tone={(pendingOutbox?.n ?? 0) > 0 ? "warning" : "success"}>{pendingOutbox?.n ?? 0}</Badge></p>
          </CardBody>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Stan kolejek" />
        <Table>
          <thead><tr><Th>Kolejka</Th><Th>Status</Th><Th>Liczba zadań</Th></tr></thead>
          <tbody>
            {queueStats.length === 0 ? <EmptyRow colSpan={3}>Brak zadań – worker jeszcze nie był uruchomiony.</EmptyRow> : null}
            {queueStats.map((s) => (
              <tr key={`${s.name}-${s.state}`}>
                <Td className="font-mono text-xs">{s.name}</Td>
                <Td><Badge tone={s.state === "failed" ? "danger" : s.state === "completed" ? "success" : "neutral"}>{STATE_LABELS[s.state] ?? s.state}</Badge></Td>
                <Td>{s.n}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
