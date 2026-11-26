/**
 * Warianty produktów.
 *
 * Konwencja nazw w feedzie: „Kabina Tomar 90 (bez brodzika)” → produkt główny „Kabina Tomar 90”,
 * wariant „bez brodzika”. Pozycja bez nawiasu, której nazwa równa się nazwie grupy,
 * staje się wariantem „standardowym”.
 */
export function splitVariantTitle(title: string): { base: string; label: string | null } {
  const t = title.trim().replace(/\s+/g, " ");
  const m = /^(.*\S)\s*\(([^()]+)\)\s*$/.exec(t);
  if (!m) return { base: t, label: null };
  return { base: m[1]!.trim(), label: m[2]!.trim() };
}

export const STANDARD_VARIANT_LABEL = "standardowy";

export interface Groupable {
  key: string;
  title: string;
}

export type GroupedItem<T> =
  | { type: "single"; item: T }
  | { type: "group"; base: string; variants: { item: T; label: string }[] };

/** Grupuje pozycje w warianty – grupa powstaje tylko, gdy co najmniej 2 pozycje mają wspólną nazwę bazową. */
export function groupVariants<T extends Groupable>(items: T[]): GroupedItem<T>[] {
  const byBase = new Map<string, { item: T; label: string | null }[]>();
  for (const item of items) {
    const { base, label } = splitVariantTitle(item.title);
    const k = base.toLocaleLowerCase("pl");
    byBase.set(k, [...(byBase.get(k) ?? []), { item, label }]);
  }
  const result: GroupedItem<T>[] = [];
  for (const entries of byBase.values()) {
    if (entries.length < 2) {
      result.push({ type: "single", item: entries[0]!.item });
      continue;
    }
    const base = splitVariantTitle(entries[0]!.item.title).base;
    result.push({
      type: "group",
      base,
      variants: entries.map((e) => ({ item: e.item, label: e.label ?? STANDARD_VARIANT_LABEL })),
    });
  }
  return result;
}

/** Pola, które wariant dziedziczy z produktu głównego, jeśli sam ich nie ma. */
export const INHERITABLE_FIELDS = [
  "brand",
  "basePrice",
  "costPrice",
  "lengthMm",
  "widthMm",
  "heightMm",
  "weightG",
  "materials",
] as const;

export type InheritableField = (typeof INHERITABLE_FIELDS)[number];

/**
 * Zwraca efektywne wartości wariantu oraz listę pól odziedziczonych z rodzica.
 * Wartość pusta (null/undefined/"") oznacza „dziedzicz”.
 */
export function resolveInherited<T extends Partial<Record<InheritableField, unknown>>>(
  variant: T,
  parent: Partial<Record<InheritableField, unknown>> | null | undefined,
): { values: T; inherited: InheritableField[] } {
  if (!parent) return { values: variant, inherited: [] };
  const values = { ...variant };
  const inherited: InheritableField[] = [];
  for (const f of INHERITABLE_FIELDS) {
    const own = variant[f];
    const fromParent = parent[f];
    if ((own === null || own === undefined || own === "") && fromParent !== null && fromParent !== undefined && fromParent !== "") {
      (values as Record<string, unknown>)[f] = fromParent;
      inherited.push(f);
    }
  }
  return { values, inherited };
}
