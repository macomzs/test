import type { Permission } from "../permissions";

export type TranslationStatus = "AI_DRAFT" | "PENDING_REVIEW" | "APPROVED";

export const TRANSLATION_STATUS_LABELS: Record<TranslationStatus, string> = {
  AI_DRAFT: "Szkic AI",
  PENDING_REVIEW: "Do akceptacji",
  APPROVED: "Zatwierdzone",
};

/** Dozwolone przejścia statusów i wymagane uprawnienie. */
const TRANSITIONS: Record<TranslationStatus, Partial<Record<TranslationStatus, Permission>>> = {
  AI_DRAFT: { PENDING_REVIEW: "translations.write", APPROVED: "translations.approve" },
  PENDING_REVIEW: { AI_DRAFT: "translations.write", APPROVED: "translations.approve" },
  APPROVED: { PENDING_REVIEW: "translations.write" },
};

export function transitionPermission(from: TranslationStatus, to: TranslationStatus): Permission | null {
  return TRANSITIONS[from][to] ?? null;
}

/**
 * Status po ręcznej edycji treści: zatwierdzone tłumaczenie po zmianie wraca do akceptacji,
 * szkic AI pozostaje szkicem.
 */
export function statusAfterEdit(current: TranslationStatus): TranslationStatus {
  return current === "APPROVED" ? "PENDING_REVIEW" : current;
}
