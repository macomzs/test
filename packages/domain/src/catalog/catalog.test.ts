import { describe, expect, it } from "vitest";
import { isValidGtin } from "./ean";
import { normalizeFeedItems } from "./feed";
import { groupVariants, resolveInherited, splitVariantTitle } from "./variants";

describe("EAN", () => {
  it("akceptuje poprawne EAN-13 i EAN-8", () => {
    expect(isValidGtin("5907726092324")).toBe(true);
    expect(isValidGtin("96385074")).toBe(true);
  });
  it("odrzuca błędną cyfrę kontrolną i złe znaki", () => {
    expect(isValidGtin("5907726092325")).toBe(false);
    expect(isValidGtin("59077260923A4")).toBe(false);
  });
});

describe("warianty", () => {
  it("rozdziela nazwę bazową i wariant z nawiasu", () => {
    expect(splitVariantTitle("Kabina natryskowa Tomar 90 (bez brodzika)")).toEqual({ base: "Kabina natryskowa Tomar 90", label: "bez brodzika" });
    expect(splitVariantTitle("Bateria umywalkowa Maroko MA 31 Bl/Gold")).toEqual({ base: "Bateria umywalkowa Maroko MA 31 Bl/Gold", label: null });
  });

  it("grupuje tylko, gdy są co najmniej 2 pozycje o tej samej nazwie bazowej", () => {
    const groups = groupVariants([
      { key: "1", title: "Okap Shadow 35 (czarny)" },
      { key: "2", title: "Okap Shadow 35 (Biały Mat)" },
      { key: "3", title: "Drzwi Optimo D3 (grafitowe)" },
      { key: "4", title: "Uszczelka UPH 4/6" },
      { key: "5", title: "Uszczelka UPH 4/6 (czarna)" },
    ]);
    expect(groups).toHaveLength(3);
    const okap = groups.find((g) => g.type === "group" && g.base === "Okap Shadow 35");
    expect(okap && okap.type === "group" && okap.variants.map((v) => v.label)).toEqual(["czarny", "Biały Mat"]);
    const uszczelka = groups.find((g) => g.type === "group" && g.base === "Uszczelka UPH 4/6");
    expect(uszczelka && uszczelka.type === "group" && uszczelka.variants.map((v) => v.label)).toEqual(["standardowy", "czarna"]);
    expect(groups.find((g) => g.type === "single")).toMatchObject({ item: { key: "3" } });
  });

  it("wariant dziedziczy puste pola z produktu głównego", () => {
    const { values, inherited } = resolveInherited({ basePrice: "199.00", weightG: null, brand: "" }, { basePrice: "249.00", weightG: 12000, brand: "Novoterm" });
    expect(values).toEqual({ basePrice: "199.00", weightG: 12000, brand: "Novoterm" });
    expect(inherited.sort()).toEqual(["brand", "weightG"]);
  });
});

describe("normalizacja feedu", () => {
  it("waliduje pozycje i zgłasza problemy", () => {
    const { items, issues } = normalizeFeedItems([
      { title: "Syfon Speed 2", ean: "5907726092324", price: "109.00", stock: "20", image: "https://x/a.jpg" },
      { title: "Bez kodu", price: "10" },
      { title: "Zły EAN", ean: "5907726092325", price: "abc", stock: "-3", image: "" },
      { title: "Duplikat", ean: "5907726092324", price: "1" },
    ]);
    expect(items.map((i) => i.key)).toEqual(["5907726092324", "5907726092325"]);
    expect(items[0]).toMatchObject({ price: "109.00", stock: 20, imageUrls: ["https://x/a.jpg"] });
    expect(items[1]).toMatchObject({ price: null, stock: 0, imageUrls: [] });
    expect(issues.map((i) => i.message).join("\n")).toMatch(/brak EAN i SKU[\s\S]*niepoprawny EAN[\s\S]*cena[\s\S]*zdjęcia[\s\S]*duplikat/);
  });
});
