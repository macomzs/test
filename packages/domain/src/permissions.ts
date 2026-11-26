/**
 * Katalog uprawnień systemu. Kod uprawnienia = "<moduł>.<akcja>".
 * Dodając nowy moduł, dopisz tu jego uprawnienia i przypisz je do ról domyślnych.
 */
export const PERMISSIONS = {
  "catalog.read": "Katalog – podgląd",
  "catalog.write": "Katalog – edycja produktów",
  "templates.read": "Wzorce ofert – podgląd",
  "templates.write": "Wzorce ofert – edycja",
  "translations.read": "Tłumaczenia – podgląd",
  "translations.write": "Tłumaczenia – edycja",
  "translations.approve": "Tłumaczenia – zatwierdzanie",
  "publishing.read": "Publikacja – podgląd",
  "publishing.execute": "Publikacja – wysyłka ofert",
  "inbox.read": "Wiadomości – podgląd",
  "inbox.reply": "Wiadomości – odpowiadanie",
  "inbox.assign": "Wiadomości – przypisywanie zgłoszeń",
  "channels.manage": "Kanały – konta marketplace i klucze API",
  "users.manage": "Użytkownicy i role",
  "audit.read": "Logi audytowe",
  "system.manage": "System – zadania w tle",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return value in PERMISSIONS;
}

export type RoleCode = "ADMIN" | "ECOMMERCE_SPECIALIST" | "CUSTOMER_SERVICE";

export const DEFAULT_ROLES: Record<
  RoleCode,
  { name: string; description: string; permissions: Permission[] }
> = {
  ADMIN: {
    name: "Administrator",
    description: "Pełny dostęp do systemu.",
    permissions: ALL_PERMISSIONS,
  },
  ECOMMERCE_SPECIALIST: {
    name: "Specjalista E-commerce",
    description: "Katalog, wzorce ofert, tłumaczenia i publikacja.",
    permissions: [
      "catalog.read",
      "catalog.write",
      "templates.read",
      "templates.write",
      "translations.read",
      "translations.write",
      "translations.approve",
      "publishing.read",
      "publishing.execute",
      "inbox.read",
    ],
  },
  CUSTOMER_SERVICE: {
    name: "Obsługa Klienta",
    description: "Reklamacje, zwroty i wiadomości od klientów.",
    permissions: ["inbox.read", "inbox.reply", "inbox.assign", "catalog.read"],
  },
};
