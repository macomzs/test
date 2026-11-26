import type { Permission } from "./permissions";

/** Moduły aplikacji widoczne w nawigacji wraz z etapem, w którym powstają. */
export const APP_MODULES: {
  key: string;
  label: string;
  href: string;
  permission: Permission;
  stage: number;
  /** Czy moduł jest już dostępny (false = zapowiedź kolejnego etapu). */
  ready: boolean;
  description: string;
}[] = [
  { key: "catalog", label: "Katalog produktów", href: "/katalog", permission: "catalog.read", stage: 2, ready: true, description: "Produkty główne, warianty, atrybuty, zdjęcia i dokumenty (GPSR)." },
  { key: "templates", label: "Wzorce ofert", href: "/wzorce", permission: "templates.read", stage: 3, ready: false, description: "Sekcje ofert w języku polskim, zmienne z atrybutów i nadpisania per kanał." },
  { key: "translations", label: "Tłumaczenia", href: "/tlumaczenia", permission: "translations.read", stage: 4, ready: false, description: "Tłumaczenia AI, słownik terminów i akceptacja tłumaczeń." },
  { key: "publishing", label: "Publikacja", href: "/publikacja", permission: "publishing.read", stage: 5, ready: false, description: "Mapowania kategorii i atrybutów, walidacja i kolejka publikacji." },
  { key: "inbox", label: "Wiadomości i reklamacje", href: "/wiadomosci", permission: "inbox.read", stage: 6, ready: false, description: "Wspólna skrzynka ze wszystkich marketplace, SLA i podpowiedzi odpowiedzi." },
];
