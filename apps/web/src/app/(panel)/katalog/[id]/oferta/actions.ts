"use server";

import { channelOverrides, offerTemplates, products } from "@app/db";
import { SECTION_TYPES } from "@app/domain";
import { emitEvent, writeAudit } from "@app/platform";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import type { ActionState } from "@/server/action-state";
import { getDb } from "@/server/db";

export async function assignTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("templates.write");
  const productId = z.string().uuid().safeParse(formData.get("productId"));
  const raw = String(formData.get("templateId") ?? "");
  if (!productId.success) return { error: "Nieprawidłowy produkt." };
  const templateId = raw ? z.string().uuid().safeParse(raw) : null;
  if (templateId && !templateId.success) return { error: "Nieprawidłowy wzorzec." };
  const db = getDb();
  if (templateId) {
    const [t] = await db.select({ id: offerTemplates.id }).from(offerTemplates).where(eq(offerTemplates.id, templateId.data));
    if (!t) return { error: "Wzorzec nie istnieje." };
  }
  await db.transaction(async (tx) => {
    await tx.update(products).set({ templateId: templateId?.data ?? null, updatedAt: new Date() }).where(eq(products.id, productId.data));
    await writeAudit(tx, { actorId: user.id, action: "product.template_assigned", entityType: "product", entityId: productId.data, details: { templateId: templateId?.data ?? null } });
    await emitEvent(tx, "content.product.changed", { productId: productId.data });
  });
  revalidatePath(`/katalog/${productId.data}/oferta`);
  return { success: templateId ? "Przypisano wzorzec." : "Usunięto przypisanie wzorca." };
}

export async function saveOverridesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("templates.write");
  const ids = z.object({ productId: z.string().uuid(), marketplaceId: z.string().uuid() }).safeParse({
    productId: formData.get("productId"),
    marketplaceId: formData.get("marketplaceId"),
  });
  if (!ids.success) return { error: "Nieprawidłowe dane." };
  const { productId, marketplaceId } = ids.data;
  const db = getDb();
  const changed: string[] = [];
  await db.transaction(async (tx) => {
    for (const type of SECTION_TYPES) {
      const content = String(formData.get(`override_${type}`) ?? "").replace(/\r\n/g, "\n").trim();
      const where = and(eq(channelOverrides.productId, productId), eq(channelOverrides.marketplaceId, marketplaceId), eq(channelOverrides.type, type));
      const [existing] = await tx.select().from(channelOverrides).where(where);
      if (!content && existing) {
        await tx.delete(channelOverrides).where(where);
        changed.push(type);
      } else if (content && existing?.content !== content) {
        await tx
          .insert(channelOverrides)
          .values({ productId, marketplaceId, type, content, updatedById: user.id })
          .onConflictDoUpdate({
            target: [channelOverrides.productId, channelOverrides.marketplaceId, channelOverrides.type],
            set: { content, updatedById: user.id, updatedAt: new Date() },
          });
        changed.push(type);
      }
    }
    if (changed.length) {
      await writeAudit(tx, { actorId: user.id, action: "channel_override.updated", entityType: "product", entityId: productId, details: { marketplaceId, sections: changed } });
      await emitEvent(tx, "content.product.changed", { productId });
    }
  });
  revalidatePath(`/katalog/${productId}/oferta`);
  return { success: changed.length ? `Zapisano nadpisania (${changed.length}).` : "Brak zmian." };
}
