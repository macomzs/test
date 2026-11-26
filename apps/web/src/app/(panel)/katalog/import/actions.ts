"use server";

import { importSources, products } from "@app/db";
import { splitVariantTitle } from "@app/domain";
import { downloadFeed, FeedError, importFeedItems, parseXmlFeed } from "@app/services";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";

export interface PreviewItem {
  key: string;
  title: string;
  ean: string | null;
  price: string | null;
  stock: number | null;
  image: string | null;
  exists: boolean;
  variantBase: string | null;
}

export type PreviewResult =
  | { ok: true; items: PreviewItem[]; issues: { key: string; message: string }[] }
  | { ok: false; error: string };

const urlSchema = z.string().trim().url("Podaj poprawny adres URL feedu (http:// lub https://).");

async function loadFeed(url: string) {
  const xml = await downloadFeed(url);
  return parseXmlFeed(xml);
}

export async function previewFeedAction(rawUrl: string): Promise<PreviewResult> {
  await requirePermission("catalog.write");
  const url = urlSchema.safeParse(rawUrl);
  if (!url.success) return { ok: false, error: url.error.issues[0]!.message };
  try {
    const { items, issues } = await loadFeed(url.data);
    const eans = items.map((i) => i.ean).filter((e): e is string => !!e);
    const existing = eans.length ? await getDb().select({ ean: products.ean }).from(products).where(inArray(products.ean, eans)) : [];
    const existingSet = new Set(existing.map((e) => e.ean));

    // Nazwa bazowa wariantu – pokazywana tylko, gdy w feedzie są co najmniej 2 pozycje o tej samej bazie.
    const baseCount = new Map<string, number>();
    for (const i of items) {
      const b = splitVariantTitle(i.title).base.toLocaleLowerCase("pl");
      baseCount.set(b, (baseCount.get(b) ?? 0) + 1);
    }
    return {
      ok: true,
      issues,
      items: items.map((i) => {
        const base = splitVariantTitle(i.title).base;
        return {
          key: i.key,
          title: i.title,
          ean: i.ean,
          price: i.price,
          stock: i.stock,
          image: i.imageUrls[0] ?? null,
          exists: !!i.ean && existingSet.has(i.ean),
          variantBase: (baseCount.get(base.toLocaleLowerCase("pl")) ?? 0) > 1 ? base : null,
        };
      }),
    };
  } catch (e) {
    return { ok: false, error: e instanceof FeedError ? e.message : `Nieoczekiwany błąd: ${(e as Error).message}` };
  }
}

export type ImportResult =
  | { ok: true; created: number; updated: number; parentsCreated: number; issues: { key: string; message: string }[] }
  | { ok: false; error: string };

export async function importFeedAction(rawUrl: string, keys: string[], groupVariants: boolean): Promise<ImportResult> {
  const user = await requirePermission("catalog.write");
  const url = urlSchema.safeParse(rawUrl);
  if (!url.success) return { ok: false, error: url.error.issues[0]!.message };
  if (!keys.length) return { ok: false, error: "Zaznacz co najmniej jeden produkt do importu." };

  try {
    // Feed pobieramy ponownie po stronie serwera – nie ufamy danym przesłanym z przeglądarki.
    const { items, issues } = await loadFeed(url.data);
    const wanted = new Set(keys);
    const selected = items.filter((i) => wanted.has(i.key));
    if (!selected.length) return { ok: false, error: "Zaznaczonych produktów nie ma już w feedzie." };

    const db = getDb();
    let [source] = await db.select().from(importSources).where(eq(importSources.url, url.data));
    if (!source) {
      [source] = await db.insert(importSources).values({ name: new URL(url.data).hostname, url: url.data, createdById: user.id }).returning();
    }
    const selectedIssues = issues.filter((i) => wanted.has(i.key));
    const res = await importFeedItems(db, { items: selected, parseIssues: selectedIssues, groupVariants, userId: user.id, sourceId: source!.id });
    revalidatePath("/katalog");
    return { ok: true, created: res.created, updated: res.updated, parentsCreated: res.parentsCreated, issues: res.issues };
  } catch (e) {
    return { ok: false, error: e instanceof FeedError ? e.message : `Import nie powiódł się: ${(e as Error).message}` };
  }
}
