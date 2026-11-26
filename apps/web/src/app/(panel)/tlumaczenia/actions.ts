"use server";

import { glossaryTerms, translations, products, glossaryRule } from "@app/db";
import { statusAfterEdit, transitionPermission, hasPermission, SECTION_TYPES, type SectionType, type TranslationStatus } from "@app/domain";
import { writeAudit, emitEvent } from "@app/platform";
import { enqueueTranslation, hashSections, sourceForScope, TranslationInputError, validateSection } from "@app/services";
import { marketplaces } from "@app/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { validationMessage, type ActionState } from "@/server/action-state";
import { getDb } from "@/server/db";

const uuid = z.string().uuid();
const locale = z.string().regex(/^[a-z]{2,3}$/);
const scope = z.string().regex(/^[a-z0-9_]+$/);

export async function enqueueBulkAction(productIds: string[], locales: string[]): Promise<{ queued: number; errors: string[] }> {
  const user = await requirePermission("translations.write");
  const ids = z.array(uuid).max(500).parse(productIds);
  const locs = z.array(locale).max(20).parse(locales);
  const db = getDb();
  let queued = 0;
  const errors: string[] = [];
  for (const productId of ids) {
    for (const loc of locs) {
      try {
        await enqueueTranslation(db, { productId, locale: loc, scope: "base", userId: user.id });
        queued++;
      } catch (e) {
        const [p] = await db.select({ name: products.name }).from(products).where(eq(products.id, productId));
        errors.push(`${p?.name ?? productId}: ${e instanceof TranslationInputError ? e.message : "nie udało się dodać do kolejki"}`);
        break;
      }
    }
  }
  if (queued) await writeAudit(db, { actorId: user.id, action: "translation.queued", details: { products: ids.length, locales: locs, queued } });
  revalidatePath("/tlumaczenia");
  return { queued, errors: [...new Set(errors)] };
}

export async function retranslateAction(productId: string, loc: string, sc: string): Promise<ActionState> {
  const user = await requirePermission("translations.write");
  try {
    await enqueueTranslation(getDb(), { productId: uuid.parse(productId), locale: locale.parse(loc), scope: scope.parse(sc), userId: user.id });
  } catch (e) {
    return { error: e instanceof TranslationInputError ? e.message : "Nie udało się zlecić tłumaczenia." };
  }
  revalidatePath(`/tlumaczenia/${productId}/${loc}`);
  return { success: "Zlecono tłumaczenie AI – wynik pojawi się za chwilę." };
}

async function connectorFor(sc: string) {
  if (sc === "base") return undefined;
  const [m] = await getDb().select().from(marketplaces).where(eq(marketplaces.code, sc));
  return m?.connectorKey;
}

/** Zapis ręcznych poprawek. Treść źródłowa jest odświeżana do aktualnej wersji PL. */
export async function saveTranslationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("translations.write");
  const parsed = z.object({ productId: uuid, locale, scope }).safeParse({ productId: formData.get("productId"), locale: formData.get("locale"), scope: formData.get("scope") });
  if (!parsed.success) return { error: "Nieprawidłowe dane." };
  const { productId, locale: loc, scope: sc } = parsed.data;
  const db = getDb();
  const source = await sourceForScope(db, productId, sc);
  if (!source) return { error: "Nie znaleziono treści źródłowej." };

  const where = and(eq(translations.productId, productId), eq(translations.locale, loc), eq(translations.scope, sc));
  const [row] = await db.select().from(translations).where(where);
  if (row?.jobState === "QUEUED" || row?.jobState === "RUNNING") return { error: "Trwa tłumaczenie AI – poczekaj na wynik przed edycją." };

  const terms = await db.select().from(glossaryTerms);
  const connectorKey = await connectorFor(sc);
  const sections: Record<string, { source: string; text: string }> = {};
  const warnings: string[] = [];
  for (const type of Object.keys(source) as SectionType[]) {
    const text = String(formData.get(`text_${type}`) ?? "").replace(/\r\n/g, "\n").trim();
    sections[type] = { source: source[type]!, text };
    if (!text) warnings.push(`Sekcja „${type}” jest pusta.`);
    else warnings.push(...validateSection(type, source[type]!, text, terms, loc, connectorKey));
  }
  const status: TranslationStatus = row ? statusAfterEdit(row.status) : "PENDING_REVIEW";
  const values = { sections, sourceHash: hashSections(source), status, warnings: [...new Set(warnings)], updatedAt: new Date(), jobState: null, jobError: null };
  if (row) await db.update(translations).set(values).where(where);
  else await db.insert(translations).values({ productId, locale: loc, scope: sc, provider: "manual", ...values });
  await writeAudit(db, { actorId: user.id, action: "translation.edited", entityType: "product", entityId: productId, details: { locale: loc, scope: sc, status } });
  revalidatePath(`/tlumaczenia/${productId}/${loc}`);
  revalidatePath("/tlumaczenia");
  return { success: status === "PENDING_REVIEW" && row?.status === "APPROVED" ? "Zapisano. Tłumaczenie wróciło do akceptacji." : "Zapisano poprawki." };
}

export async function changeStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("translations.read");
  const parsed = z
    .object({ productId: uuid, locale, scope, to: z.enum(["AI_DRAFT", "PENDING_REVIEW", "APPROVED"]) })
    .safeParse({ productId: formData.get("productId"), locale: formData.get("locale"), scope: formData.get("scope"), to: formData.get("to") });
  if (!parsed.success) return { error: "Nieprawidłowe dane." };
  const { productId, locale: loc, scope: sc, to } = parsed.data;
  const db = getDb();
  const where = and(eq(translations.productId, productId), eq(translations.locale, loc), eq(translations.scope, sc));
  const [row] = await db.select().from(translations).where(where);
  if (!row) return { error: "Brak tłumaczenia." };
  const needed = transitionPermission(row.status, to);
  if (!needed) return { error: "Taka zmiana statusu nie jest dozwolona." };
  if (!hasPermission(user.permissions, needed)) return { error: "Nie masz uprawnień do tej zmiany statusu." };

  if (to === "APPROVED") {
    const source = await sourceForScope(db, productId, sc);
    if (!source || hashSections(source) !== row.sourceHash) return { error: "Polski oryginał zmienił się po tłumaczeniu – zaktualizuj tłumaczenie (zapisz poprawki lub przetłumacz ponownie) przed zatwierdzeniem." };
    const empty = SECTION_TYPES.filter((t) => row.sections[t] && !row.sections[t]!.text.trim());
    if (empty.length) return { error: "Nie można zatwierdzić – są puste sekcje." };
  }
  await db
    .update(translations)
    .set({ status: to, updatedAt: new Date(), ...(to === "APPROVED" ? { reviewedById: user.id, reviewedAt: new Date() } : {}) })
    .where(where);
  await writeAudit(db, { actorId: user.id, action: "translation.status_changed", entityType: "product", entityId: productId, details: { locale: loc, scope: sc, from: row.status, to } });
  if (to === "APPROVED") await emitEvent(db, "content.translation.approved", { productId, locale: loc, scope: sc });
  revalidatePath(`/tlumaczenia/${productId}/${loc}`);
  revalidatePath("/tlumaczenia");
  return { success: to === "APPROVED" ? "Tłumaczenie zatwierdzone." : to === "PENDING_REVIEW" ? "Wysłano do akceptacji." : "Cofnięto do szkicu." };
}

const glossarySchema = z.object({
  rule: z.enum(glossaryRule.enumValues),
  sourceTerm: z.string().trim().min(1, "Podaj termin."),
  locale: z.string().nullable(),
  targetTerm: z.string().trim().nullable(),
  caseSensitive: z.boolean(),
  note: z.string().trim().max(300),
});

export async function addGlossaryTermAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("translations.write");
  const parsed = glossarySchema.safeParse({
    rule: formData.get("rule"),
    sourceTerm: formData.get("sourceTerm"),
    locale: String(formData.get("locale") ?? "") || null,
    targetTerm: String(formData.get("targetTerm") ?? "").trim() || null,
    caseSensitive: formData.get("caseSensitive") === "on",
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };
  const d = parsed.data;
  if (d.rule === "FORCE" && (!d.targetTerm || !d.locale)) return { error: "Dla reguły „Wymuś tłumaczenie” podaj język i tłumaczenie terminu." };
  if (d.rule === "FORBIDDEN" && !d.locale) return { error: "Dla reguły „Zakazane słowo” wybierz język." };
  const db = getDb();
  const [t] = await db.insert(glossaryTerms).values({ ...d, targetTerm: d.rule === "FORBIDDEN" ? d.targetTerm ?? d.sourceTerm : d.targetTerm }).returning();
  await writeAudit(db, { actorId: user.id, action: "glossary.created", entityType: "glossary_term", entityId: t!.id, details: d });
  revalidatePath("/tlumaczenia/slownik");
  return { success: "Dodano termin. Będzie stosowany przy kolejnych tłumaczeniach." };
}

export async function deleteGlossaryTermAction(formData: FormData): Promise<void> {
  const user = await requirePermission("translations.write");
  const id = uuid.parse(formData.get("id"));
  const db = getDb();
  await db.delete(glossaryTerms).where(eq(glossaryTerms.id, id));
  await writeAudit(db, { actorId: user.id, action: "glossary.deleted", entityType: "glossary_term", entityId: id });
  revalidatePath("/tlumaczenia/slownik");
}
