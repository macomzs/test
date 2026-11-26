import "server-only";
import { roles, sessions, userRoles, users } from "@app/db";
import { hasPermission, resolvePermissions, type Permission } from "@app/domain";
import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { getDb } from "./db";
import { getRequestMeta } from "./request";

export const SESSION_COOKIE = "eh_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 godzin

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  roles: { code: string; name: string }[];
  permissions: Set<Permission>;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const meta = await getRequestMeta();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const db = getDb();
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt, ip: meta.ip, userAgent: meta.userAgent });
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date())); // sprzątanie wygasłych sesji

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.SESSION_COOKIE_SECURE !== "false",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

/** Zwraca zalogowanego użytkownika (lub null). Wynik jest zapamiętany w obrębie jednego żądania. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date()), eq(users.isActive, true)));
  if (!row) return null;

  const userRoleRows = await db
    .select({ code: roles.code, name: roles.name, permissions: roles.permissions })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, row.id));

  return {
    ...row,
    roles: userRoleRows.map(({ code, name }) => ({ code, name })),
    permissions: resolvePermissions(userRoleRows),
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/logowanie");
  return user;
}

/** Używaj na początku każdej strony i akcji serwerowej chronionej uprawnieniem. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user.permissions, permission)) redirect(`/brak-dostepu?wymagane=${encodeURIComponent(permission)}`);
  return user;
}

/** Usuwa wszystkie sesje wskazanych użytkowników (np. po dezaktywacji konta lub zmianie hasła). */
export async function revokeSessions(userIds: string[]): Promise<void> {
  if (userIds.length) await getDb().delete(sessions).where(inArray(sessions.userId, userIds));
}
