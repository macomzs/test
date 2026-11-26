import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptJson, decryptSecret, encryptJson, encryptSecret, maskSecret, parseKeyring } from "./crypto";

const k1 = randomBytes(32).toString("base64");
const k2 = randomBytes(32).toString("base64");

describe("szyfrowanie sekretów", () => {
  it("szyfruje i odszyfrowuje wartość", () => {
    const ring = parseKeyring(`1:${k1}`, "1");
    const enc = encryptSecret("tajny-token", ring);
    expect(enc.ciphertext).not.toContain("tajny-token");
    expect(decryptSecret(enc.ciphertext, ring)).toBe("tajny-token");
  });

  it("za każdym razem daje inny szyfrogram (losowy IV)", () => {
    const ring = parseKeyring(`1:${k1}`, "1");
    expect(encryptSecret("x", ring).ciphertext).not.toBe(encryptSecret("x", ring).ciphertext);
  });

  it("obsługuje rotację: stare dane czytelne po zmianie aktywnego klucza", () => {
    const oldRing = parseKeyring(`1:${k1}`, "1");
    const old = encryptJson({ clientSecret: "abc" }, oldRing);
    const newRing = parseKeyring(`1:${k1},2:${k2}`, "2");
    expect(decryptJson(old.ciphertext, newRing)).toEqual({ clientSecret: "abc" });
    expect(encryptSecret("y", newRing).keyVersion).toBe(2);
  });

  it("wykrywa manipulację szyfrogramem", () => {
    const ring = parseKeyring(`1:${k1}`, "1");
    const parts = encryptSecret("dane", ring).ciphertext.split(".");
    parts[4] = Buffer.from("inne").toString("base64url");
    expect(() => decryptSecret(parts.join("."), ring)).toThrow();
  });

  it("wiąże szyfrogram z kontekstem (AAD), np. ID konta", () => {
    const ring = parseKeyring(`1:${k1}`, "1");
    const enc = encryptSecret("dane", ring, "konto-A");
    expect(() => decryptSecret(enc.ciphertext, ring, "konto-B")).toThrow();
  });

  it("odrzuca klucz o złej długości", () => {
    expect(() => parseKeyring(`1:${Buffer.from("krotki").toString("base64")}`, "1")).toThrow(/32 bajty/);
  });

  it("maskuje sekrety", () => {
    expect(maskSecret("sk_live_abcd1234")).toBe("••••1234");
  });
});
