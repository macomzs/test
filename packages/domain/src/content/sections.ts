export const SECTION_TYPES = ["TITLE", "BENEFITS", "DESCRIPTION", "SET_CONTENTS", "SAFETY"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_LABELS: Record<SectionType, string> = {
  TITLE: "Tytuł (SEO)",
  BENEFITS: "Punkty korzyści",
  DESCRIPTION: "Opis techniczny",
  SET_CONTENTS: "Zawartość zestawu",
  SAFETY: "Bezpieczeństwo",
};

export const SECTION_HINTS: Record<SectionType, string> = {
  TITLE: "Jedna linia. Najważniejsze słowa na początku.",
  BENEFITS: "Każda linia = jeden punkt korzyści.",
  DESCRIPTION: "Akapity oddzielone pustą linią.",
  SET_CONTENTS: "Każda linia = jeden element zestawu.",
  SAFETY: "Ostrzeżenia i informacje wymagane przez GPSR.",
};

/**
 * Maksymalna długość tytułu per konektor. Allegro: 75 znaków.
 * Pozostałe wartości są ostrożnymi limitami roboczymi – do weryfikacji z dokumentacją przy realnych integracjach.
 */
export const TITLE_LIMITS: Record<string, number> = { allegro: 75 };
export const DEFAULT_TITLE_LIMIT = 150;

export function titleLimitFor(connectorKey: string | null | undefined): number {
  return (connectorKey && TITLE_LIMITS[connectorKey]) || DEFAULT_TITLE_LIMIT;
}
