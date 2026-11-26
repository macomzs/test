import { closeDb, getDb, glossaryTerms, offerTemplates, products, templateSections, translations } from "@app/db";
import { and, eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashSections, sourceForScope } from "./content";
import { translateProduct } from "./translate";

// Test integracyjny (tryb testowy tłumaczeń, bez API). Wymaga bazy z migracjami.
const hasDb = !!process.env.DATABASE_URL;
const PREFIX = "TEST-TRANSLATE ";

async function cleanup() {
  const db = getDb();
  await db.delete(products).where(like(products.name, `${PREFIX}%`));
  await db.delete(offerTemplates).where(like(offerTemplates.name, `${PREFIX}%`));
  await db.delete(glossaryTerms).where(like(glossaryTerms.note, `${PREFIX}%`));
}

describe.skipIf(!hasDb)("tłumaczenie treści oferty", () => {
  let productId = "";
  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = "";
    await cleanup();
    const db = getDb();
    const [tpl] = await db.insert(offerTemplates).values({ name: `${PREFIX}Kabiny` }).returning();
    await db.insert(templateSections).values([
      { templateId: tpl!.id, type: "TITLE", content: "{{marka}} {{nazwa}}" },
      { templateId: tpl!.id, type: "BENEFITS", content: "Szkło hartowane\nWaga: {{waga_kg}} kg" },
    ]);
    const [p] = await db.insert(products).values({ name: `${PREFIX}Kabina Tomar 90`, brand: "Novoterm", templateId: tpl!.id, weightG: 38500 }).returning();
    productId = p!.id;
    await db.insert(glossaryTerms).values({ rule: "DO_NOT_TRANSLATE", sourceTerm: "Novoterm", caseSensitive: true, note: `${PREFIX}marka` });
  });
  afterAll(async () => {
    await cleanup();
    await closeDb();
  });

  it("renderuje treść PL ze wzorca", async () => {
    const src = await sourceForScope(getDb(), productId, "base");
    expect(src).toEqual({ TITLE: `Novoterm ${PREFIX}Kabina Tomar 90`, BENEFITS: "Szkło hartowane\nWaga: 38,5 kg" });
  });

  it("tworzy szkic AI z kontrolą słownika i wykrywa zmianę oryginału", async () => {
    const db = getDb();
    await db.insert(translations).values({ productId, locale: "de", scope: "base", jobState: "QUEUED" });
    await translateProduct(db, { productId, locale: "de", scope: "base", userId: null });
    const [t] = await db.select().from(translations).where(and(eq(translations.productId, productId), eq(translations.locale, "de")));
    expect(t).toMatchObject({ status: "AI_DRAFT", jobState: "DONE", provider: "mock" });
    expect(t!.sections.BENEFITS?.text).toBe("[DE] Szkło hartowane\n[DE] Waga: 38,5 kg");
    expect(t!.warnings).toEqual([]); // „Novoterm” zachowane

    await db.update(products).set({ weightG: 40000 }).where(eq(products.id, productId));
    const changed = await sourceForScope(db, productId, "base");
    expect(hashSections(changed!)).not.toBe(t!.sourceHash);
  });
});
