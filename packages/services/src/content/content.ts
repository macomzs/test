import { channelOverrides, marketplaces, offerTemplates, products, templateSections, type Database } from "@app/db";
import {
  productTemplateValues,
  renderTemplate,
  resolveInherited,
  SECTION_TYPES,
  type RenderResult,
  type SectionType,
} from "@app/domain";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";

type ProductRow = typeof products.$inferSelect;

export interface ProductContext {
  product: ProductRow;
  parent: ProductRow | null;
  /** Wzorzec produktu lub (dla wariantu) wzorzec produktu głównego. */
  template: { id: string; name: string; sections: Partial<Record<SectionType, string>> } | null;
  templateInherited: boolean;
  values: ReturnType<typeof productTemplateValues>;
}

export async function loadProductContext(db: Database, productId: string): Promise<ProductContext | null> {
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) return null;
  const parent = product.parentId ? ((await db.select().from(products).where(eq(products.id, product.parentId)))[0] ?? null) : null;
  const { values: resolved } = resolveInherited(product, parent);

  const templateId = product.templateId ?? parent?.templateId ?? null;
  let template: ProductContext["template"] = null;
  if (templateId) {
    const [t] = await db.select().from(offerTemplates).where(eq(offerTemplates.id, templateId));
    if (t) {
      const secs = await db.select().from(templateSections).where(eq(templateSections.templateId, t.id));
      template = { id: t.id, name: t.name, sections: Object.fromEntries(secs.map((s) => [s.type, s.content])) };
    }
  }

  return {
    product,
    parent,
    template,
    templateInherited: !product.templateId && !!template,
    values: productTemplateValues({ ...resolved, parentName: parent?.name ?? null }),
  };
}

export type RenderedSections = Partial<Record<SectionType, RenderResult>>;

/** Treść bazowa oferty (PL) – sekcje wzorca z podstawionymi zmiennymi. Puste sekcje są pomijane. */
export function renderBase(ctx: ProductContext): RenderedSections {
  const out: RenderedSections = {};
  if (!ctx.template) return out;
  for (const type of SECTION_TYPES) {
    const content = ctx.template.sections[type];
    if (content?.trim()) out[type] = renderTemplate(content, ctx.values);
  }
  return out;
}

export interface ChannelContent {
  marketplace: typeof marketplaces.$inferSelect;
  /** Pełna treść dla kanału: baza + nadpisania. */
  sections: RenderedSections;
  overridden: SectionType[];
  rawOverrides: Partial<Record<SectionType, string>>;
}

export async function renderForChannel(db: Database, ctx: ProductContext, marketplaceId: string): Promise<ChannelContent | null> {
  const [marketplace] = await db.select().from(marketplaces).where(eq(marketplaces.id, marketplaceId));
  if (!marketplace) return null;
  const overrides = await db
    .select()
    .from(channelOverrides)
    .where(and(eq(channelOverrides.productId, ctx.product.id), eq(channelOverrides.marketplaceId, marketplaceId)));
  const sections = renderBase(ctx);
  const rawOverrides: Partial<Record<SectionType, string>> = {};
  for (const o of overrides) {
    rawOverrides[o.type] = o.content;
    sections[o.type] = renderTemplate(o.content, ctx.values);
  }
  return { marketplace, sections, overridden: overrides.map((o) => o.type), rawOverrides };
}

/**
 * Tekst źródłowy (PL) do tłumaczenia dla danego zakresu:
 * "base" – wszystkie sekcje ze wzorca, kod marketplace – tylko sekcje nadpisane dla tego kanału.
 */
export async function sourceForScope(db: Database, productId: string, scope: string): Promise<Partial<Record<SectionType, string>> | null> {
  const ctx = await loadProductContext(db, productId);
  if (!ctx) return null;
  if (scope === "base") {
    return Object.fromEntries(Object.entries(renderBase(ctx)).map(([k, v]) => [k, v!.text]));
  }
  const [m] = await db.select().from(marketplaces).where(eq(marketplaces.code, scope));
  if (!m) return null;
  const ch = await renderForChannel(db, ctx, m.id);
  if (!ch) return null;
  return Object.fromEntries(ch.overridden.map((t) => [t, ch.sections[t]!.text]));
}

/** Skrót treści źródłowej – zmiana PL po tłumaczeniu oznacza tłumaczenie jako nieaktualne. */
export function hashSections(sections: Partial<Record<SectionType, string>>): string {
  const normalized = SECTION_TYPES.filter((t) => sections[t] !== undefined).map((t) => `${t}\u0000${sections[t]}`).join("\u0001");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}
