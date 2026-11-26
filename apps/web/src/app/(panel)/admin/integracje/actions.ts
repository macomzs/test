"use server";

import { writeAudit } from "@app/platform";
import { ClaudeTranslationProvider, DEFAULT_AI_MODEL, getAiSettings, saveAiSettings } from "@app/services";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { validationMessage, type ActionState } from "@/server/action-state";
import { getDb } from "@/server/db";

const schema = z.object({
  provider: z.enum(["claude", "mock"]),
  model: z.string().trim().regex(/^[a-z0-9.-]+$/, "Nieprawidłowa nazwa modelu.").default(DEFAULT_AI_MODEL),
  apiKey: z.string().trim().optional(),
});

export async function saveAiSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("system.manage");
  const parsed = schema.safeParse({
    provider: formData.get("provider"),
    model: String(formData.get("model") ?? "") || DEFAULT_AI_MODEL,
    apiKey: String(formData.get("apiKey") ?? "") || undefined,
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };
  const db = getDb();
  const current = await getAiSettings(db);
  if (parsed.data.provider === "claude" && !parsed.data.apiKey && !current.apiKeyConfigured) {
    return { error: "Aby włączyć tłumaczenia Claude, wklej klucz API." };
  }
  await saveAiSettings(db, { ...parsed.data, userId: user.id });
  await writeAudit(db, { actorId: user.id, action: "settings.ai_updated", details: { provider: parsed.data.provider, model: parsed.data.model, apiKeyChanged: !!parsed.data.apiKey } });
  revalidatePath("/admin/integracje");
  return { success: "Zapisano ustawienia AI." };
}

export async function testAiAction(): Promise<ActionState> {
  await requirePermission("system.manage");
  const s = await getAiSettings(getDb());
  if (s.provider !== "claude" || !s.apiKey) return { error: "Tłumaczenia Claude nie są włączone." };
  try {
    const res = await new ClaudeTranslationProvider(s.apiKey, s.model).translate({
      sourceLocale: "pl",
      targetLocale: "de",
      targetLanguageName: "Niemiecki",
      sections: { TITLE: "Kabina prysznicowa 90 x 90 cm z brodzikiem" },
      glossaryInstructions: [],
    });
    return { success: `Połączenie działa (${res.provider}). Przykład: „${res.sections.TITLE}”` };
  } catch (e) {
    return { error: `Test nie powiódł się: ${(e as Error).message}` };
  }
}
