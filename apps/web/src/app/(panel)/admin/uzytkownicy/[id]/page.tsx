import { roles, userRoles, users } from "@app/db";
import { PERMISSIONS, resolvePermissions } from "@app/domain";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";
import { EditUserForm, ResetPasswordForm } from "../forms";

export const metadata = { title: "Edycja użytkownika" };

export default async function EditUserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ utworzono?: string }> }) {
  await requirePermission("users.manage");
  const { id } = await params;
  const { utworzono } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) notFound();
  const [roleList, assigned] = await Promise.all([
    db.select().from(roles).orderBy(asc(roles.name)),
    db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, id)),
  ]);
  const selected = assigned.map((a) => a.roleId);
  const effective = [...resolvePermissions(roleList.filter((r) => selected.includes(r.id)))];

  return (
    <>
      <PageHeader title={user.name} description={`${user.email} · utworzono ${formatDateTime(user.createdAt)} · ostatnie logowanie ${formatDateTime(user.lastLoginAt)}`} />
      {utworzono ? <Alert tone="success" className="mb-4">Użytkownik został utworzony.</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Dane i role" />
          <CardBody><EditUserForm user={user} roles={roleList} selectedRoleIds={selected} /></CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Uprawnienia wynikowe" description="Suma uprawnień ze wszystkich ról." />
            <CardBody className="flex flex-wrap gap-1">
              {effective.length ? effective.map((p) => <Badge key={p}>{PERMISSIONS[p]}</Badge>) : <span className="text-sm text-slate-500">Brak uprawnień</span>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Zmiana hasła" />
            <CardBody><ResetPasswordForm userId={user.id} /></CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
