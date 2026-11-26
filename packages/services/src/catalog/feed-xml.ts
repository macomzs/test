import { normalizeFeedItems, type FeedIssue, type FeedItem } from "@app/domain";
import { XMLParser } from "fast-xml-parser";

/**
 * Mapowanie pól feedu XML na pola produktu. Domyślne wartości pasują do eksportu
 * WP All Export (<data><post><Title/><EAN/><Stock/><Price/><Image/></post></data>).
 */
export interface XmlFeedMapping {
  itemPath: string;
  title: string;
  ean: string;
  sku: string;
  price: string;
  stock: string;
  image: string;
}

export const DEFAULT_XML_MAPPING: XmlFeedMapping = {
  itemPath: "data.post",
  title: "Title",
  ean: "EAN",
  sku: "SKU",
  price: "Price",
  stock: "Stock",
  image: "Image",
};

const MAX_FEED_BYTES = 30 * 1024 * 1024;

export class FeedError extends Error {}

/** Pobiera feed z adresu URL (tylko http/https, limit rozmiaru i czasu). */
export async function downloadFeed(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new FeedError("Nieprawidłowy adres URL feedu.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new FeedError("Adres feedu musi zaczynać się od http:// lub https://.");

  let res: Response;
  try {
    res = await fetch(parsed, { signal: AbortSignal.timeout(60_000), redirect: "follow" });
  } catch (e) {
    throw new FeedError(`Nie udało się pobrać feedu: ${(e as Error).message}`);
  }
  if (!res.ok) throw new FeedError(`Serwer feedu zwrócił błąd HTTP ${res.status}.`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_FEED_BYTES) throw new FeedError("Feed jest za duży (limit 30 MB).");
  const text = await res.text();
  if (text.length > MAX_FEED_BYTES) throw new FeedError("Feed jest za duży (limit 30 MB).");
  return text;
}

function pick(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

function asText(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join("|");
  if (typeof v === "object") return asText((v as Record<string, unknown>)["#text"]);
  return String(v);
}

export function parseXmlFeed(xml: string, mapping: XmlFeedMapping = DEFAULT_XML_MAPPING): { items: FeedItem[]; issues: FeedIssue[] } {
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false, // EAN-y muszą zostać tekstem (zera wiodące!)
    trimValues: true,
    processEntities: true,
  });
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch (e) {
    throw new FeedError(`Plik nie jest poprawnym XML: ${(e as Error).message}`);
  }
  const node = pick(doc, mapping.itemPath);
  if (node === undefined) throw new FeedError(`Nie znaleziono produktów w ścieżce „${mapping.itemPath}”.`);
  const list = Array.isArray(node) ? node : [node];
  return normalizeFeedItems(
    list.map((p) => ({
      title: asText(pick(p, mapping.title)),
      ean: asText(pick(p, mapping.ean)),
      sku: asText(pick(p, mapping.sku)),
      price: asText(pick(p, mapping.price)),
      stock: asText(pick(p, mapping.stock)),
      image: asText(pick(p, mapping.image)),
    })),
  );
}
