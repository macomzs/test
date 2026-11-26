import { roles } from "@app/db";
import { asc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";
import { CreateUserForm } from "../forms";

export const metadata = { title: "Nowy użytkownik" };

export default async function NewUserPage() {
  await requirePermission("users.manage");
  const roleList = await getDb().select().from(roles).orderBy(asc(roles.name));
  return (
    <>
      <PageHeader title="Nowy użytkownik" />
      <Card><CardBody><CreateUserForm roles={roleList} /></CardBody></Card>
    </>
  );
}
