import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { SectionType } from "@app/domain";
import { z } from "zod";

export interface TranslationRequest {
  sourceLocale: string;
  targetLocale: string;
  targetLanguageName: string;
  /** Marketplace, dla którego powstaje tekst (wpływa na styl), np. „Kaufland DE”. */
  channelName?: string;
  sections: Partial<Record<SectionType, string>>;
  glossaryInstructions: string[];
}

export interface TranslationResult {
  sections: Partial<Record<SectionType, string>>;
  provider: string;
}

export interface TranslationProvider {
  readonly name: string;
  translate(req: TranslationRequest): Promise<TranslationResult>;
}

/** Tryb testowy – bez wywołań API. Pozwala przećwiczyć cały proces akceptacji. */
export class MockTranslationProvider implements TranslationProvider {
  readonly name = "mock";
  async translate(req: TranslationRequest): Promise<TranslationResult> {
    const tag = `[${req.targetLocale.toUpperCase()}]`;
    const sections = Object.fromEntries(
      Object.entries(req.sections).map(([k, v]) => [k, (v ?? "").split("\n").map((l) => (l.trim() ? `${tag} ${l}` : l)).join("\n")]),
    );
    return { sections, provider: this.name };
  }
}

export class TranslationRefusedError extends Error {}

const SectionsSchema = z.object({
  TITLE: z.string().optional(),
  BENEFITS: z.string().optional(),
  DESCRIPTION: z.string().optional(),
  SET_CONTENTS: z.string().optional(),
  SAFETY: z.string().optional(),
});

const SYSTEM_PROMPT = `You are a professional e-commerce translator and localization specialist for a manufacturer of bathroom and home products (shower enclosures, shower trays, taps, washbasins, kitchen hoods) selling on online marketplaces.

You translate product offer content from Polish into the target language so that it reads as if written natively for shoppers in that market: natural, accurate, and using the standard technical terminology customers search for. Never invent product features, numbers, certifications or claims that are not in the source.

Formatting rules:
- Translate each section independently and return every section you received, and only those.
- Keep the line structure: one output line per input line (BENEFITS and SET_CONTENTS are one item per line; DESCRIPTION paragraphs are separated by a blank line).
- Keep numbers, units, model codes and EAN codes unchanged; adapt only the decimal separator and unit spelling to local conventions.
- Keep placeholders in square brackets such as [brak: waga_kg] exactly as they are.
- TITLE stays a single line, concise and search-friendly, without promotional phrases or emoji.`;

/** Tłumaczenia przez Claude API (structured outputs – każda sekcja wraca osobno). */
export class ClaudeTranslationProvider implements TranslationProvider {
  readonly name: string;
  private client: Anthropic;

  constructor(apiKey: string, private model: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 3 });
    this.name = `claude:${model}`;
  }

  async translate(req: TranslationRequest): Promise<TranslationResult> {
    const glossary = req.glossaryInstructions.length ? `\n\nTerminology rules (mandatory):\n${req.glossaryInstructions.map((g) => `- ${g}`).join("\n")}` : "";
    const channel = req.channelName ? ` The text will be published on ${req.channelName}.` : "";
    const userText =
      `Translate the following product offer sections from Polish (${req.sourceLocale}) into ${req.targetLanguageName} (${req.targetLocale}).${channel}${glossary}\n\n` +
      `<sections>\n${JSON.stringify(req.sections, null, 2)}\n</sections>`;

    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      // Na wypadek odmowy modelu (klasyfikatory bezpieczeństwa) API samo ponawia na modelu zapasowym.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(SectionsSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
    });

    if (response.stop_reason === "refusal") {
      throw new TranslationRefusedError("Model odmówił przetłumaczenia tej treści. Przetłumacz ręcznie lub zmień treść.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error("Odpowiedź modelu została ucięta (zbyt długa treść).");
    }
    const parsed = response.parsed_output;
    if (!parsed) throw new Error("Model zwrócił odpowiedź w nieoczekiwanym formacie.");

    const sections: Partial<Record<SectionType, string>> = {};
    for (const key of Object.keys(req.sections) as SectionType[]) {
      const text = parsed[key];
      if (typeof text !== "string" || !text.trim()) throw new Error(`Brak przetłumaczonej sekcji ${key} w odpowiedzi modelu.`);
      sections[key] = text.trim();
    }
    return { sections, provider: `claude:${response.model}` };
  }
}
