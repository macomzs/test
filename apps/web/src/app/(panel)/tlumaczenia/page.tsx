import { languages, offerTemplates, products, translations } from "@app/db";
import { hasPermission } from "@app/domain";
import { getAiSettings, hashSections, loadProductContext, renderBase } from "@app/services";
import { and, asc, eq, ilike, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";
import { TranslationMatrix, type MatrixRow } from "./matrix";

export const metadata = { title: "Tłumaczenia" };
export const dynamic = "force-dynamic";

export default async function TranslationsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePermission("translations.read");
  const canWrite = hasPermission(user.permissions, "translations.write");
  const { q = "" } = await searchParams;
  const db = getDb();
  const parent = alias(products, "parent");

  const term = `%${q.trim().replace(/[%_]/g, "")}%`;
  const candidates = await db
    .select({ id: products.id, name: products.name, ean: products.ean, templateId: sql<string>`coalesce(${products.templateId}, ${parent.templateId})` })
    .from(products)
    .leftJoin(parent, eq(parent.id, products.parentId))
    .where(
      and(
        ne(products.kind, "PARENT"),
        or(isNotNull(products.templateId), isNotNull(parent.templateId)),
        q.trim() ? or(ilike(products.name, term), ilike(products.ean, term), ilike(products.sku, term)) : undefined,
      ),
    )
    .orderBy(asc(products.name))
    .limit(100);

  const [langs, tpls, rows, ai] = await Promise.all([
    db.select().from(languages).where(and(eq(languages.isActive, true), eq(languages.isSource, false))).orderBy(asc(languages.position)),
    db.select({ id: offerTemplates.id, name: offerTemplates.name }).from(offerTemplates),
    candidates.length ? db.select().from(translations).where(and(inArray(translations.productId, candidates.map((c) => c.id)), eq(translations.scope, "base"))) : [],
    getAiSettings(db),
  ]);
  const tplName = new Map(tpls.map((t) => [t.id, t.name]));

  // Aktualny skrót treści PL – do wykrycia nieaktualnych tłumaczeń.
  const currentHash = new Map<string, string>();
  for (const c of candidates) {
    const ctx = await loadProductContext(db, c.id);
    if (ctx) currentHash.set(c.id, hashSections(Object.fromEntries(Object.entries(renderBase(ctx)).map(([k, v]) => [k, v!.text]))));
  }

  const matrix: MatrixRow[] = candidates.map((c) => ({
    id: c.id,
    name: c.name,
    ean: c.ean,
    templateName: tplName.get(c.templateId) ?? "—",
    cells: Object.fromEntries(
      rows
        .filter((r) => r.productId === c.id)
        .map((r) => [
          r.locale,
          {
            status: r.translatedAt || r.provider ? r.status : null,
            jobState: r.jobState,
            jobError: r.jobError,
            stale: !!r.sourceHash && r.sourceHash !== currentHash.get(c.id),
            warnings: r.warnings.length,
          },
        ]),
    ),
  }));
  const pending = rows.some((r) => r.jobState === "QUEUED" || r.jobState === "RUNNING");

  return (
    <>
      <AutoRefresh active={pending} />
      <PageHeader
        title="Tłumaczenia"
        description="Tłumaczenia treści ofert z języka polskiego. Workflow: Szkic AI → Do akceptacji → Zatwierdzone. Kliknij komórkę, aby otworzyć edytor porównawczy."
        actions={<ButtonLink href="/tlumaczenia/slownik" variant="secondary">Słownik terminologii</ButtonLink>}
      />
      {ai.provider === "mock" ? (
        <Alert tone="warning" className="mb-4">
          Tryb testowy tłumaczeń – zamiast tłumaczenia AI tekst dostaje znacznik języka, np. „[DE] …”.
          {hasPermission(user.permissions, "system.manage") ? <> Aby włączyć tłumaczenia Claude, dodaj klucz API w <Link href="/admin/integracje" className="font-medium underline">Integracje AI</Link>.</> : " Poproś administratora o konfigurację klucza API."}
        </Alert>
      ) : null}
      <form className="mb-4 flex gap-2">
        <Input name="q" placeholder="Szukaj: nazwa, EAN lub SKU" defaultValue={q} className="w-80" />
        <Button type="submit" variant="secondary">Szukaj</Button>
      </form>
      <TranslationMatrix rows={matrix} languages={langs.map((l) => ({ code: l.code, name: l.name }))} canWrite={canWrite} />
      {candidates.length === 100 ? <p className="mt-2 text-sm text-slate-500">Pokazano pierwsze 100 produktów – zawęź wyszukiwanie.</p> : null}
    </>
  );
}
