/**
 * Zmienne dostępne we wzorcach ofert: {{nazwa}}, {{marka}}, {{wymiary}} itd.
 * Wartości pochodzą z produktu (wariant dziedziczy brakujące dane z produktu głównego).
 */
export const TEMPLATE_VARIABLES = {
  nazwa: "Pełna nazwa produktu",
  nazwa_bazowa: "Nazwa produktu głównego (bez wariantu)",
  wariant: "Nazwa wariantu, np. „czarny”",
  marka: "Marka",
  ean: "Kod EAN",
  sku: "SKU",
  cena: "Cena bazowa, np. „1439,00 zł”",
  dlugosc_cm: "Długość w cm",
  szerokosc_cm: "Szerokość w cm",
  wysokosc_cm: "Wysokość w cm",
  wymiary: "Wymiary, np. „90 × 90 × 200 cm”",
  waga_kg: "Waga w kg",
  materialy: "Materiały",
} as const;

export type TemplateVariable = keyof typeof TEMPLATE_VARIABLES;
export type TemplateValues = Partial<Record<TemplateVariable, string | null>>;

const VAR_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

export interface RenderResult {
  text: string;
  /** Zmienne użyte we wzorcu, dla których produkt nie ma wartości. */
  missing: TemplateVariable[];
  /** Nieznane nazwy zmiennych (literówki). */
  unknown: string[];
}

/**
 * Podstawia zmienne. Brakująca wartość zostawia czytelny znacznik [brak: nazwa], żeby
 * nie opublikować przypadkiem oferty z dziurą; lista braków trafia do walidacji przed publikacją.
 */
export function renderTemplate(content: string, values: TemplateValues): RenderResult {
  const missing = new Set<TemplateVariable>();
  const unknown = new Set<string>();
  const text = content.replace(VAR_RE, (_m, name: string) => {
    if (!(name in TEMPLATE_VARIABLES)) {
      unknown.add(name);
      return `[nieznana zmienna: ${name}]`;
    }
    const v = values[name as TemplateVariable];
    if (v === null || v === undefined || String(v).trim() === "") {
      missing.add(name as TemplateVariable);
      return `[brak: ${name}]`;
    }
    return String(v);
  });
  return { text: tidy(text), missing: [...missing], unknown: [...unknown] };
}

/** Porządkuje białe znaki: bez spacji na końcach linii i bez więcej niż jednej pustej linii. */
function tidy(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractVariables(content: string): string[] {
  return [...new Set([...content.matchAll(VAR_RE)].map((m) => m[1]!))];
}

const num = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Buduje wartości zmiennych z danych produktu (już po rozwiązaniu dziedziczenia). */
export function productTemplateValues(p: {
  name: string;
  parentName?: string | null;
  variantLabel?: string | null;
  brand?: string | null;
  ean?: string | null;
  sku?: string | null;
  basePrice?: string | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  weightG?: number | null;
  materials?: string | null;
}): TemplateValues {
  const cm = (mm?: number | null) => (mm === null || mm === undefined ? null : num.format(mm / 10));
  const dims = [p.lengthMm, p.widthMm, p.heightMm];
  return {
    nazwa: p.name,
    nazwa_bazowa: p.parentName ?? p.name,
    wariant: p.variantLabel ?? null,
    marka: p.brand ?? null,
    ean: p.ean ?? null,
    sku: p.sku ?? null,
    cena: p.basePrice ? `${money.format(Number(p.basePrice))} zł` : null,
    dlugosc_cm: cm(p.lengthMm),
    szerokosc_cm: cm(p.widthMm),
    wysokosc_cm: cm(p.heightMm),
    wymiary: dims.every((d) => d !== null && d !== undefined) ? `${dims.map((d) => cm(d)).join(" × ")} cm` : null,
    waga_kg: p.weightG === null || p.weightG === undefined ? null : num.format(p.weightG / 1000),
    materialy: p.materials ?? null,
  };
}
