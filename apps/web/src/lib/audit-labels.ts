/** Czytelne nazwy akcji z logu audytowego. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.login": "Logowanie",
  "auth.logout": "Wylogowanie",
  "auth.login.failed": "Nieudane logowanie",
  "auth.password_changed": "Zmiana własnego hasła",
  "user.created": "Utworzenie użytkownika",
  "user.updated": "Zmiana użytkownika",
  "user.password_reset": "Ustawienie hasła przez administratora",
  "channel_account.created": "Dodanie konta marketplace",
  "channel_account.updated": "Zmiana konta marketplace",
  "system.ping.requested": "Zlecenie zadania testowego",
  "system.ping.processed": "Wykonanie zadania testowego",
};

export function auditLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
