export type GlossaryRule = "DO_NOT_TRANSLATE" | "FORCE" | "FORBIDDEN";

export interface GlossaryTerm {
  rule: GlossaryRule;
  sourceTerm: string;
  /** null = wszystkie języki */
  locale: string | null;
  targetTerm: string | null;
  caseSensitive: boolean;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Dopasowanie całego słowa/frazy (z obsługą polskich znaków). */
function contains(text: string, term: string, caseSensitive: boolean): boolean {
  if (!term.trim()) return false;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term.trim())}(?![\\p{L}\\p{N}])`, caseSensitive ? "u" : "iu");
  return re.test(text);
}

/** Terminy słownika, które dotyczą danego języka i występują w tekście źródłowym. */
export function relevantTerms(terms: GlossaryTerm[], locale: string, sourceText: string): GlossaryTerm[] {
  return terms.filter((t) => {
    if (t.locale && t.locale !== locale) return false;
    if (t.rule === "FORBIDDEN") return true; // zakaz dotyczy tekstu docelowego
    return contains(sourceText, t.sourceTerm, t.caseSensitive);
  });
}

/** Instrukcje dla tłumacza (AI) wynikające ze słownika. */
export function glossaryInstructions(terms: GlossaryTerm[]): string[] {
  return terms.map((t) => {
    switch (t.rule) {
      case "DO_NOT_TRANSLATE":
        return `Keep "${t.sourceTerm}" exactly as written (proper name / brand / unit) – do not translate or inflect it.`;
      case "FORCE":
        return `Always translate "${t.sourceTerm}" as "${t.targetTerm}".`;
      case "FORBIDDEN":
        return `Never use the word "${t.targetTerm ?? t.sourceTerm}".`;
    }
  });
}

/** Sprawdza tłumaczenie względem słownika. Zwraca listę ostrzeżeń po polsku. */
export function checkGlossary(terms: GlossaryTerm[], locale: string, sourceText: string, translated: string): string[] {
  const warnings: string[] = [];
  for (const t of relevantTerms(terms, locale, sourceText)) {
    if (t.rule === "DO_NOT_TRANSLATE" && !contains(translated, t.sourceTerm, t.caseSensitive)) {
      warnings.push(`Słownik: „${t.sourceTerm}” powinno pozostać bez tłumaczenia, a nie występuje w tekście.`);
    }
    if (t.rule === "FORCE" && t.targetTerm && !contains(translated, t.targetTerm, t.caseSensitive)) {
      warnings.push(`Słownik: „${t.sourceTerm}” powinno być przetłumaczone jako „${t.targetTerm}”.`);
    }
    const forbidden = t.targetTerm ?? t.sourceTerm;
    if (t.rule === "FORBIDDEN" && contains(translated, forbidden, t.caseSensitive)) {
      warnings.push(`Słownik: użyto zakazanego słowa „${forbidden}”.`);
    }
  }
  return warnings;
}
