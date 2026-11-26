import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity";

/**
 * SIMPLE  – produkt bez wariantów,
 * PARENT  – produkt główny grupujący warianty (sam nie jest sprzedawany),
 * VARIANT – wariant (np. kolor) – brakujące dane dziedziczy z produktu głównego.
 */
export const productKind = pgEnum("product_kind", ["SIMPLE", "PARENT", "VARIANT"]);
export const productStatus = pgEnum("product_status", ["DRAFT", "ACTIVE", "ARCHIVED"]);
export const productSource = pgEnum("product_source", ["MANUAL", "FEED"]);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: productKind("kind").notNull().default("SIMPLE"),
    parentId: uuid("parent_id").references((): AnyPgColumn => products.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    /** Nazwa wariantu, np. „czarny”, „bez brodzika”. */
    variantLabel: text("variant_label"),
    sku: text("sku"),
    ean: text("ean"),
    brand: text("brand"),
    status: productStatus("status").notNull().default("DRAFT"),
    /** Cena bazowa (sugerowana cena sprzedaży brutto). */
    basePrice: numeric("base_price", { precision: 12, scale: 2 }),
    costPrice: numeric("cost_price", { precision: 12, scale: 2 }),
    currency: text("currency").notNull().default("PLN"),
    lengthMm: integer("length_mm"),
    widthMm: integer("width_mm"),
    heightMm: integer("height_mm"),
    weightG: integer("weight_g"),
    materials: text("materials"),
    stockQty: integer("stock_qty"),
    stockUpdatedAt: timestamp("stock_updated_at", { withTimezone: true }),
    source: productSource("source").notNull().default("MANUAL"),
    /** Ostatnie wartości otrzymane z feedu – pozwalają nie nadpisywać ręcznych zmian. */
    sourceData: jsonb("source_data").$type<Record<string, unknown>>(),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("products_sku_uq").on(t.sku),
    uniqueIndex("products_ean_uq").on(t.ean),
    index("products_parent_idx").on(t.parentId),
    index("products_name_idx").on(t.name),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    /** Adres zdjęcia. W kolejnym kroku zdjęcia będą kopiowane do własnego magazynu plików. */
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
    alt: text("alt"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("product_images_product_idx").on(t.productId, t.position)],
);

/** Źródła importu produktów (np. feed XML producenta). */
export const importSources = pgTable("import_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull().default("XML_FEED"),
  url: text("url").notNull(),
  /** Mapowanie pól feedu na pola produktu (np. { title: "Title", ean: "EAN" }). */
  mapping: jsonb("mapping").$type<Record<string, string>>().notNull().default({}),
  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
});

export const importRuns = pgTable(
  "import_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id").references(() => importSources.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdCount: integer("created_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    /** Lista problemów: [{ key, message }]. */
    issues: jsonb("issues").$type<{ key: string; message: string }[]>().notNull().default([]),
  },
  (t) => [index("import_runs_started_idx").on(t.startedAt)],
);

export const productsRelations = relations(products, ({ one, many }) => ({
  parent: one(products, { fields: [products.parentId], references: [products.id], relationName: "variants" }),
  variants: many(products, { relationName: "variants" }),
  images: many(productImages),
}));
export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));
