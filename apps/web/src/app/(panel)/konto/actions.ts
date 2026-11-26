"use server";

import { hashPassword, MIN_PASSWORD_LENGTH, sessions, users, verifyPassword } from "@app/db";
import { writeAudit } from "@app/platform";
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requireUser, SESSION_COOKIE } from "@/server/auth";
import { validationMessage, type ActionState } from "@/server/action-state";
import { getDb } from "@/server/db";
import { getRequestMeta } from "@/server/request";

const schema = z
  .object({
    current: z.string().min(1, "Podaj obecne hasło."),
    next: z.string().min(MIN_PASSWORD_LENGTH, `Nowe hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "Nowe hasła nie są identyczne." });

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: validationMessage(parsed.error) };
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, user.id));
  if (!row || !(await verifyPassword(row.passwordHash, parsed.data.current))) return { error: "Obecne hasło jest nieprawidłowe." };

  await db.update(users).set({ passwordHash: await hashPassword(parsed.data.next), updatedAt: new Date() }).where(eq(users.id, user.id));
  // Wyloguj pozostałe urządzenia, zachowaj bieżącą sesję.
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  const currentHash = createHash("sha256").update(token).digest("hex");
  await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.tokenHash, currentHash)));
  const { ip } = await getRequestMeta();
  await writeAudit(db, { actorId: user.id, action: "auth.password_changed", entityType: "user", entityId: user.id, ip });
  return { success: "Hasło zostało zmienione. Pozostałe urządzenia zostały wylogowane." };
}
