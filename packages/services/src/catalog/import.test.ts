import { closeDb, getDb, productImages, products } from "@app/db";
import { normalizeFeedItems } from "@app/domain";
import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importFeedItems } from "./import";

// Test integracyjny – wymaga bazy z migracjami (DATABASE_URL). Bez bazy jest pomijany.
const hasDb = !!process.env.DATABASE_URL;
const PREFIX = "TEST-IMPORT ";
const EANS = ["4006381333931", "4006381333948", "4006381333955", "96385074"];

async function cleanup() {
  const db = getDb();
  await db.delete(products).where(inArray(products.ean, EANS));
  await db.delete(products).where(like(products.name, `${PREFIX}%`));
}

describe.skipIf(!hasDb)("import feedu do katalogu", () => {
  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await closeDb();
  });

  const feed = (overrides: Partial<Record<string, string>> = {}) =>
    normalizeFeedItems([
      { title: `${PREFIX}Okap Shadow (czarny)`, ean: EANS[0], price: "899.00", stock: "5", image: "https://example.com/czarny.jpg" },
      { title: `${PREFIX}Okap Shadow (biały)`, ean: EANS[1], price: "849.00", stock: "0", image: "https://example.com/bialy.jpg" },
      { title: overrides.syfon ?? `${PREFIX}Syfon Speed`, ean: EANS[2], price: overrides.price ?? "109.00", stock: "20", image: "https://example.com/syfon.jpg" },
    ]);

  it("tworzy produkty, grupuje warianty i dodaje zdjęcia", async () => {
    const { items } = feed();
    const res = await importFeedItems(getDb(), { items, groupVariants: true, userId: null });
    expect(res).toMatchObject({ created: 3, updated: 0, parentsCreated: 1 });

    const db = getDb();
    const [parent] = await db.select().from(products).where(eq(products.name, `${PREFIX}Okap Shadow`));
    expect(parent).toMatchObject({ kind: "PARENT", basePrice: "849.00" });
    const variants = await db.select().from(products).where(eq(products.parentId, parent!.id));
    expect(variants.map((v) => v.variantLabel).sort()).toEqual(["biały", "czarny"]);
    const imgs = await db.select().from(productImages).where(eq(productImages.productId, parent!.id));
    expect(imgs).toHaveLength(1);
  });

  it("ponowny import aktualizuje cenę, ale nie nadpisuje ręcznie zmienionej nazwy", async () => {
    const db = getDb();
    await db.update(products).set({ name: `${PREFIX}Syfon – nazwa poprawiona ręcznie` }).where(eq(products.ean, EANS[2]!));
    const { items } = feed({ price: "119.00", syfon: `${PREFIX}Syfon Speed NOWY` });
    const res = await importFeedItems(db, { items, groupVariants: true, userId: null });
    expect(res).toMatchObject({ created: 0, updated: 3, parentsCreated: 0 });
    const [syfon] = await db.select().from(products).where(eq(products.ean, EANS[2]!));
    expect(syfon).toMatchObject({ name: `${PREFIX}Syfon – nazwa poprawiona ręcznie`, basePrice: "119.00" });
    expect(res.issues.some((i) => i.message.includes("edytowana ręcznie"))).toBe(true);
  });
});
