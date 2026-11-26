import { importRuns, importSources, productImages, products, type Database } from "@app/db";
import { groupVariants, type FeedIssue, type FeedItem } from "@app/domain";
import { emitEvent, writeAudit } from "@app/platform";
import { and, eq, inArray } from "drizzle-orm";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type ProductRow = typeof products.$inferSelect;

export interface ImportOptions {
  items: FeedItem[];
  /** Problemy wykryte podczas parsowania feedu – trafiają do raportu importu. */
  parseIssues?: FeedIssue[];
  groupVariants: boolean;
  userId: string | null;
  sourceId?: string | null;
}

export interface ImportSummary {
  runId: string;
  created: number;
  updated: number;
  parentsCreated: number;
  skipped: number;
  issues: FeedIssue[];
}

/**
 * Importuje pozycje feedu do katalogu. Produkty dopasowywane są po EAN (lub SKU).
 * - nowe produkty trafiają do katalogu ze statusem „Szkic”,
 * - istniejące: aktualizowana jest cena, stan i dane źródłowe; nazwa tylko wtedy,
 *   gdy nie została ręcznie zmieniona w katalogu,
 * - pozycje o wspólnej nazwie bazowej („X (czarny)”, „X (biały)”) są łączone w warianty.
 */
export async function importFeedItems(db: Database, opts: ImportOptions): Promise<ImportSummary> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const issues: FeedIssue[] = [...(opts.parseIssues ?? [])];
    let created = 0;
    let updated = 0;
    let parentsCreated = 0;

    const eans = opts.items.map((i) => i.ean).filter((e): e is string => !!e);
    const skus = opts.items.map((i) => i.sku).filter((s): s is string => !!s);
    const existing = [
      ...(eans.length ? await tx.select().from(products).where(inArray(products.ean, eans)) : []),
      ...(skus.length ? await tx.select().from(products).where(inArray(products.sku, skus)) : []),
    ];
    const byEan = new Map(existing.filter((p) => p.ean).map((p) => [p.ean!, p]));
    const bySku = new Map(existing.filter((p) => p.sku).map((p) => [p.sku!, p]));
    const findExisting = (item: FeedItem) => (item.ean ? byEan.get(item.ean) : undefined) ?? (item.sku ? bySku.get(item.sku) : undefined);

    const upsert = async (item: FeedItem, variant?: { parentId: string; label: string }): Promise<ProductRow> => {
      const found = findExisting(item);
      const sourceData = { title: item.title, price: item.price, stock: item.stock, imageUrls: item.imageUrls, importedAt: now.toISOString() };
      if (!found) {
        const [row] = await tx
          .insert(products)
          .values({
            kind: variant ? "VARIANT" : "SIMPLE",
            parentId: variant?.parentId ?? null,
            variantLabel: variant?.label ?? null,
            name: item.title,
            ean: item.ean,
            sku: item.sku,
            basePrice: item.price,
            stockQty: item.stock,
            stockUpdatedAt: item.stock !== null ? now : null,
            source: "FEED",
            sourceData,
            createdById: opts.userId,
          })
          .returning();
        await addImagesIfMissing(tx, row!.id, item.imageUrls, item.title);
        created++;
        return row!;
      }

      const previousTitle = (found.sourceData as { title?: string } | null)?.title;
      const nameUntouched = !previousTitle || previousTitle === found.name;
      const patch: Partial<typeof products.$inferInsert> = {
        basePrice: item.price ?? found.basePrice,
        stockQty: item.stock ?? found.stockQty,
        stockUpdatedAt: item.stock !== null ? now : found.stockUpdatedAt,
        sourceData,
        updatedAt: now,
      };
      if (nameUntouched) patch.name = item.title;
      if (!nameUntouched && previousTitle !== item.title) {
        issues.push({ key: item.key, message: `„${found.name}”: nazwa w feedzie zmieniła się na „${item.title}”, ale nie nadpisano jej, bo była edytowana ręcznie.` });
      }
      if (variant && !found.parentId && found.kind !== "PARENT") {
        patch.kind = "VARIANT";
        patch.parentId = variant.parentId;
        patch.variantLabel = found.variantLabel ?? variant.label;
      }
      const [row] = await tx.update(products).set(patch).where(eq(products.id, found.id)).returning();
      await addImagesIfMissing(tx, found.id, item.imageUrls, item.title);
      updated++;
      return row!;
    };

    const groups = opts.groupVariants
      ? groupVariants(opts.items)
      : opts.items.map((item) => ({ type: "single" as const, item }));

    for (const g of groups) {
      if (g.type === "single") {
        await upsert(g.item);
        continue;
      }
      // Produkt główny: istniejący rodzic któregoś z wariantów, albo produkt główny o tej nazwie, albo nowy.
      const existingParentId = g.variants.map((v) => findExisting(v.item)?.parentId).find(Boolean);
      let parent: ProductRow | undefined;
      if (existingParentId) {
        [parent] = await tx.select().from(products).where(eq(products.id, existingParentId));
      }
      if (!parent) {
        [parent] = await tx.select().from(products).where(and(eq(products.kind, "PARENT"), eq(products.name, g.base)));
      }
      if (!parent) {
        const prices = g.variants.map((v) => Number(v.item.price)).filter((n) => n > 0);
        [parent] = await tx
          .insert(products)
          .values({
            kind: "PARENT",
            name: g.base,
            source: "FEED",
            basePrice: prices.length ? Math.min(...prices).toFixed(2) : null,
            createdById: opts.userId,
          })
          .returning();
        parentsCreated++;
      }
      for (const v of g.variants) await upsert(v.item, { parentId: parent!.id, label: v.label });
      const firstImages = g.variants.find((v) => v.item.imageUrls.length)?.item.imageUrls ?? [];
      await addImagesIfMissing(tx, parent!.id, firstImages.slice(0, 1), g.base);
    }

    const [run] = await tx
      .insert(importRuns)
      .values({
        sourceId: opts.sourceId ?? null,
        userId: opts.userId,
        finishedAt: new Date(),
        createdCount: created,
        updatedCount: updated,
        skippedCount: (opts.parseIssues ?? []).filter((i) => i.message.includes("pominięto")).length,
        issues,
      })
      .returning();
    if (opts.sourceId) await tx.update(importSources).set({ lastRunAt: now }).where(eq(importSources.id, opts.sourceId));

    await writeAudit(tx, {
      actorId: opts.userId,
      action: "catalog.import.completed",
      entityType: "import_run",
      entityId: run!.id,
      details: { created, updated, parentsCreated, issues: issues.length },
    });
    await emitEvent(tx, "catalog.products.imported", { runId: run!.id, created, updated });

    return { runId: run!.id, created, updated, parentsCreated, skipped: run!.skippedCount, issues };
  });
}

async function addImagesIfMissing(tx: Tx, productId: string, urls: string[], alt: string) {
  if (!urls.length) return;
  const [has] = await tx.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, productId)).limit(1);
  if (has) return;
  await tx.insert(productImages).values(urls.map((url, position) => ({ productId, url, position, alt })));
}
