import { describe, expect, it } from "vitest";
import { DEFAULT_ROLES, ALL_PERMISSIONS } from "./permissions";
import { hasAnyPermission, hasPermission, resolvePermissions } from "./rbac";

describe("RBAC", () => {
  it("łączy uprawnienia z wielu ról i pomija nieznane kody", () => {
    const perms = resolvePermissions([
      { permissions: ["inbox.read", "nieistniejace.uprawnienie"] },
      { permissions: ["catalog.read", "inbox.read"] },
    ]);
    expect([...perms].sort()).toEqual(["catalog.read", "inbox.read"]);
  });

  it("administrator ma wszystkie uprawnienia", () => {
    const perms = resolvePermissions([DEFAULT_ROLES.ADMIN]);
    expect(perms.size).toBe(ALL_PERMISSIONS.length);
  });

  it("obsługa klienta nie może publikować ofert ani zarządzać kluczami API", () => {
    const perms = resolvePermissions([DEFAULT_ROLES.CUSTOMER_SERVICE]);
    expect(hasPermission(perms, "inbox.reply")).toBe(true);
    expect(hasPermission(perms, "publishing.execute")).toBe(false);
    expect(hasPermission(perms, "channels.manage")).toBe(false);
  });

  it("specjalista e-commerce nie zarządza użytkownikami", () => {
    const perms = resolvePermissions([DEFAULT_ROLES.ECOMMERCE_SPECIALIST]);
    expect(hasAnyPermission(perms, ["users.manage", "audit.read"])).toBe(false);
    expect(hasPermission(perms, "translations.approve")).toBe(true);
  });
});
