"use server";

import { products } from "@app/db";
import { isValidGtin, normalizeEan } from "@app/domain";
import { emitEvent, writeAudit } from "@app/platform";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseDecimal } from "@/lib/catalog";
import { requirePermission } from "@/server/auth";
import { validationMessage, type ActionState } from "@/server/action-state";
import { getDb } from "@/server/db";
import { getRequestMeta } from "@/server/request";

const schema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(3, "Nazwa musi mieć co najmniej 3 znaki."),
  variantLabel: z.string().trim().max(100).nullable(),
  sku: z.string().trim().max(64).nullable(),
  ean: z.string().nullable(),
  brand: z.string().trim().max(100).nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  materials: z.string().trim().max(500).nullable(),
});

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export async function updateProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("catalog.write");
  const parsed = schema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    variantLabel: emptyToNull(formData.get("variantLabel")),
    sku: emptyToNull(formData.get("sku")),
    ean: normalizeEan(emptyToNull(formData.get("ean"))),
    brand: emptyToNull(formData.get("brand")),
    status: formData.get("status"),
    materials: emptyToNull(formData.get("materials")),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };
  const d = parsed.data;
  if (d.ean && !isValidGtin(d.ean)) return { error: `EAN ${d.ean} jest niepoprawny (sprawdź cyfrę kontrolną).` };

  // Liczby: ceny w zł, wymiary w cm, waga w kg → zapis w mm i g.
  const nums = {
    basePrice: parseDecimal(formData.get("basePrice")),
    costPrice: parseDecimal(formData.get("costPrice")),
    lengthCm: parseDecimal(formData.get("lengthCm")),
    widthCm: parseDecimal(formData.get("widthCm")),
    heightCm: parseDecimal(formData.get("heightCm")),
    weightKg: parseDecimal(formData.get("weightKg")),
  };
  for (const [k, v] of Object.entries(nums)) {
    if (v !== null && (Number.isNaN(v) || v < 0)) return { error: `Pole „${FIELD_LABELS[k]}” musi być liczbą nieujemną.` };
  }

  const db = getDb();
  const [before] = await db.select().from(products).where(eq(products.id, d.id));
  if (!before) return { error: "Nie znaleziono produktu." };
  if (d.sku) {
    const [dup] = await db.select({ id: products.id, name: products.name }).from(products).where(and(eq(products.sku, d.sku), ne(products.id, d.id)));
    if (dup) return { error: `SKU „${d.sku}” jest już używane przez produkt „${dup.name}”.` };
  }
  if (d.ean) {
    const [dup] = await db.select({ id: products.id, name: products.name }).from(products).where(and(eq(products.ean, d.ean), ne(products.id, d.id)));
    if (dup) return { error: `EAN ${d.ean} jest już używany przez produkt „${dup.name}”.` };
  }

  const mm = (cm: number | null) => (cm === null ? null : Math.round(cm * 10));
  const after = {
    name: d.name,
    variantLabel: before.kind === "VARIANT" ? d.variantLabel : null,
    sku: d.sku,
    ean: before.kind === "PARENT" ? null : d.ean,
    brand: d.brand,
    status: d.status,
    materials: d.materials,
    basePrice: nums.basePrice === null ? null : nums.basePrice.toFixed(2),
    costPrice: nums.costPrice === null ? null : nums.costPrice.toFixed(2),
    lengthMm: mm(nums.lengthCm),
    widthMm: mm(nums.widthCm),
    heightMm: mm(nums.heightCm),
    weightG: nums.weightKg === null ? null : Math.round(nums.weightKg * 1000),
  };
  const changed = Object.fromEntries(
    Object.entries(after).filter(([k, v]) => (before as Record<string, unknown>)[k] !== v).map(([k, v]) => [k, { z: (before as Record<string, unknown>)[k], na: v }]),
  );
  if (!Object.keys(changed).length) return { success: "Brak zmian do zapisania." };

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx.update(products).set({ ...after, updatedAt: new Date() }).where(eq(products.id, d.id));
    await writeAudit(tx, { actorId: user.id, action: "catalog.product.updated", entityType: "product", entityId: d.id, ip, details: { zmiany: changed } });
    await emitEvent(tx, "catalog.product.updated", { productId: d.id, fields: Object.keys(changed) });
  });
  revalidatePath("/katalog");
  revalidatePath(`/katalog/${d.id}`);
  return { success: "Zapisano zmiany." };
}

const FIELD_LABELS: Record<string, string> = {
  basePrice: "Cena bazowa",
  costPrice: "Koszt własny",
  lengthCm: "Długość",
  widthCm: "Szerokość",
  heightCm: "Wysokość",
  weightKg: "Waga",
};
