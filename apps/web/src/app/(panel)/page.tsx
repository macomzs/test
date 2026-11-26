import { channelAccounts, marketplaces, users } from "@app/db";
import { APP_MODULES, hasPermission } from "@app/domain";
import { count } from "drizzle-orm";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge, MarketplaceBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";

export default async function DashboardPage() {
  const user = await requireUser();
  const db = getDb();
  const [mkts, [accounts], [usersCount]] = await Promise.all([
    db.select().from(marketplaces).orderBy(marketplaces.name),
    db.select({ n: count() }).from(channelAccounts),
    db.select({ n: count() }).from(users),
  ]);

  return (
    <>
      <PageHeader title={`Dzień dobry, ${user.name}`} description="Centralny panel działu e-commerce: katalog, oferty, tłumaczenia, publikacja i obsługa klienta." />

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardBody><p className="text-sm text-slate-500">Marketplace w systemie</p><p className="mt-1 text-2xl font-semibold">{mkts.length}</p></CardBody></Card>
        <Card><CardBody><p className="text-sm text-slate-500">Podpięte konta</p><p className="mt-1 text-2xl font-semibold">{accounts?.n ?? 0}</p></CardBody></Card>
        <Card><CardBody><p className="text-sm text-slate-500">Użytkownicy</p><p className="mt-1 text-2xl font-semibold">{usersCount?.n ?? 0}</p></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Moduły systemu" description="Moduły powstają etapami – nieaktywne są oznaczone numerem etapu." />
        <ul className="divide-y divide-slate-100">
          {APP_MODULES.filter((m) => hasPermission(user.permissions, m.permission)).map((m) => (
            <li key={m.key} className="flex items-center justify-between gap-4 px-5 py-3">
              <div>
                <Link href={m.href} className="font-medium hover:underline">{m.label}</Link>
                <p className="text-sm text-slate-500">{m.description}</p>
              </div>
              <Badge tone="neutral">Etap {m.stage}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Kanały sprzedaży" />
        <CardBody className="flex flex-wrap gap-2">
          {mkts.map((m) => <MarketplaceBadge key={m.id} name={m.name} color={m.badgeColor} />)}
        </CardBody>
      </Card>
    </>
  );
}
