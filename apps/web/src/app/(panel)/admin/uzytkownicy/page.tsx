import { roles, userRoles, users } from "@app/db";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";

export const metadata = { title: "Użytkownicy" };

export default async function UsersPage() {
  await requirePermission("users.manage");
  const db = getDb();
  const [list, links] = await Promise.all([
    db.select().from(users).orderBy(asc(users.name)),
    db.select({ userId: userRoles.userId, name: roles.name }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)),
  ]);
  const rolesByUser = new Map<string, string[]>();
  for (const l of links) rolesByUser.set(l.userId, [...(rolesByUser.get(l.userId) ?? []), l.name]);

  return (
    <>
      <PageHeader title="Użytkownicy i role" description="Konta pracowników i ich role. Rola decyduje, które moduły są widoczne." actions={<ButtonLink href="/admin/uzytkownicy/nowy">Dodaj użytkownika</ButtonLink>} />
      <Card>
        <Table>
          <thead><tr><Th>Imię i nazwisko</Th><Th>E-mail</Th><Th>Role</Th><Th>Status</Th><Th>Ostatnie logowanie</Th></tr></thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <Td><Link href={`/admin/uzytkownicy/${u.id}`} className="font-medium text-brand-700 hover:underline">{u.name}</Link></Td>
                <Td>{u.email}</Td>
                <Td><div className="flex flex-wrap gap-1">{(rolesByUser.get(u.id) ?? []).map((r) => <Badge key={r} tone="info">{r}</Badge>)}</div></Td>
                <Td>{u.isActive ? <Badge tone="success">Aktywne</Badge> : <Badge tone="danger">Zablokowane</Badge>}</Td>
                <Td className="text-slate-500">{formatDateTime(u.lastLoginAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
