"use server";

import { hashPassword, MIN_PASSWORD_LENGTH, roles, userRoles, users } from "@app/db";
import { writeAudit } from "@app/platform";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, revokeSessions } from "@/server/auth";
import { keepFields, validationMessage, type ActionState } from "@/server/action-state";
import { getDb } from "@/server/db";
import { getRequestMeta } from "@/server/request";

const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH, `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`);

const createSchema = z.object({
  name: z.string().trim().min(2, "Podaj imię i nazwisko."),
  email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail."),
  password: passwordSchema,
  roleIds: z.array(z.string().uuid()).min(1, "Wybierz co najmniej jedną rolę."),
});

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.manage");
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roleIds: formData.getAll("roleIds"),
  });
  const fields = keepFields(formData, ["name", "email"]);
  if (!parsed.success) return { error: validationMessage(parsed.error), fields };
  const { name, email, password, roleIds } = parsed.data;
  const db = getDb();

  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) return { error: "Użytkownik z tym adresem e-mail już istnieje.", fields };

  const { ip } = await getRequestMeta();
  const passwordHash = await hashPassword(password);
  const id = await db.transaction(async (tx) => {
    const [created] = await tx.insert(users).values({ name, email, passwordHash }).returning({ id: users.id });
    await tx.insert(userRoles).values(roleIds.map((roleId) => ({ userId: created!.id, roleId })));
    await writeAudit(tx, { actorId: actor.id, action: "user.created", entityType: "user", entityId: created!.id, ip, details: { email, name, roleIds } });
    return created!.id;
  });
  revalidatePath("/admin/uzytkownicy");
  redirect(`/admin/uzytkownicy/${id}?utworzono=1`);
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2, "Podaj imię i nazwisko."),
  isActive: z.boolean(),
  roleIds: z.array(z.string().uuid()),
});

/** Sprawdza, czy po zmianie w systemie pozostanie co najmniej jeden aktywny administrator. */
async function wouldRemoveLastAdmin(userId: string, stillAdmin: boolean): Promise<boolean> {
  if (stillAdmin) return false;
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${users.id})::int` })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(roles.code, "ADMIN"), eq(users.isActive, true), ne(users.id, userId)));
  return (row?.n ?? 0) === 0;
}

export async function updateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.manage");
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    isActive: formData.get("isActive") === "on",
    roleIds: formData.getAll("roleIds"),
  });
  if (!parsed.success) return { error: validationMessage(parsed.error) };
  const { id, name, isActive, roleIds } = parsed.data;
  const db = getDb();

  const selectedRoles = roleIds.length ? await db.select().from(roles).where(inArray(roles.id, roleIds)) : [];
  const stillAdmin = isActive && selectedRoles.some((r) => r.code === "ADMIN");
  if (await wouldRemoveLastAdmin(id, stillAdmin)) {
    return { error: "Nie można odebrać uprawnień ostatniemu aktywnemu administratorowi." };
  }

  const [before] = await db.select().from(users).where(eq(users.id, id));
  if (!before) return { error: "Nie znaleziono użytkownika." };
  const beforeRoles = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, id));

  const { ip } = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ name, isActive, updatedAt: new Date() }).where(eq(users.id, id));
    await tx.delete(userRoles).where(eq(userRoles.userId, id));
    if (roleIds.length) await tx.insert(userRoles).values(roleIds.map((roleId) => ({ userId: id, roleId })));
    await writeAudit(tx, {
      actorId: actor.id,
      action: "user.updated",
      entityType: "user",
      entityId: id,
      ip,
      details: {
        before: { name: before.name, isActive: before.isActive, roleIds: beforeRoles.map((r) => r.roleId) },
        after: { name, isActive, roleIds },
      },
    });
  });
  if (!isActive) await revokeSessions([id]);
  revalidatePath("/admin/uzytkownicy");
  return { success: "Zapisano zmiany." };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.manage");
  const id = z.string().uuid().safeParse(formData.get("id"));
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!id.success) return { error: "Nieprawidłowy użytkownik." };
  if (!password.success) return { error: validationMessage(password.error) };

  const db = getDb();
  await db.update(users).set({ passwordHash: await hashPassword(password.data), updatedAt: new Date() }).where(eq(users.id, id.data));
  await revokeSessions([id.data]);
  const { ip } = await getRequestMeta();
  await writeAudit(db, { actorId: actor.id, action: "user.password_reset", entityType: "user", entityId: id.data, ip });
  return { success: "Hasło zostało zmienione. Użytkownik został wylogowany ze wszystkich urządzeń." };
}
