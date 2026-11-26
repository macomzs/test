import { glossaryTerms, languages, marketplaces, translations, type Database, type TranslatedSections } from "@app/db";
import { checkGlossary, glossaryInstructions, relevantTerms, titleLimitFor, type SectionType } from "@app/domain";
import { emitEvent, writeAudit } from "@app/platform";
import { getQueue, QUEUES } from "@app/platform/queue";
import { and, eq } from "drizzle-orm";
import { getAiSettings } from "./ai-settings";
import { hashSections, sourceForScope } from "./content";
import { ClaudeTranslationProvider, MockTranslationProvider, type TranslationProvider } from "./providers";

export interface TranslateJob {
  productId: string;
  locale: string;
  scope: string;
  userId: string | null;
}

export class TranslationInputError extends Error {}

async function getProvider(db: Database): Promise<TranslationProvider> {
  const s = await getAiSettings(db);
  return s.provider === "claude" && s.apiKey ? new ClaudeTranslationProvider(s.apiKey, s.model) : new MockTranslationProvider();
}

/** Zapisuje zlecenie tłumaczenia i dodaje je do kolejki (wykona je worker). */
export async function enqueueTranslation(db: Database, job: TranslateJob): Promise<void> {
  const source = await sourceForScope(db, job.productId, job.scope);
  if (!source || !Object.keys(source).length) {
    throw new TranslationInputError("Produkt nie ma treści do przetłumaczenia – przypisz wzorzec oferty.");
  }
  await db
    .insert(translations)
    .values({ productId: job.productId, locale: job.locale, scope: job.scope, jobState: "QUEUED", jobError: null })
    .onConflictDoUpdate({
      target: [translations.productId, translations.locale, translations.scope],
      set: { jobState: "QUEUED", jobError: null, updatedAt: new Date() },
    });
  const boss = await getQueue();
  await boss.send(QUEUES.translate, job, { retryLimit: 2, retryDelay: 30, retryBackoff: true, singletonKey: `${job.productId}:${job.locale}:${job.scope}` });
}

/** Tłumaczy treść produktu (wywoływane przez workera). Wynik: status „Szkic AI”. */
export async function translateProduct(db: Database, job: TranslateJob): Promise<void> {
  const where = and(eq(translations.productId, job.productId), eq(translations.locale, job.locale), eq(translations.scope, job.scope));
  await db.update(translations).set({ jobState: "RUNNING", updatedAt: new Date() }).where(where);

  try {
    const source = await sourceForScope(db, job.productId, job.scope);
    if (!source || !Object.keys(source).length) throw new TranslationInputError("Brak treści do przetłumaczenia.");
    const [lang] = await db.select().from(languages).where(eq(languages.code, job.locale));
    if (!lang || lang.isSource) throw new TranslationInputError(`Nieobsługiwany język docelowy: ${job.locale}`);
    const [market] = job.scope !== "base" ? await db.select().from(marketplaces).where(eq(marketplaces.code, job.scope)) : [];

    const allTerms = await db.select().from(glossaryTerms);
    const joinedSource = Object.values(source).join("\n");
    const terms = relevantTerms(allTerms, job.locale, joinedSource);

    const provider = await getProvider(db);
    const result = await provider.translate({
      sourceLocale: "pl",
      targetLocale: job.locale,
      targetLanguageName: lang.name,
      channelName: market?.name,
      sections: source,
      glossaryInstructions: glossaryInstructions(terms),
    });

    const sections: TranslatedSections = {};
    const warnings: string[] = [];
    for (const [type, src] of Object.entries(source) as [SectionType, string][]) {
      const text = result.sections[type] ?? "";
      sections[type] = { source: src, text };
      warnings.push(...validateSection(type, src, text, allTerms, job.locale, market?.connectorKey));
    }

    await db
      .update(translations)
      .set({
        sections,
        sourceHash: hashSections(source),
        status: "AI_DRAFT",
        jobState: "DONE",
        jobError: null,
        provider: result.provider,
        warnings: [...new Set(warnings)],
        translatedAt: new Date(),
        reviewedById: null,
        reviewedAt: null,
        updatedAt: new Date(),
      })
      .where(where);
    await writeAudit(db, {
      actorId: job.userId,
      action: "translation.ai_completed",
      entityType: "product",
      entityId: job.productId,
      details: { locale: job.locale, scope: job.scope, provider: result.provider, warnings: warnings.length },
    });
    await emitEvent(db, "content.translation.drafted", { productId: job.productId, locale: job.locale, scope: job.scope });
  } catch (err) {
    await db.update(translations).set({ jobState: "FAILED", jobError: (err as Error).message.slice(0, 500), updatedAt: new Date() }).where(where);
    if (err instanceof TranslationInputError) return; // błąd danych – ponawianie nic nie da
    throw err;
  }
}

/** Kontrole jakości tłumaczenia – słownik, znaczniki braków, długość tytułu. */
export function validateSection(
  type: SectionType,
  source: string,
  text: string,
  terms: Parameters<typeof checkGlossary>[0],
  locale: string,
  connectorKey?: string,
): string[] {
  const label = type === "TITLE" ? "Tytuł" : type;
  const warnings = checkGlossary(terms, locale, source, text).map((w) => `${label}: ${w}`);
  const placeholders = source.match(/\[brak: [a-z_]+\]/g) ?? [];
  if (placeholders.length) warnings.push(`${label}: tekst źródłowy zawiera braki danych (${placeholders.join(", ")}) – uzupełnij produkt.`);
  if (type === "TITLE") {
    const limit = titleLimitFor(connectorKey);
    if (text.length > limit) warnings.push(`Tytuł ma ${text.length} znaków – limit to ${limit}.`);
  }
  const srcLines = source.split("\n").filter((l) => l.trim()).length;
  const dstLines = text.split("\n").filter((l) => l.trim()).length;
  if ((type === "BENEFITS" || type === "SET_CONTENTS") && srcLines !== dstLines) {
    warnings.push(`${label}: liczba punktów (${dstLines}) różni się od oryginału (${srcLines}).`);
  }
  return warnings;
}
