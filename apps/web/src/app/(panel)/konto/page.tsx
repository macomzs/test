import { PERMISSIONS } from "@app/domain";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/server/auth";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Moje konto" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Moje konto" description={user.email} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Zmiana hasła" />
          <CardBody><PasswordForm /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Moje role i uprawnienia" />
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-1">{user.roles.map((r) => <Badge key={r.code} tone="info">{r.name}</Badge>)}</div>
            <div className="flex flex-wrap gap-1">{[...user.permissions].map((p) => <Badge key={p}>{PERMISSIONS[p]}</Badge>)}</div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
