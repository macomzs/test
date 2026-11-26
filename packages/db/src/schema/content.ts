import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { marketplaces } from "./channels";
import { products } from "./catalog";
import { users } from "./identity";

/** Sekcje oferty (wspólne dla wzorców, nadpisań i tłumaczeń). */
export const sectionType = pgEnum("section_type", ["TITLE", "BENEFITS", "DESCRIPTION", "SET_CONTENTS", "SAFETY"]);

/** Wzorzec oferty w języku polskim – sekcje z {{zmiennymi}} z atrybutów produktu. */
export const offerTemplates = pgTable("offer_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const templateSections = pgTable(
  "template_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id").notNull().references(() => offerTemplates.id, { onDelete: "cascade" }),
    type: sectionType("type").notNull(),
    content: text("content").notNull().default(""),
  },
  (t) => [uniqueIndex("template_sections_uq").on(t.templateId, t.type)],
);

/**
 * Nadpisanie sekcji oferty dla konkretnego produktu na konkretnym marketplace
 * (np. inny tytuł na Kaufland DE) – bez zmiany głównego wzorca. Treść po polsku, z {{zmiennymi}}.
 */
export const channelOverrides = pgTable(
  "channel_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    marketplaceId: uuid("marketplace_id").notNull().references(() => marketplaces.id, { onDelete: "cascade" }),
    type: sectionType("type").notNull(),
    content: text("content").notNull(),
    updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("channel_overrides_uq").on(t.productId, t.marketplaceId, t.type)],
);

/** Języki docelowe. Nowy język = nowy wiersz (bez zmian w kodzie). */
export const languages = pgTable("languages", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  isSource: boolean("is_source").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  position: integer("position").notNull().default(0),
});

export const translationStatus = pgEnum("translation_status", ["AI_DRAFT", "PENDING_REVIEW", "APPROVED"]);
export const translationJobState = pgEnum("translation_job_state", ["QUEUED", "RUNNING", "FAILED", "DONE"]);

export type TranslatedSections = Partial<Record<"TITLE" | "BENEFITS" | "DESCRIPTION" | "SET_CONTENTS" | "SAFETY", { source: string; text: string }>>;

/**
 * Tłumaczenie treści oferty produktu na jeden język.
 * scope = "base" (treść ze wzorca) albo kod marketplace (tylko sekcje nadpisane dla tego kanału).
 * source_hash pozwala wykryć, że polski oryginał zmienił się po tłumaczeniu (tłumaczenie nieaktualne).
 */
export const translations = pgTable(
  "translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    locale: text("locale").notNull().references(() => languages.code),
    scope: text("scope").notNull().default("base"),
    sections: jsonb("sections").$type<TranslatedSections>().notNull().default({}),
    sourceHash: text("source_hash").notNull().default(""),
    status: translationStatus("status").notNull().default("AI_DRAFT"),
    jobState: translationJobState("job_state"),
    jobError: text("job_error"),
    provider: text("provider"),
    warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
    translatedAt: timestamp("translated_at", { withTimezone: true }),
    reviewedById: uuid("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("translations_uq").on(t.productId, t.locale, t.scope), index("translations_status_idx").on(t.locale, t.status)],
);

export const glossaryRule = pgEnum("glossary_rule", ["DO_NOT_TRANSLATE", "FORCE", "FORBIDDEN"]);

/**
 * Słownik terminologii:
 * DO_NOT_TRANSLATE – nazwa własna/marka/jednostka zostaje bez zmian we wszystkich językach,
 * FORCE – termin PL zawsze tłumaczony na podane słowo w danym języku,
 * FORBIDDEN – słowo, którego nie wolno użyć w danym języku.
 */
export const glossaryTerms = pgTable("glossary_terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  rule: glossaryRule("rule").notNull(),
  sourceTerm: text("source_term").notNull(),
  /** Kod języka albo NULL = wszystkie języki. */
  locale: text("locale").references(() => languages.code),
  targetTerm: text("target_term"),
  caseSensitive: boolean("case_sensitive").notNull().default(false),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Ustawienia aplikacji (np. integracja AI). Sekrety – wyłącznie zaszyfrowane. */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
  secretEncrypted: text("secret_encrypted"),
  updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const offerTemplatesRelations = relations(offerTemplates, ({ many }) => ({ sections: many(templateSections) }));
export const templateSectionsRelations = relations(templateSections, ({ one }) => ({
  template: one(offerTemplates, { fields: [templateSections.templateId], references: [offerTemplates.id] }),
}));
