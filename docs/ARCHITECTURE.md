# Etap 0 — Architektura i plan MVP

> Wewnętrzny system e-commerce: PIM + wzorce ofert, lokalizacja AI, silnik publikacji z konektorami marketplace, Unified Inbox, RBAC/bezpieczeństwo.
> Status dokumentu: zaakceptowany; Etap 1 zrealizowany (2026-11-26).

---

## 1. Założenia architektoniczne

1. **Modularny monolit + osobny worker** — jeden backend z wyraźnie odseparowanymi modułami domenowymi (łatwy deploy, jedna baza, transakcje), z możliwością wydzielenia modułu do osobnej usługi później.
2. **Architektura heksagonalna (porty i adaptery)** — logika domeny (PIM, wzorce, tłumaczenia, inbox, pre-flight) nie zna żadnego API zewnętrznego. Marketplace'y i dostawcy AI to adaptery implementujące porty.
3. **Konektor = pakiet** — każdy marketplace to osobny pakiet implementujący wspólny interfejs `MarketplaceConnector`. Rdzeń zna tylko rejestr konektorów; dodanie kanału = nowy pakiet + rejestracja.
4. **Wszystko, co dotyka zewnętrznego API, idzie przez kolejkę** — publikacja, pobieranie wiadomości, wysyłka odpowiedzi, tłumaczenia AI. Retry z backoffem, idempotencja, pełne logi request/response.
5. **Transactional outbox** — zdarzenia domenowe (np. `ProductUpdated`, `TranslationApproved`) zapisywane w tej samej transakcji co zmiana, a worker je rozsyła. Fundament pod przyszłe webhooki i synchronizację stanów/cen.
6. **Kontrakty współdzielone** — schematy Zod używane jednocześnie przez frontend (formularze), backend (walidacja) i generowanie OpenAPI.

---

## 2. Stack (zaktualizowany po Etapie 0 – patrz `docs/adr/0001-uproszczony-stack.md`)

Projekt utrzymuje jedna osoba, która nie jest programistą, dlatego stack ograniczono do **dwóch procesów i jednej bazy danych**.

| Warstwa | Technologia | Uzasadnienie |
|---|---|---|
| Język | **TypeScript** (strict) w całym repo | Jeden język, współdzielone typy |
| Monorepo | **pnpm workspaces** | Wyraźne granice pakietów bez dodatkowych narzędzi |
| Panel + API | **Next.js 16** (App Router, Server Actions, route handlers) | Jedna aplikacja zamiast osobnego frontendu i backendu |
| Logika domeny | pakiet `@app/domain` (czysty TypeScript, bez I/O) | Oddzielona od frameworka i integracji, łatwa do testowania |
| Baza danych | **PostgreSQL 16** | Jedyna usługa stanowa |
| ORM / migracje | **Drizzle ORM + drizzle-kit** | Lekki, bez generowania klienta i binarek |
| Kolejka zadań | **pg-boss** (kolejka w PostgreSQL) | Retry, harmonogram (cron), bez Redisa |
| Worker | `apps/worker` (Node + tsx) | Publikacja, synchronizacja inboxu, AI, SLA |
| UI | **Tailwind CSS 4** + własne komponenty w stylu shadcn/ui, ikony lucide | Interfejs tylko po polsku |
| Walidacja | **Zod** | Te same schematy w formularzach i na serwerze |
| Auth | Konta lokalne: argon2id, sesje w bazie (w ciasteczku tylko losowy token), blokada po 5 nieudanych próbach | Prosto i bezpiecznie; SSO można dodać później |
| Szyfrowanie sekretów | **AES-256-GCM** z wersjonowanymi kluczami głównymi, szyfrogram powiązany z ID konta | Rotacja kluczy bez przestojów |
| AI | Port `TranslationProvider` / `LlmProvider` (Etap 4); domyślnie Claude API, wymienny | |
| Pliki (Etap 2) | Magazyn zgodny z S3 (np. Cloudflare R2) | Zdjęcia, PDF-y GPSR |
| Testy | Vitest (domena, kryptografia), Playwright (E2E) | |
| Uruchomienie | Docker Compose (db + migrate + web + worker), CI w GitHub Actions | |

### Hosting – rekomendacja
1. **Zalecane: zarządzana platforma (PaaS) w regionie UE, np. Render (Frankfurt) lub Railway (EU).** Jedna usługa „web”, jedna „background worker” i zarządzany PostgreSQL z automatycznymi kopiami zapasowymi. Wdrożenie następuje automatycznie po każdej zmianie w repozytorium. Nie trzeba administrować serwerem.
2. Alternatywa najtańsza: serwer VPS w UE (np. Hetzner) z panelem Coolify i tym samym `docker-compose`. Taniej, ale aktualizacje, kopie zapasowe i bezpieczeństwo serwera są po naszej stronie.
3. AWS, Azure lub GCP mają sens dopiero przy wymaganiach korporacyjnych.

Dane (w tym wiadomości klientów) pozostają w UE. Decyzję o koncie hostingowym podejmujemy przed pierwszym wdrożeniem (koniec Etapu 2).

---

## 3. Struktura repozytorium

```
.
├── apps/
│   ├── web/                      # Next.js – panel i API (Server Actions)
│   │   └── src/
│   │       ├── app/(panel)/      # katalog, wzorce, tlumaczenia, publikacja, wiadomosci, admin/*
│   │       ├── app/logowanie/
│   │       ├── components/       # komponenty UI
│   │       └── server/           # sesje, RBAC, dostęp do bazy (tylko serwer)
│   └── worker/                   # procesy kolejek + harmonogram + outbox
├── packages/
│   ├── domain/                   # czysta logika: uprawnienia, (dalej) dziedziczenie wariantów,
│   │                             # renderer wzorców, reguły pre-flight, SLA, glossary
│   ├── db/                       # schemat Drizzle, migracje, seed, hasła
│   ├── platform/                 # szyfrowanie, audyt, outbox, kolejka
│   ├── services/                 # przypadki użycia wspólne dla web i worker (np. import feedu)
│   ├── connectors/               # (Etap 5) sdk + mock, allegro, kaufland, mirakl, ...
│   └── ai/                       # (Etap 4) porty LLM/tłumaczeń + adaptery
├── infra/                        # Dockerfile, docker-compose.yml
└── docs/                         # ARCHITECTURE.md, adr/, screenshots/
```

**Reguła zależności:** `domain` nie importuje niczego poza sobą; `connectors/*` i `ai` nie importują `db` ani aplikacji; aplikacje (`web`, `worker`) składają wszystko razem.

---

## 4. Interfejs konektora (szkic)

```ts
export interface MarketplaceConnector {
  readonly code: MarketplaceCode;               // 'allegro' | 'kaufland_de' | 'leroy_fr' | ...
  readonly capabilities: {
    offers: boolean; messages: boolean; disputes: boolean;
    returns: boolean; stock: boolean; prices: boolean;
  };

  // Autoryzacja
  auth: { type: 'oauth2' | 'apiKey'; buildAuthUrl?(); exchangeCode?(); refresh?() };

  // Katalog marketplace
  getCategories(ctx, parentId?): Promise<ExternalCategory[]>;
  getCategoryAttributes(ctx, categoryId): Promise<ExternalAttributeDef[]>;

  // Oferty
  validateOffer(ctx, payload: ChannelOfferPayload): Promise<ValidationIssue[]>;
  publishOffer(ctx, payload): Promise<PublishResult>;   // zwraca externalId lub błędy
  updateOffer(ctx, externalId, payload): Promise<PublishResult>;
  getOfferStatus(ctx, externalId): Promise<ExternalOfferStatus>;

  // Inbox
  fetchThreads?(ctx, since: Date): Promise<ExternalThread[]>;
  sendMessage?(ctx, threadExternalId, body, attachments?): Promise<SendResult>;

  // Przyszłość
  updateStock?(ctx, items): Promise<BatchResult>;
  updatePrices?(ctx, items): Promise<BatchResult>;
}
```

`ctx` zawiera odszyfrowane poświadczenia konta, logger i klienta HTTP z rate-limitem. Rdzeń buduje neutralny `ChannelOfferPayload` (treść w języku rynku + zmapowane atrybuty), konektor tłumaczy go na format konkretnego API.

---

## 5. Schemat bazy danych (kluczowe tabele)

### 5.1 Tożsamość i bezpieczeństwo
Uwaga: w Etapie 1 uprawnienia ról przechowywane są jako tablica kodów w `roles.permissions` (zamiast osobnej tabeli `role_permissions`).

| Tabela | Kluczowe pola |
|---|---|
| `users` | id, email, name, password_hash, is_active, last_login_at |
| `roles` | id, code (`ADMIN`, `ECOMMERCE_SPECIALIST`, `CUSTOMER_SERVICE`), name |
| `role_permissions` | role_id, permission (np. `catalog.write`, `publishing.execute`, `inbox.reply`) |
| `user_roles` | user_id, role_id |
| `sessions` | id, user_id, expires_at, ip, user_agent |
| `audit_logs` | id, actor_id, action, entity_type, entity_id, diff (jsonb), created_at |

### 5.2 Katalog (PIM)

> **Stan po Etapie 2a:** zaimplementowane są `products` (z polem `kind`: SIMPLE/PARENT/VARIANT i `parent_id`), `product_images`, `import_sources`, `import_runs`. Warianty dziedziczą puste pola (marka, ceny, wymiary, waga, materiały) z produktu głównego – logika w `@app/domain` (`resolveInherited`). Import z feedu XML dopasowuje produkty po EAN (feed producenta nie zawiera SKU – SKU uzupełniane ręcznie) i łączy warianty po nazwie („Nazwa (wariant)”). Ręcznie zmieniona nazwa nie jest nadpisywana przez kolejne importy. Pozostałe tabele z tej sekcji – w Etapie 2b.

| Tabela | Kluczowe pola |
|---|---|
| `brands` / `manufacturers` | dane producenta i osoby odpowiedzialnej w UE (GPSR) |
| `categories` | wewnętrzne drzewo kategorii (parent_id) |
| `attribute_definitions` | code, label_pl, type (text/number/bool/enum/dimension), unit, is_translatable, group, enum_options |
| `products` | id, **parent_id** (NULL = produkt bazowy, wartość = wariant), sku, ean, brand_id, category_id, status, length/width/height/weight, base_price, cost_price, currency |
| `product_attribute_values` | product_id, attribute_id, value (jsonb) — wariant dziedziczy brakujące wartości po rodzicu |
| `variant_axes` | product_id (rodzic), attribute_id (np. kolor, rozmiar) |
| `media_assets` | id, storage_key, mime, kind (`IMAGE`, `MANUAL`, `CERTIFICATE`, `SAFETY_INFO`, `DATASHEET`), checksum |
| `product_media` | product_id, asset_id, position, role (main/gallery/document), locale (dla dokumentów w danym języku) |

### 5.3 Wzorce i treści
| Tabela | Kluczowe pola |
|---|---|
| `offer_templates` | id, name, scope (produkt / kategoria), product_id?, category_id? |
| `template_sections` | template_id, type (`TITLE`, `BENEFITS`, `TECHNICAL`, `SET_CONTENTS`, `SAFETY`, `CUSTOM`), position, content (z `{{zmiennymi}}`) |
| `channel_overrides` | product_id, marketplace_id lub channel_account_id, target (section/attribute/price), locale, value |

### 5.3a Stan po Etapie 3
Zaimplementowane: `offer_templates`, `template_sections` (jedna sekcja danego typu na wzorzec), `products.template_id` (wariant bez wzorca używa wzorca produktu głównego), `channel_overrides` (produkt × marketplace × sekcja, treść PL ze zmiennymi). Renderowanie zmiennych i limity tytułów są w `@app/domain/content`; brak danych produktu zostawia w tekście znacznik `[brak: zmienna]`, który trafia do ostrzeżeń.

### 5.4 Lokalizacja
| Tabela | Kluczowe pola |
|---|---|
| `locales` | code (`pl`, `en`, `de`, `fr`, `cs`, `nl`, …), is_active |
| `translations` | entity_type (section/override/attribute), entity_id, locale, content, **status** (`AI_DRAFT`, `PENDING_REVIEW`, `APPROVED`), **source_hash** (wykrywa nieaktualne tłumaczenie po zmianie PL), provider, reviewed_by, reviewed_at |
| `glossary_terms` | source_term, locale, target_term, rule (`DO_NOT_TRANSLATE`, `FORCE`, `FORBIDDEN`), case_sensitive, note |

> **Stan po Etapie 4 (zmiana względem projektu):** tłumaczenie to jeden wiersz na produkt × język × zakres (`scope` = `base` albo kod marketplace z nadpisaniami), a sekcje są w kolumnie JSONB (`{TYPE: {source, text}}`). Status (`AI_DRAFT` → `PENDING_REVIEW` → `APPROVED`) dotyczy całej oferty w danym języku, bo tak jest akceptowana. `source_hash` porównywany z aktualną treścią PL wykrywa tłumaczenia nieaktualne, a zatwierdzenie nieaktualnego tłumaczenia jest zablokowane. Stan zadania AI (`job_state`: QUEUED/RUNNING/FAILED/DONE) jest niezależny od statusu akceptacji. Dostawca AI to port `TranslationProvider` (`@app/services/content/providers.ts`): `ClaudeTranslationProvider` (Claude API, structured outputs, automatyczny model zapasowy przy odmowie) oraz `MockTranslationProvider` (tryb testowy). Klucz API trafia do `app_settings` w postaci zaszyfrowanej. Po tłumaczeniu działa kontrola jakości: słownik, znaczniki braków, limit tytułu, liczba punktów.

### 5.5 Kanały i publikacja
| Tabela | Kluczowe pola |
|---|---|
| `marketplaces` | code, name, country, default_locale, currency, connector_key |
| `channel_accounts` | marketplace_id, name, status, **credentials_encrypted** (bytea), key_version, token_expires_at |
| `category_mappings` | marketplace_id, internal_category_id, external_category_id, external_path |
| `attribute_mappings` | marketplace_id, external_category_id, external_attribute_id, is_required, source (`ATTRIBUTE`/`CONSTANT`/`TEMPLATE_SECTION`), attribute_id?, constant?, transform (jsonb, np. mapowanie wartości enum, konwersja jednostek) |
| `listings` | product_id, channel_account_id, external_id, status, last_published_at, last_payload_hash |
| `publication_jobs` | id, listing_id, type (`CREATE`, `UPDATE`, `DEACTIVATE`), status (`PENDING`, `SENT`, `API_ERROR`, `SUCCESS`), payload_snapshot (jsonb), attempts, created_by |
| `publication_job_logs` | job_id, level, message, request (jsonb), response (jsonb), external_error_code, created_at |
| `preflight_results` | product_id, channel_account_id, issues (jsonb), checked_at |

### 5.6 Inbox
| Tabela | Kluczowe pola |
|---|---|
| `threads` | channel_account_id, external_id, type (`MESSAGE`, `QUESTION`, `COMPLAINT`, `RETURN`, `INCIDENT`), status (`NEW`, `OPEN`, `WAITING_CUSTOMER`, `RESOLVED`, `CLOSED`), priority, customer_name, customer_locale, order_number, assignee_id, **sla_due_at**, first_response_at, last_message_at |
| `thread_products` | thread_id, product_id?, sku, ean |
| `messages` | thread_id, direction (`INBOUND`, `OUTBOUND`, `INTERNAL_NOTE`), author_id?, body_original, original_locale, body_pl (tłumaczenie), delivery_status, external_id, sent_at |
| `message_attachments` | message_id, asset_id |
| `reply_drafts` | thread_id, body_pl, body_customer_locale, generated_by (AI/user), status |
| `sla_policies` | marketplace_id?, thread_type, priority, response_minutes, business_hours (jsonb) |

### 5.7 Infrastruktura / przyszłość
| Tabela | Cel |
|---|---|
| `outbox_events` | zdarzenia domenowe do rozesłania (webhooki, synchronizacje) |
| `sync_cursors` | ostatni punkt synchronizacji per konto i zasób (np. wiadomości) |
| `stock_levels`, `price_lists` (etap późniejszy) | stany magazynowe i cenniki per kanał |
| `api_keys`, `webhook_subscriptions` (etap późniejszy) | własne API dla ERP/WMS |

**Relacje w skrócie:** `products 1─N products` (warianty) · `products 1─N product_attribute_values N─1 attribute_definitions` · `products 1─N listings N─1 channel_accounts N─1 marketplaces` · `listings 1─N publication_jobs 1─N publication_job_logs` · `template_sections 1─N translations` · `channel_accounts 1─N threads 1─N messages`.

---

## 6. Kluczowe przepływy

**Publikacja:** użytkownik wybiera produkty × konta → **pre-flight** (pakiet `domain`: wymagane atrybuty z `attribute_mappings`, zdjęcia, dokumenty GPSR, zatwierdzone tłumaczenia dla języka rynku, cena, mapowanie kategorii) → jeśli OK, tworzony `publication_job` (`PENDING`) → worker buduje `ChannelOfferPayload` (wzorzec → render zmiennych → overrides → tłumaczenie) → `connector.publishOffer()` → `SUCCESS` / `API_ERROR` z czytelnym logiem.

**Tłumaczenie:** zmiana treści PL → nowy `source_hash` → tłumaczenia oznaczone jako nieaktualne → job AI z glossary (maskowanie terminów chronionych przed wysłaniem do modelu, wymuszone tłumaczenia w promptcie, walidacja po odpowiedzi) → `AI_DRAFT` → recenzja w edytorze porównawczym → `APPROVED`.

**Inbox:** cron per konto → `connector.fetchThreads(since)` → upsert wątków/wiadomości → tłumaczenie na PL → wyliczenie `sla_due_at` → przypisanie → sugestia odpowiedzi AI (PL + język klienta) → akceptacja → job `sendMessage`.

---

## 7. Plan etapów

| Etap | Zakres | Rezultat |
|---|---|---|
| **0** | Architektura, stack, schemat, plan (ten dokument) | Zaakceptowane decyzje |
| **1 – Fundament** | Monorepo, Docker Compose, Prisma + migracje + seed, NestJS API, worker, logowanie, RBAC, audit log, szyfrowanie sekretów, layout panelu (nawigacja, tabele, formularze), CI (lint, typecheck, test) | Działający szkielet z logowaniem i rolami |
| **2 – PIM** | Produkty, warianty z dziedziczeniem, definicje atrybutów, upload zdjęć i dokumentów (GPSR), import CSV | Katalog w pełni edytowalny |
| **3 – Wzorce i overrides** | Sekcje wzorców, zmienne, podgląd renderowania, nadpisania per kanał | Podgląd gotowej oferty per kanał |
| **4 – Lokalizacja AI** | Glossary, joby tłumaczeń, workflow statusów, edytor porównawczy, wykrywanie nieaktualnych tłumaczeń | Treści w EN/DE/FR/CS/NL |
| **5 – Publikacja (mock)** | SDK konektorów, konektory mock: Allegro, Kaufland DE, Leroy FR; mapowanie kategorii i atrybutów, pre-flight, kolejka, statusy, logi błędów | Pełny przepływ publikacji na symulowanych API |
| **6 – Inbox (mock)** | Unified Inbox, badge marketplace, tłumaczenia wiadomości, sugestie odpowiedzi, SLA, przypisania, notatki | **MVP gotowe (etapy 1–6)** |
| 7 | Allegro – realna integracja (OAuth, oferty, wiadomości, dyskusje/zwroty) | Pierwszy produkcyjny kanał |
| 8 | Kaufland DE, Erli – realne API | |
| 9 | Mirakl (Leroy Merlin FR i inne platformy Mirakl), OBI DE, rynki CZ/NL | |
| 10 | Synchronizacja stanów i cen, własne API + webhooki, importy z ERP | |
| 11 | Hardening: SSO, monitoring, backupy, testy obciążeniowe, rotacja kluczy | |

Każdy etap kończy się: działającym kodem na branchu, migracjami, testami, krótkim README „jak uruchomić / przetestować”.
