import { describe, expect, it } from "vitest";
import { parseXmlFeed } from "./feed-xml";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?><data>
  <post><Title>Syfon brodzikowy Speed 2 fi90mm niski (czarny)</Title><EAN>5907726092324</EAN><Stock>20</Stock><Price>109.00</Price><Image>https://example.com/a.jpg</Image></post>
  <post><Title>Uszczelka &quot;H&quot; UPH 4/6 &amp; inne</Title><EAN>0012345678905</EAN><Stock>0</Stock><Price>1,50</Price><Image></Image></post>
</data>`;

describe("feed XML", () => {
  it("parsuje pozycje, zachowuje zera wiodące w EAN i dekoduje encje", () => {
    const { items, issues } = parseXmlFeed(SAMPLE);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ ean: "5907726092324", price: "109.00", stock: 20, imageUrls: ["https://example.com/a.jpg"] });
    expect(items[1]).toMatchObject({ ean: "0012345678905", title: 'Uszczelka "H" UPH 4/6 & inne', price: "1.50" });
    expect(issues.some((i) => i.message.includes("brak zdjęcia"))).toBe(true);
  });

  it("obsługuje feed z jednym produktem", () => {
    const { items } = parseXmlFeed(`<data><post><Title>A</Title><EAN>5907726092324</EAN><Price>1</Price></post></data>`);
    expect(items).toHaveLength(1);
  });

  it("zgłasza czytelny błąd przy złej strukturze", () => {
    expect(() => parseXmlFeed(`<root><item/></root>`)).toThrow(/Nie znaleziono produktów/);
  });
});
