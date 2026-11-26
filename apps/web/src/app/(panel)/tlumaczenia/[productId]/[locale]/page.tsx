import { channelOverrides, languages, marketplaces, translations, users } from "@app/db";
import { hasPermission, SECTION_TYPES, type SectionType } from "@app/domain";
import { getAiSettings, hashSections, loadProductContext, sourceForScope } from "@app/services";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { STATUS_TONES, TRANSLATION_STATUS_LABELS } from "@/lib/translations";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";
import { TranslationEditor } from "./editor";

export const metadata = { title: "Edytor tłumaczenia" };
export const dynamic = "force-dynamic";

export default async function TranslationEditorPage({ params, searchParams }: { params: Promise<{ productId: string; locale: string }>; searchParams: Promise<{ zakres?: string }> }) {
  const user = await requirePermission("translations.read");
  const { productId, locale } = await params;
  const { zakres } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !/^[a-z]{2,3}$/.test(locale)) notFound();
  const db = getDb();
  const [lang] = await db.select().from(languages).where(eq(languages.code, locale));
  const ctx = await loadProductContext(db, productId);
  if (!lang || lang.isSource || !ctx) notFound();

  // Zakresy: treść bazowa + kanały, które mają nadpisania.
  const channelScopes = await db
    .selectDistinct({ code: marketplaces.code, name: marketplaces.name, locale: marketplaces.defaultLocale })
    .from(channelOverrides)
    .innerJoin(marketplaces, eq(marketplaces.id, channelOverrides.marketplaceId))
    .where(eq(channelOverrides.productId, productId))
    .orderBy(asc(marketplaces.name));
  const scope = channelScopes.some((c) => c.code === zakres) ? zakres! : "base";

  const [source, [row], ai] = await Promise.all([
    sourceForScope(db, productId, scope),
    db.select({ t: translations, reviewer: users.name }).from(translations).leftJoin(users, eq(users.id, translations.reviewedById)).where(and(eq(translations.productId, productId), eq(translations.locale, locale), eq(translations.scope, scope))),
    getAiSettings(db),
  ]);
  const t = row?.t;
  const busy = t?.jobState === "QUEUED" || t?.jobState === "RUNNING";
  const stale = !!t?.sourceHash && !!source && t.sourceHash !== hashSections(source);
  const hasContent = !!t && (!!t.translatedAt || !!t.provider);

  const sections = SECTION_TYPES.filter((type) => source?.[type] !== undefined).map((type: SectionType) => ({
    type,
    source: source![type]!,
    text: t?.sections[type]?.text ?? "",
    sourceChanged: !!t?.sections[type] && t.sections[type]!.source !== source![type],
  }));

  return (
    <>
      <AutoRefresh active={busy} />
      <Link href="/tlumaczenia" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="size-4" aria-hidden />Tłumaczenia</Link>
      <PageHeader
        title={`${ctx.product.name} → ${lang.name}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {hasContent ? <Badge tone={STATUS_TONES[t!.status]}>{TRANSLATION_STATUS_LABELS[t!.status]}</Badge> : <Badge>Brak tłumaczenia</Badge>}
            {stale ? <Badge tone="danger">nieaktualne</Badge> : null}
            {t?.provider ? <span>źródło: {t.provider === "mock" ? "tryb testowy" : t.provider === "manual" ? "ręcznie" : t.provider}</span> : null}
            {t?.reviewedAt ? <span>· zatwierdził(a): {row?.reviewer ?? "—"}, {formatDateTime(t.reviewedAt)}</span> : null}
          </span>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="?" className={`rounded-md border px-3 py-1 ${scope === "base" ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"}`}>Treść bazowa</Link>
        {channelScopes.map((c) => (
          <Link key={c.code} href={`?zakres=${c.code}`} className={`rounded-md border px-3 py-1 ${scope === c.code ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"}`}>
            Nadpisania: {c.name}{c.locale !== locale ? <span className="text-slate-400"> (rynek: {c.locale.toUpperCase()})</span> : null}
          </Link>
        ))}
      </div>

      {busy ? <Alert tone="info" className="mb-4">Trwa tłumaczenie AI – strona odświeży się automatycznie.</Alert> : null}
      {t?.jobState === "FAILED" ? <Alert tone="error" className="mb-4">Tłumaczenie AI nie powiodło się: {t.jobError}</Alert> : null}
      {stale ? <Alert tone="warning" className="mb-4">Polski oryginał zmienił się po tłumaczeniu. Popraw tłumaczenie i zapisz albo przetłumacz ponownie – zatwierdzenie jest zablokowane do czasu aktualizacji.</Alert> : null}
      {ai.provider === "mock" && !hasContent ? <Alert tone="warning" className="mb-4">Tryb testowy – tłumaczenie AI doda tylko znacznik języka. Prawdziwe tłumaczenia po dodaniu klucza API w „Integracje AI”.</Alert> : null}
      {t?.warnings.length ? (
        <Alert tone="warning" className="mb-4">
          <p className="font-medium">Kontrola jakości ({t.warnings.length}):</p>
          <ul className="mt-1 list-disc pl-5">{t.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Alert>
      ) : null}

      {sections.length === 0 ? (
        <Alert tone="info">Produkt nie ma treści do tłumaczenia – przypisz wzorzec oferty (karta produktu → „Treść oferty”).</Alert>
      ) : (
        <TranslationEditor
          key={`${scope}-${t?.translatedAt?.toISOString() ?? "new"}`}
          productId={productId}
          locale={locale}
          scope={scope}
          languageName={lang.name}
          sections={sections}
          status={hasContent ? t!.status : null}
          busy={busy}
          canWrite={hasPermission(user.permissions, "translations.write")}
          canApprove={hasPermission(user.permissions, "translations.approve")}
        />
      )}
    </>
  );
}
