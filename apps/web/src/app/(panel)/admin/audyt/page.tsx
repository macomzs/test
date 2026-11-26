import { auditLogs, users } from "@app/db";
import { and, count, desc, eq, gte, like, type SQL } from "drizzle-orm";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { AUDIT_ACTION_LABELS, auditLabel } from "@/lib/audit-labels";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";

export const metadata = { title: "Logi audytowe" };
const PAGE_SIZE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ akcja?: string; obiekt?: string; strona?: string }> }) {
  await requirePermission("audit.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.strona) || 1);
  const filters: SQL[] = [gte(auditLogs.createdAt, new Date(Date.now() - 1000 * 60 * 60 * 24 * 365))];
  if (sp.akcja) filters.push(eq(auditLogs.action, sp.akcja));
  if (sp.obiekt) filters.push(like(auditLogs.entityId, `%${sp.obiekt.replace(/[%_]/g, "")}%`));
  const where = and(...filters);

  const db = getDb();
  const [rows, [total]] = await Promise.all([
    db
      .select({ log: auditLogs, actorName: users.name, actorEmail: users.email })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(auditLogs).where(where),
  ]);
  const pages = Math.max(1, Math.ceil((total?.n ?? 0) / PAGE_SIZE));
  const qs = (p: number) => `?${new URLSearchParams({ ...(sp.akcja ? { akcja: sp.akcja } : {}), ...(sp.obiekt ? { obiekt: sp.obiekt } : {}), strona: String(p) })}`;

  return (
    <>
      <PageHeader title="Logi audytowe" description="Historia kluczowych operacji: logowania, zmiany użytkowników, kluczy API i (w kolejnych etapach) produktów, tłumaczeń i publikacji." />
      <form className="mb-4 flex flex-wrap gap-2">
        <Select name="akcja" defaultValue={sp.akcja ?? ""} className="w-64">
          <option value="">Wszystkie akcje</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Input name="obiekt" placeholder="ID obiektu lub e-mail" defaultValue={sp.obiekt ?? ""} className="w-64" />
        <Button type="submit" variant="secondary">Filtruj</Button>
        {sp.akcja || sp.obiekt ? <ButtonLink href="/admin/audyt" variant="ghost">Wyczyść</ButtonLink> : null}
      </form>
      <Card>
        <Table>
          <thead><tr><Th>Data</Th><Th>Kto</Th><Th>Akcja</Th><Th>Obiekt</Th><Th>Szczegóły</Th></tr></thead>
          <tbody>
            {rows.length === 0 ? <EmptyRow colSpan={5}>Brak wpisów.</EmptyRow> : null}
            {rows.map(({ log, actorName, actorEmail }) => (
              <tr key={log.id}>
                <Td className="whitespace-nowrap text-slate-500">{formatDateTime(log.createdAt)}</Td>
                <Td>{actorName ? <span title={actorEmail ?? ""}>{actorName}</span> : <Badge>System</Badge>}{log.ip ? <span className="block text-xs text-slate-400">{log.ip}</span> : null}</Td>
                <Td><Badge tone={log.action.endsWith("failed") ? "danger" : "neutral"}>{auditLabel(log.action)}</Badge></Td>
                <Td className="text-xs text-slate-500">{log.entityType}<span className="block font-mono">{log.entityId}</span></Td>
                <Td>{Object.keys(log.details).length ? <pre className="max-w-md overflow-x-auto whitespace-pre-wrap text-xs text-slate-600">{JSON.stringify(log.details, null, 1)}</pre> : null}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>Wpisów: {total?.n ?? 0}</span>
        <div className="flex items-center gap-2">
          {page > 1 ? <Link className="hover:underline" href={qs(page - 1)}>← Poprzednia</Link> : null}
          <span>Strona {page} z {pages}</span>
          {page < pages ? <Link className="hover:underline" href={qs(page + 1)}>Następna →</Link> : null}
        </div>
      </div>
    </>
  );
}
