import { describe, expect, it } from "vitest";
import { checkGlossary, glossaryInstructions, relevantTerms, type GlossaryTerm } from "./glossary";
import { titleLimitFor } from "./sections";
import { extractVariables, productTemplateValues, renderTemplate } from "./template";
import { statusAfterEdit, transitionPermission } from "./workflow";

describe("wzorce – zmienne", () => {
  const values = productTemplateValues({
    name: "Kabina natryskowa Tomar 90 (bez brodzika)",
    parentName: "Kabina natryskowa Tomar 90",
    variantLabel: "bez brodzika",
    brand: "Novoterm",
    basePrice: "1439.00",
    lengthMm: 900,
    widthMm: 900,
    heightMm: 1950,
    weightG: 38500,
  });

  it("podstawia zmienne i formatuje liczby po polsku", () => {
    const r = renderTemplate("{{marka}} {{nazwa_bazowa}} – {{wariant}}, {{wymiary}}, {{waga_kg}} kg, {{ cena }}", values);
    // Polski format nie grupuje liczb 4-cyfrowych (1439,00), grupuje od 10 000 (12 500,00).
    expect(r.text).toBe("Novoterm Kabina natryskowa Tomar 90 – bez brodzika, 90 × 90 × 195 cm, 38,5 kg, 1439,00 zł");
    expect(r.missing).toEqual([]);
  });

  it("oznacza brakujące i nieznane zmienne", () => {
    const r = renderTemplate("Materiał: {{materialy}}\nKolor: {{kolor}}", values);
    expect(r.missing).toEqual(["materialy"]);
    expect(r.unknown).toEqual(["kolor"]);
    expect(r.text).toContain("[brak: materialy]");
  });

  it("wyciąga listę zmiennych", () => {
    expect(extractVariables("{{nazwa}} {{marka}} {{nazwa}}")).toEqual(["nazwa", "marka"]);
  });

  it("zna limit tytułu Allegro", () => {
    expect(titleLimitFor("allegro")).toBe(75);
    expect(titleLimitFor("kaufland")).toBe(150);
  });
});

describe("słownik terminologii", () => {
  const terms: GlossaryTerm[] = [
    { rule: "DO_NOT_TRANSLATE", sourceTerm: "Novoterm", locale: null, targetTerm: null, caseSensitive: true },
    { rule: "FORCE", sourceTerm: "brodzik", locale: "de", targetTerm: "Duschwanne", caseSensitive: false },
    { rule: "FORBIDDEN", sourceTerm: "Duschtasse", locale: "de", targetTerm: "Duschtasse", caseSensitive: false },
  ];
  const source = "Kabina Novoterm z brodzikiem";

  it("wybiera terminy dotyczące języka i tekstu", () => {
    expect(relevantTerms(terms, "fr", source).map((t) => t.sourceTerm)).toEqual(["Novoterm"]);
    // „brodzik” nie pasuje do „brodzikiem” jako całe słowo – FORCE dotyczy dokładnej formy
    expect(relevantTerms(terms, "de", "Kabina Novoterm, brodzik w zestawie").map((t) => t.rule)).toEqual(["DO_NOT_TRANSLATE", "FORCE", "FORBIDDEN"]);
  });

  it("generuje instrukcje dla AI", () => {
    expect(glossaryInstructions(terms)[1]).toContain('"Duschwanne"');
  });

  it("wykrywa naruszenia słownika", () => {
    const w = checkGlossary(terms, "de", "Kabina Novoterm, brodzik w zestawie", "Duschkabine NOVOTERM mit Duschtasse");
    expect(w).toHaveLength(3);
    expect(checkGlossary(terms, "de", "Kabina Novoterm, brodzik w zestawie", "Duschkabine Novoterm mit Duschwanne")).toEqual([]);
  });
});

describe("workflow tłumaczeń", () => {
  it("zatwierdzanie wymaga uprawnienia akceptacji", () => {
    expect(transitionPermission("AI_DRAFT", "APPROVED")).toBe("translations.approve");
    expect(transitionPermission("AI_DRAFT", "PENDING_REVIEW")).toBe("translations.write");
    expect(transitionPermission("APPROVED", "AI_DRAFT")).toBeNull();
  });
  it("edycja zatwierdzonego tłumaczenia cofa je do akceptacji", () => {
    expect(statusAfterEdit("APPROVED")).toBe("PENDING_REVIEW");
    expect(statusAfterEdit("AI_DRAFT")).toBe("AI_DRAFT");
  });
});
