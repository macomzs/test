export const PRODUCT_STATUS_LABELS = { DRAFT: "Szkic", ACTIVE: "Aktywny", ARCHIVED: "Archiwalny" } as const;
export const PRODUCT_STATUS_TONES = { DRAFT: "warning", ACTIVE: "success", ARCHIVED: "neutral" } as const;
export const PRODUCT_KIND_LABELS = { SIMPLE: "Produkt", PARENT: "Produkt główny (z wariantami)", VARIANT: "Wariant" } as const;

const money = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(value: string | number | null | undefined, currency = "PLN"): string {
  if (value === null || value === undefined || value === "") return "—";
  return `${money.format(Number(value))} ${currency === "PLN" ? "zł" : currency}`;
}

/** „12,5” → 12.5; pusty tekst → null; niepoprawna liczba → NaN. */
export function parseDecimal(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN;
}
