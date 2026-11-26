import { PERMISSIONS, isPermission } from "@app/domain";
import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export default async function NoAccessPage({ searchParams }: { searchParams: Promise<{ wymagane?: string }> }) {
  const { wymagane } = await searchParams;
  const label = wymagane && isPermission(wymagane) ? PERMISSIONS[wymagane] : null;
  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-3 py-16 text-center">
        <ShieldAlert className="size-8 text-amber-500" aria-hidden />
        <p className="text-lg font-semibold">Brak dostępu</p>
        <p className="max-w-md text-sm text-slate-500">
          Twoja rola nie pozwala na wykonanie tej operacji{label ? ` (wymagane uprawnienie: „${label}”)` : ""}. Jeśli potrzebujesz dostępu, poproś administratora.
        </p>
        <ButtonLink href="/" variant="secondary">Wróć na pulpit</ButtonLink>
      </CardBody>
    </Card>
  );
}
