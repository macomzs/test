import { appSettings, type Database } from "@app/db";
import { decryptSecret, encryptSecret, maskSecret } from "@app/platform";
import { eq } from "drizzle-orm";

const KEY = "ai";
export const DEFAULT_AI_MODEL = "claude-opus-5-5";

export interface AiSettings {
  /** "claude" – prawdziwe tłumaczenia, "mock" – tryb testowy bez wywołań API. */
  provider: "claude" | "mock";
  model: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string | null;
}

export async function getAiSettings(db: Database): Promise<AiSettings & { apiKey: string | null }> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, KEY));
  const value = (row?.value ?? {}) as { provider?: string; model?: string };
  let apiKey: string | null = null;
  if (row?.secretEncrypted) {
    try {
      apiKey = decryptSecret(row.secretEncrypted, undefined, `app_settings:${KEY}`);
    } catch {
      apiKey = null;
    }
  }
  // Klucz z panelu ma pierwszeństwo; zmienna środowiskowa jako alternatywa dla administratorów.
  apiKey ??= process.env.ANTHROPIC_API_KEY || null;
  const provider = value.provider === "claude" && apiKey ? "claude" : "mock";
  return {
    provider,
    model: value.model || DEFAULT_AI_MODEL,
    apiKeyConfigured: !!apiKey,
    apiKeyMasked: apiKey ? maskSecret(apiKey) : null,
    apiKey,
  };
}

export async function saveAiSettings(
  db: Database,
  input: { provider: "claude" | "mock"; model: string; apiKey?: string | null; userId: string },
): Promise<void> {
  const [existing] = await db.select().from(appSettings).where(eq(appSettings.key, KEY));
  const secret = input.apiKey ? encryptSecret(input.apiKey, undefined, `app_settings:${KEY}`).ciphertext : existing?.secretEncrypted ?? null;
  const row = { value: { provider: input.provider, model: input.model }, secretEncrypted: secret, updatedById: input.userId, updatedAt: new Date() };
  await db.insert(appSettings).values({ key: KEY, ...row }).onConflictDoUpdate({ target: appSettings.key, set: row });
}
