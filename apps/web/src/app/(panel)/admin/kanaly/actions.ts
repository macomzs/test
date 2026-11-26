"use server";

import { channelAccounts, marketplaces } from "@app/db";
import { credentialFieldsFor } from "@app/domain";
import { decryptJson, encryptJson, writeAudit } from "@app/platform";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { keepFields, validationMessage, type ActionState } from "@/server/action-state";
import { getDb } from "@/server/db";
import { getRequestMeta } from "@/server/request";

type Credentials = Record<string, string>;

/** Odczytuje pola poświadczeń z formularza; puste pola oznaczają „bez zmian”. */
function readCredentialFields(connectorKey: string, formData: FormData): Credentials {
  const result: Credentials = {};
  for (const f of credentialFieldsFor(connectorKey)) {
    const v = String(formData.get(`cred_${f.key}`) ?? "").trim();
    if (v) result[f.key] = v;
  }
  return result;
}

const createSchema = z.object({
  marketplaceId: z.string().uuid("Wybierz marketplace."),
  name: z.string().trim().min(2, "Podaj nazwę konta (np. „Allegro – sklep główny”)."),
});

export async function createChannelAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("channels.manage");
  const parsed = createSchema.safeParse({ marketplaceId: formData.get("marketplaceId"), name: formData.get("name") });
  if (!parsed.success) return { error: validationMessage(parsed.error), fields: keepFields(formData, ["name", "marketplaceId"]) };
  const db = getDb();
  const [mkt] = await db.select().from(marketplaces).where(eq(marketplaces.id, parsed.data.marketplaceId));
  if (!mkt) return { error: "Nie znaleziono marketplace." };

  const id = randomUUID();
  const creds = readCredentialFields(mkt.connectorKey, formData);
  // Szyfrogram jest powiązany z ID konta (AAD) – nie da się go „przenieść” na inne konto.
  const enc = Object.keys(creds).length ? encryptJson(creds, undefined, id) : null;
  const { ip } = await getRequestMeta();

  await db.transaction(async (tx) => {
    await tx.insert(channelAccounts).values({
      id,
      marketplaceId: mkt.id,
      name: parsed.data.name,
      credentialsEncrypted: enc?.ciphertext ?? null,
      credentialsKeyVersion: enc?.keyVersion ?? null,
      credentialsUpdatedAt: enc ? new Date() : null,
      createdById: actor.id,
    });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "channel_account.created",
      entityType: "channel_account",
      entityId: id,
      ip,
      details: { marketplace: mkt.code, name: parsed.data.name, credentialFields: Object.keys(creds) },
    });
  });
  revalidatePath("/admin/kanaly");
  redirect(`/admin/kanaly/${id}`);
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2, "Podaj nazwę konta."),
  status: z.enum(["ACTIVE", "DISABLED"]),
});

export async function updateChannelAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("channels.manage");
  const parsed = updateSchema.safeParse({ id: formData.get("id"), name: formData.get("name"), status: formData.get("status") });
  if (!parsed.success) return { error: validationMessage(parsed.error) };
  const db = getDb();
  const [row] = await db
    .select({ account: channelAccounts, connectorKey: marketplaces.connectorKey })
    .from(channelAccounts)
    .innerJoin(marketplaces, eq(marketplaces.id, channelAccounts.marketplaceId))
    .where(eq(channelAccounts.id, parsed.data.id));
  if (!row) return { error: "Nie znaleziono konta." };

  const changed = readCredentialFields(row.connectorKey, formData);
  const existing: Credentials = row.account.credentialsEncrypted ? decryptJson<Credentials>(row.account.credentialsEncrypted, undefined, row.account.id) : {};
  const hasChanges = Object.keys(changed).length > 0;
  const enc = hasChanges ? encryptJson({ ...existing, ...changed }, undefined, row.account.id) : null;
  const { ip } = await getRequestMeta();

  await db.transaction(async (tx) => {
    await tx
      .update(channelAccounts)
      .set({
        name: parsed.data.name,
        status: parsed.data.status,
        updatedAt: new Date(),
        ...(enc ? { credentialsEncrypted: enc.ciphertext, credentialsKeyVersion: enc.keyVersion, credentialsUpdatedAt: new Date() } : {}),
      })
      .where(eq(channelAccounts.id, row.account.id));
    await writeAudit(tx, {
      actorId: actor.id,
      action: "channel_account.updated",
      entityType: "channel_account",
      entityId: row.account.id,
      ip,
      details: {
        before: { name: row.account.name, status: row.account.status },
        after: { name: parsed.data.name, status: parsed.data.status },
        credentialFieldsChanged: Object.keys(changed),
      },
    });
  });
  revalidatePath("/admin/kanaly");
  return { success: hasChanges ? "Zapisano zmiany i zaszyfrowano nowe poświadczenia." : "Zapisano zmiany." };
}
