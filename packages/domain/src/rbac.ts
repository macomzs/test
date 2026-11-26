import { isPermission, type Permission } from "./permissions";

/** Łączy uprawnienia ze wszystkich ról użytkownika (ignoruje nieznane kody). */
export function resolvePermissions(roles: { permissions: string[] }[]): Set<Permission> {
  const result = new Set<Permission>();
  for (const role of roles) {
    for (const p of role.permissions) {
      if (isPermission(p)) result.add(p);
    }
  }
  return result;
}

export function hasPermission(granted: Iterable<Permission>, required: Permission): boolean {
  for (const p of granted) if (p === required) return true;
  return false;
}

export function hasAnyPermission(granted: Iterable<Permission>, required: Permission[]): boolean {
  const set = new Set(granted);
  return required.some((p) => set.has(p));
}

export class PermissionDeniedError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Brak uprawnienia: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}
