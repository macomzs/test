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
  "catalog.import.completed": "Import produktów",
  "catalog.product.updated": "Zmiana produktu",
  "template.created": "Utworzenie wzorca oferty",
  "template.updated": "Zmiana wzorca oferty",
  "template.deleted": "Usunięcie wzorca oferty",
  "product.template_assigned": "Przypisanie wzorca do produktu",
  "channel_override.updated": "Zmiana nadpisań dla kanału",
  "translation.queued": "Zlecenie tłumaczenia AI",
  "translation.ai_completed": "Tłumaczenie AI gotowe",
  "translation.edited": "Edycja tłumaczenia",
  "translation.status_changed": "Zmiana statusu tłumaczenia",
  "glossary.created": "Dodanie terminu do słownika",
  "glossary.deleted": "Usunięcie terminu ze słownika",
  "settings.ai_updated": "Zmiana ustawień AI",
  "system.ping.requested": "Zlecenie zadania testowego",
  "system.ping.processed": "Wykonanie zadania testowego",
};

export function auditLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
