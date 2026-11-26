import { isValidGtin, normalizeEan } from "./ean";

/** Pozycja feedu po normalizacji – niezależna od formatu źródła. */
export interface FeedItem {
  key: string;
  title: string;
  ean: string | null;
  sku: string | null;
  price: string | null;
  stock: number | null;
  imageUrls: string[];
}

export interface FeedIssue {
  key: string;
  message: string;
}

/** Waliduje i normalizuje surowe wartości z feedu. Zwraca poprawne pozycje i listę problemów. */
export function normalizeFeedItems(
  raw: { title?: string; ean?: string; sku?: string; price?: string; stock?: string; image?: string }[],
): { items: FeedItem[]; issues: FeedIssue[] } {
  const items: FeedItem[] = [];
  const issues: FeedIssue[] = [];
  const seen = new Set<string>();

  raw.forEach((r, idx) => {
    const title = (r.title ?? "").trim().replace(/\s+/g, " ");
    const ean = normalizeEan(r.ean);
    const sku = (r.sku ?? "").trim() || null;
    const key = ean ?? sku ?? `#${idx + 1}`;

    if (!title) return issues.push({ key, message: "Brak nazwy produktu – pominięto." });
    if (!ean && !sku) return issues.push({ key, message: `„${title}”: brak EAN i SKU – nie da się jednoznacznie zidentyfikować produktu.` });
    if (ean && !isValidGtin(ean)) issues.push({ key, message: `„${title}”: niepoprawny EAN ${ean} (błędna cyfra kontrolna).` });
    if (seen.has(key)) return issues.push({ key, message: `„${title}”: powtórzony identyfikator ${key} – pominięto duplikat.` });
    seen.add(key);

    const priceNum = Number(String(r.price ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
    const price = r.price && Number.isFinite(priceNum) && priceNum > 0 ? priceNum.toFixed(2) : null;
    if (!price) issues.push({ key, message: `„${title}”: brak lub niepoprawna cena.` });

    const stockNum = Number.parseInt(String(r.stock ?? ""), 10);
    const image = (r.image ?? "").trim();
    if (!image) issues.push({ key, message: `„${title}”: brak zdjęcia.` });

    items.push({
      key,
      title,
      ean,
      sku,
      price,
      stock: Number.isFinite(stockNum) ? Math.max(0, stockNum) : null,
      imageUrls: image ? image.split(/[|,]\s*(?=https?:)/).map((s) => s.trim()).filter(Boolean) : [],
    });
  });

  return { items, issues };
}
