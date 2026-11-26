/** Walidacja kodów EAN-8 / EAN-13 / GTIN-14 (cyfra kontrolna GS1). */
export function normalizeEan(value: string | null | undefined): string | null {
  const v = (value ?? "").replace(/\s+/g, "");
  return v.length ? v : null;
}

export function isValidGtin(value: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
