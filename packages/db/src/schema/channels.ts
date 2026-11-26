import { relations } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity";

export const channelAccountStatus = pgEnum("channel_account_status", ["ACTIVE", "DISABLED", "AUTH_ERROR"]);

/** Marketplace'y obsługiwane przez system (lista utrzymywana w kodzie, razem z konektorami). */
export const marketplaces = pgTable("marketplaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  defaultLocale: text("default_locale").notNull(),
  currency: text("currency").notNull(),
  /** Klucz konektora w rejestrze konektorów (np. "allegro", "kaufland", "mirakl"). */
  connectorKey: text("connector_key").notNull(),
  /** Kolor odznaki w interfejsie. */
  badgeColor: text("badge_color").notNull().default("#64748b"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Konkretne konto firmy na danym marketplace (może być kilka kont na jednym marketplace). */
export const channelAccounts = pgTable(
  "channel_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketplaceId: uuid("marketplace_id").notNull().references(() => marketplaces.id),
    name: text("name").notNull(),
    status: channelAccountStatus("status").notNull().default("ACTIVE"),
    /** Zaszyfrowane poświadczenia (AES-256-GCM) – patrz @app/platform/crypto. */
    credentialsEncrypted: text("credentials_encrypted"),
    credentialsKeyVersion: integer("credentials_key_version"),
    credentialsUpdatedAt: timestamp("credentials_updated_at", { withTimezone: true }),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("channel_accounts_marketplace_idx").on(t.marketplaceId)],
);

export const marketplacesRelations = relations(marketplaces, ({ many }) => ({ accounts: many(channelAccounts) }));
export const channelAccountsRelations = relations(channelAccounts, ({ one }) => ({
  marketplace: one(marketplaces, { fields: [channelAccounts.marketplaceId], references: [marketplaces.id] }),
}));
