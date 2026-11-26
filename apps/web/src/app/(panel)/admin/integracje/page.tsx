import { getAiSettings } from "@app/services";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";
import { AiSettingsForm } from "./forms";

export const metadata = { title: "Integracje AI" };
export const dynamic = "force-dynamic";

export default async function AiIntegrationPage() {
  await requirePermission("system.manage");
  const s = await getAiSettings(getDb());
  return (
    <>
      <PageHeader title="Integracje AI" description="Tłumaczenia ofert (Etap 4), a w kolejnych etapach także tłumaczenie wiadomości od klientów i podpowiedzi odpowiedzi." />
      <Card>
        <CardHeader
          title="Tłumaczenia – Claude"
          description={<span className="flex items-center gap-2">Aktualny tryb: {s.provider === "claude" ? <Badge tone="success">Claude ({s.model})</Badge> : <Badge tone="warning">Tryb testowy</Badge>}</span>}
        />
        <CardBody>
          <AiSettingsForm provider={s.provider} model={s.model} apiKeyMasked={s.apiKeyMasked} />
          <p className="mt-4 text-xs text-slate-500">Treści ofert są wysyłane do Anthropic API wyłącznie w celu tłumaczenia. Koszt zależy od liczby i długości tłumaczeń – zobaczysz go w konsoli Anthropic.</p>
        </CardBody>
      </Card>
    </>
  );
}
