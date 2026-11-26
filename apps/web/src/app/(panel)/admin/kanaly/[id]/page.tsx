import { channelAccounts, marketplaces } from "@app/db";
import { credentialFieldsFor } from "@app/domain";
import { decryptJson, maskSecret } from "@app/platform";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { MarketplaceBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";
import { EditChannelAccountForm } from "../forms";

export const metadata = { title: "Konto marketplace" };

export default async function ChannelAccountPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("channels.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await getDb()
    .select({ account: channelAccounts, marketplace: marketplaces })
    .from(channelAccounts)
    .innerJoin(marketplaces, eq(marketplaces.id, channelAccounts.marketplaceId))
    .where(eq(channelAccounts.id, id));
  if (!row) notFound();
  const { account, marketplace } = row;

  let masked: Record<string, string> = {};
  let decryptError = false;
  if (account.credentialsEncrypted) {
    try {
      const creds = decryptJson<Record<string, string>>(account.credentialsEncrypted, undefined, account.id);
      masked = Object.fromEntries(Object.entries(creds).map(([k, v]) => [k, maskSecret(v)]));
    } catch {
      decryptError = true;
    }
  }

  return (
    <>
      <PageHeader title={account.name} description={<span className="flex items-center gap-2"><MarketplaceBadge name={marketplace.name} color={marketplace.badgeColor} /> utworzono {formatDateTime(account.createdAt)}</span>} />
      {decryptError ? <Alert tone="error" className="mb-4">Nie udało się odszyfrować poświadczeń – sprawdź konfigurację kluczy szyfrujących (APP_ENCRYPTION_KEYS).</Alert> : null}
      <Card>
        <CardHeader title="Ustawienia konta" />
        <CardBody>
          <EditChannelAccountForm account={account} fields={credentialFieldsFor(marketplace.connectorKey)} masked={masked} />
        </CardBody>
      </Card>
    </>
  );
}
