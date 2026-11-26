import { DEFAULT_ROLES, type RoleCode } from "@app/domain";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "./client";
import { hashPassword } from "./passwords";
import { languages, marketplaces, roles, userRoles, users } from "./schema";

/** Dane startowe – skrypt można uruchamiać wielokrotnie (nie tworzy duplikatów). */
const MARKETPLACES = [
  { code: "allegro_pl", name: "Allegro", country: "PL", defaultLocale: "pl", currency: "PLN", connectorKey: "allegro", badgeColor: "#ff5a00" },
  { code: "allegro_cz", name: "Allegro CZ", country: "CZ", defaultLocale: "cs", currency: "CZK", connectorKey: "allegro", badgeColor: "#ff5a00" },
  { code: "erli_pl", name: "Erli", country: "PL", defaultLocale: "pl", currency: "PLN", connectorKey: "erli", badgeColor: "#7c3aed" },
  { code: "kaufland_de", name: "Kaufland DE", country: "DE", defaultLocale: "de", currency: "EUR", connectorKey: "kaufland", badgeColor: "#e10915" },
  { code: "obi_de", name: "OBI DE", country: "DE", defaultLocale: "de", currency: "EUR", connectorKey: "obi", badgeColor: "#f39200" },
  { code: "leroy_merlin_fr", name: "Leroy Merlin FR", country: "FR", defaultLocale: "fr", currency: "EUR", connectorKey: "mirakl", badgeColor: "#78be20" },
];

const LANGUAGES = [
  { code: "pl", name: "Polski", isSource: true, position: 0 },
  { code: "en", name: "Angielski", isSource: false, position: 1 },
  { code: "de", name: "Niemiecki", isSource: false, position: 2 },
  { code: "fr", name: "Francuski", isSource: false, position: 3 },
  { code: "cs", name: "Czeski", isSource: false, position: 4 },
  { code: "nl", name: "Niderlandzki", isSource: false, position: 5 },
];

const db = getDb();

for (const l of LANGUAGES) {
  await db.insert(languages).values(l).onConflictDoNothing();
}
console.log(`✔ Języki (${LANGUAGES.length})`);

for (const [code, def] of Object.entries(DEFAULT_ROLES) as [RoleCode, (typeof DEFAULT_ROLES)[RoleCode]][]) {
  await db
    .insert(roles)
    .values({ code, name: def.name, description: def.description, permissions: def.permissions, isSystem: true })
    .onConflictDoUpdate({
      target: roles.code,
      set: { name: def.name, description: def.description, permissions: def.permissions },
    });
}
console.log("✔ Role systemowe");

for (const m of MARKETPLACES) {
  await db.insert(marketplaces).values(m).onConflictDoUpdate({ target: marketplaces.code, set: m });
}
console.log(`✔ Marketplace'y (${MARKETPLACES.length})`);

const [{ count }] = (await db.select({ count: sql<number>`count(*)::int` }).from(users)) as [{ count: number }];
if (count === 0) {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@firma.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
  const [admin] = await db
    .insert(users)
    .values({ email, name: "Administrator", passwordHash: await hashPassword(password) })
    .returning();
  const [adminRole] = await db.select().from(roles).where(eq(roles.code, "ADMIN"));
  await db.insert(userRoles).values({ userId: admin!.id, roleId: adminRole!.id });
  console.log(`✔ Utworzono konto administratora: ${email}`);
  if (!process.env.SEED_ADMIN_PASSWORD) console.log(`  Hasło tymczasowe: ${password}`);
  console.log("  Zmień hasło po pierwszym logowaniu (Moje konto).");
} else {
  console.log("✔ Użytkownicy już istnieją – pomijam tworzenie administratora");
}

await closeDb();
