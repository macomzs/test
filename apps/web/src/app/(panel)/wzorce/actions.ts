"use server";

import { offerTemplates, templateSections } from "@app/db";
import { SECTION_TYPES } from "@app/domain";
import { writeAudit } from "@app/platform";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { validationMessage, type ActionState } from "@/server/action-state";
import { getDb } from "@/server/db";

const nameSchema = z.object({
  name: z.string().trim().min(2, "Podaj nazwę wzorca (np. „Kabiny prysznicowe”)."),
  description: z.string().trim().max(500),
});

/** Domyślna treść nowego wzorca – punkt wyjścia do edycji. */
const STARTER: Record<string, string> = {
  TITLE: "{{nazwa}} {{marka}}",
  BENEFITS: "Wymiary: {{wymiary}}\nWaga: {{waga_kg}} kg",
  DESCRIPTION: "{{nazwa}} marki {{marka}}.\n\nMateriały: {{materialy}}.",
  SET_CONTENTS: "{{nazwa_bazowa}}\nInstrukcja montażu",
  SAFETY: "Producent: {{marka}}. Montaż zgodnie z instrukcją dołączoną do produktu.",
};

export async function createTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("templates.write");
  const parsed = nameSchema.safeParse({ name: formData.get("name"), description: formData.get("description") ?? "" });
  if (!parsed.success) return { error: validationMessage(parsed.error) };
  const db = getDb();
  const id = await db.transaction(async (tx) => {
    const [t] = await tx.insert(offerTemplates).values({ ...parsed.data, createdById: user.id }).returning();
    await tx.insert(templateSections).values(SECTION_TYPES.map((type) => ({ templateId: t!.id, type, content: STARTER[type] ?? "" })));
    await writeAudit(tx, { actorId: user.id, action: "template.created", entityType: "template", entityId: t!.id, details: parsed.data });
    return t!.id;
  });
  revalidatePath("/wzorce");
  redirect(`/wzorce/${id}`);
}

export async function updateTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("templates.write");
  const id = z.string().uuid().safeParse(formData.get("id"));
  const parsed = nameSchema.safeParse({ name: formData.get("name"), description: formData.get("description") ?? "" });
  if (!id.success) return { error: "Nieprawidłowy wzorzec." };
  if (!parsed.success) return { error: validationMessage(parsed.error) };
  const db = getDb();
  const before = await db.select().from(templateSections).where(eq(templateSections.templateId, id.data));
  const changedSections: string[] = [];
  await db.transaction(async (tx) => {
    await tx.update(offerTemplates).set({ ...parsed.data, updatedAt: new Date() }).where(eq(offerTemplates.id, id.data));
    for (const type of SECTION_TYPES) {
      const content = String(formData.get(`section_${type}`) ?? "").replace(/\r\n/g, "\n");
      if ((before.find((b) => b.type === type)?.content ?? "") !== content) changedSections.push(type);
      await tx
        .insert(templateSections)
        .values({ templateId: id.data, type, content })
        .onConflictDoUpdate({ target: [templateSections.templateId, templateSections.type], set: { content } });
    }
    await writeAudit(tx, { actorId: user.id, action: "template.updated", entityType: "template", entityId: id.data, details: { ...parsed.data, changedSections } });
  });
  revalidatePath("/wzorce");
  revalidatePath(`/wzorce/${id.data}`);
  return { success: changedSections.length ? "Zapisano. Tłumaczenia produktów z tym wzorcem zostaną oznaczone jako nieaktualne." : "Zapisano." };
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const user = await requirePermission("templates.write");
  const id = z.string().uuid().parse(formData.get("id"));
  const db = getDb();
  await db.delete(offerTemplates).where(eq(offerTemplates.id, id));
  await writeAudit(db, { actorId: user.id, action: "template.deleted", entityType: "template", entityId: id });
  revalidatePath("/wzorce");
  redirect("/wzorce");
}
