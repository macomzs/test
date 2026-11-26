"use server";

import { auditLogs, users, verifyPassword } from "@app/db";
import { writeAudit } from "@app/platform";
import { and, eq, gt, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, getCurrentUser } from "@/server/auth";
import { keepFields, type ActionState } from "@/server/action-state";
import { getDb } from "@/server/db";
import { getRequestMeta } from "@/server/request";

const MAX_FAILED = 5;
const LOCK_WINDOW_MIN = 15;

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail."),
  password: z.string().min(1, "Podaj hasło."),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields: keepFields(formData, ["email"]) };
  const { email, password } = parsed.data;
  const db = getDb();
  const { ip } = await getRequestMeta();

  // Ochrona przed zgadywaniem haseł: blokada po 5 nieudanych próbach w ciągu 15 minut.
  const since = new Date(Date.now() - LOCK_WINDOW_MIN * 60_000);
  const [{ failed }] = (await db
    .select({ failed: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, "auth.login.failed"), eq(auditLogs.entityId, email), gt(auditLogs.createdAt, since)))) as [
    { failed: number },
  ];
  if (failed >= MAX_FAILED) {
    return { fields: keepFields(formData, ["email"]), error: `Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za ${LOCK_WINDOW_MIN} minut.` };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email));
  const ok = user ? await verifyPassword(user.passwordHash, password) : false;
  if (!user || !ok || !user.isActive) {
    await writeAudit(db, { actorId: user?.id ?? null, action: "auth.login.failed", entityType: "user", entityId: email, ip, details: { reason: !user ? "unknown_user" : !ok ? "bad_password" : "inactive" } });
    return { error: "Nieprawidłowy e-mail lub hasło.", fields: keepFields(formData, ["email"]) };
  }

  await createSession(user.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await writeAudit(db, { actorId: user.id, action: "auth.login", entityType: "user", entityId: user.id, ip });
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await writeAudit(getDb(), { actorId: user.id, action: "auth.logout", entityType: "user", entityId: user.id });
  redirect("/logowanie");
}
