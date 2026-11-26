import { marketplaces, offerTemplates, channelOverrides } from "@app/db";
import { hasPermission, SECTION_LABELS, SECTION_TYPES, titleLimitFor } from "@app/domain";
import { loadProductContext, renderBase, renderForChannel } from "@app/services";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RenderedText } from "@/components/rendered-text";
import { Alert } from "@/components/ui/alert";
import { Badge, MarketplaceBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";
import { AssignTemplateForm, OverridesForm } from "./forms";

export const metadata = { title: "Treść oferty" };

export default async function OfferContentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kanal?: string }> }) {
  const user = await requirePermission("templates.read");
  const canWrite = hasPermission(user.permissions, "templates.write");
  const { id } = await params;
  const { kanal } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getDb();
  const ctx = await loadProductContext(db, id);
  if (!ctx) notFound();
  const { product, parent } = ctx;

  const [templates, mkts, overrideRows] = await Promise.all([
    db.select({ id: offerTemplates.id, name: offerTemplates.name }).from(offerTemplates).orderBy(asc(offerTemplates.name)),
    db.select().from(marketplaces).orderBy(asc(marketplaces.name)),
    db.select({ marketplaceId: channelOverrides.marketplaceId }).from(channelOverrides).where(eq(channelOverrides.productId, id)),
  ]);
  const withOverrides = new Set(overrideRows.map((o) => o.marketplaceId));
  const selected = mkts.find((m) => m.code === kanal);
  const base = renderBase(ctx);
  const channel = selected ? await renderForChannel(db, ctx, selected.id) : null;
  const parentTemplateName = parent?.templateId ? templates.find((t) => t.id === parent.templateId)?.name ?? null : null;
  const isParent = product.kind === "PARENT";

  return (
    <>
      <Link href={`/katalog/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="size-4" aria-hidden />Karta produktu</Link>
      <PageHeader title={`Treść oferty: ${product.name}`} description="Treść po polsku generowana ze wzorca i danych produktu. Dla wybranych kanałów możesz nadpisać sekcje bez zmiany wzorca." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Wzorzec" />
          <CardBody>
            {canWrite ? (
              <AssignTemplateForm productId={id} current={product.templateId} templates={templates} inheritedName={parentTemplateName} />
            ) : (
              <p className="text-sm">{ctx.template?.name ?? "Brak wzorca"}</p>
            )}
            {isParent ? <p className="mt-3 text-xs text-slate-500">Wzorzec produktu głównego dziedziczą wszystkie jego warianty.</p> : null}
            {ctx.template ? <Link href={`/wzorce/${ctx.template.id}`} className="mt-3 inline-block text-sm text-brand-700 hover:underline">Edytuj wzorzec „{ctx.template.name}” →</Link> : null}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Treść bazowa (PL)" description="Wynik wzorca dla tego produktu." />
          <CardBody className="space-y-4">
            {!ctx.template ? <Alert tone="info">Przypisz wzorzec, aby wygenerować treść oferty.</Alert> : null}
            {isParent && ctx.template ? <Alert tone="info">To produkt główny – oferty powstają dla wariantów. Podgląd treści zobaczysz na karcie wariantu.</Alert> : null}
            {!isParent && SECTION_TYPES.filter((t) => base[t]).map((t) => (
              <div key={t}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{SECTION_LABELS[t]}</p>
                <RenderedText type={t} result={base[t]!} limit={t === "TITLE" ? titleLimitFor(null) : undefined} />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {!isParent && ctx.template ? (
        <Card className="mt-6">
          <CardHeader title="Nadpisania per kanał" description="Wybierz marketplace, aby zobaczyć gotową treść dla tego kanału i ewentualnie ją dostosować." />
          <CardBody className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {mkts.map((m) => (
                <Link key={m.id} href={`?kanal=${m.code}`} className={`rounded-md border px-2 py-1 ${selected?.id === m.id ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <MarketplaceBadge name={m.name} color={m.badgeColor} />
                  {withOverrides.has(m.id) ? <Badge tone="info" className="ml-1">nadpisania</Badge> : null}
                </Link>
              ))}
            </div>
            {channel && selected ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Treść dla {selected.name} (PL, przed tłumaczeniem na „{selected.defaultLocale}”)</h3>
                  {SECTION_TYPES.filter((t) => channel.sections[t]).map((t) => (
                    <div key={t}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {SECTION_LABELS[t]} {channel.overridden.includes(t) ? <Badge tone="info" className="ml-1">nadpisane</Badge> : null}
                      </p>
                      <RenderedText type={t} result={channel.sections[t]!} limit={t === "TITLE" ? titleLimitFor(selected.connectorKey) : undefined} />
                    </div>
                  ))}
                </div>
                <div>
                  {canWrite ? (
                    <OverridesForm key={selected.id} productId={id} marketplaceId={selected.id} marketplaceName={selected.name} overrides={channel.rawOverrides} />
                  ) : (
                    <p className="text-sm text-slate-500">Brak uprawnień do edycji nadpisań.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Wybierz kanał powyżej.</p>
            )}
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
