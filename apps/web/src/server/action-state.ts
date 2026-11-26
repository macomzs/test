export type ActionState = { error?: string; success?: string; fields?: Record<string, string> } | undefined;

/** Zwraca wpisane wartości formularza (bez haseł i sekretów), aby nie znikały po błędzie walidacji. */
export function keepFields(formData: FormData, names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((n) => [n, String(formData.get(n) ?? "")]));
}

import type { z } from "zod";

/** Zamienia błąd walidacji Zod na czytelny komunikat. */
export function validationMessage(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(" ");
}
