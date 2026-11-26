import { TRANSLATION_STATUS_LABELS, type TranslationStatus } from "@app/domain";

export const STATUS_TONES: Record<TranslationStatus, "warning" | "info" | "success"> = {
  AI_DRAFT: "warning",
  PENDING_REVIEW: "info",
  APPROVED: "success",
};

export { TRANSLATION_STATUS_LABELS };
