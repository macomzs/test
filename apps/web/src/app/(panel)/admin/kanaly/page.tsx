import { channelAccounts, marketplaces } from "@app/db";
import { credentialFieldsFor } from "@app/domain";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge, MarketplaceBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";
import { CreateChannelAccountForm } from "./forms";

export const metadata = { title: "Kanały i klucze API" };

const statusBadge = {
  ACTIVE: <Badge tone="success">Aktywne</Badge>,
  DISABLED: <Badge>Wyłączone</Badge>,
  AUTH_ERROR: <Badge tone="danger">Błąd autoryzacji</Badge>,
};

export default async function ChannelsPage() {
  await requirePermission("channels.manage");
  const db = getDb();
  const [mkts, accounts] = await Promise.all([
    db.select().from(marketplaces).orderBy(asc(marketplaces.name)),
    db
      .select({ account: channelAccounts, marketplace: marketplaces })
      .from(channelAccounts)
      .innerJoin(marketplaces, eq(marketplaces.id, channelAccounts.marketplaceId))
      .orderBy(asc(marketplaces.name), asc(channelAccounts.name)),
  ]);

  return (
    <>
      <PageHeader title="Kanały i klucze API" description="Konta firmy na marketplace'ach. Klucze API i tokeny są przechowywane w postaci zaszyfrowanej." />
      <Card>
        <Table>
          <thead><tr><Th>Marketplace</Th><Th>Konto</Th><Th>Status</Th><Th>Poświadczenia</Th><Th>Ostatnia zmiana kluczy</Th></tr></thead>
          <tbody>
            {accounts.length === 0 ? <EmptyRow colSpan={5}>Nie dodano jeszcze żadnego konta.</EmptyRow> : null}
            {accounts.map(({ account, marketplace }) => (
              <tr key={account.id} className="hover:bg-slate-50">
                <Td><MarketplaceBadge name={marketplace.name} color={marketplace.badgeColor} /></Td>
                <Td><Link href={`/admin/kanaly/${account.id}`} className="font-medium text-brand-700 hover:underline">{account.name}</Link></Td>
                <Td>{statusBadge[account.status]}</Td>
                <Td>{account.credentialsEncrypted ? <Badge tone="info">Zaszyfrowane (klucz v{account.credentialsKeyVersion})</Badge> : <Badge tone="warning">Brak</Badge>}</Td>
                <Td className="text-slate-500">{formatDateTime(account.credentialsUpdatedAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Dodaj konto marketplace" description="W MVP konektory działają w trybie symulacji – prawdziwe połączenia z API dojdą w etapach 7–9." />
        <CardBody>
          <CreateChannelAccountForm marketplaces={mkts.map((m) => ({ id: m.id, name: `${m.name} (${m.country}, ${m.currency})`, fields: credentialFieldsFor(m.connectorKey) }))} />
        </CardBody>
      </Card>
    </>
  );
}
