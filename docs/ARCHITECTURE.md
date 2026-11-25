# Etap 0 — Architektura i plan MVP

> Wewnętrzny system e-commerce: PIM + wzorce ofert, lokalizacja AI, silnik publikacji z konektorami marketplace, Unified Inbox, RBAC/bezpieczeństwo.
> Status dokumentu: **propozycja do akceptacji** (2026-11-25).

---

## 1. Założenia architektoniczne

1. **Modularny monolit + osobny worker** — jeden backend z wyraźnie odseparowanymi modułami domenowymi (łatwy deploy, jedna baza, transakcje), z możliwością wydzielenia modułu do osobnej usługi później.
2. **Architektura heksagonalna (porty i adaptery)** — logika domeny (PIM, wzorce, tłumaczenia, inbox, pre-flight) nie zna żadnego API zewnętrznego. Marketplace'y i dostawcy AI to adaptery implementujące porty.
3. **Konektor = pakiet** — każdy marketplace to osobny pakiet implementujący wspólny interfejs `MarketplaceConnector`. Rdzeń zna tylko rejestr konektorów; dodanie kanału = nowy pakiet + rejestracja.
4. **Wszystko, co dotyka zewnętrznego API, idzie przez kolejkę** — publikacja, pobieranie wiadomości, wysyłka odpowiedzi, tłumaczenia AI. Retry z backoffem, idempotencja, pełne logi request/response.
5. **Transactional outbox** — zdarzenia domenowe (np. `ProductUpdated`, `TranslationApproved`) zapisywane w tej samej transakcji co zmiana, a worker je rozsyła. Fundament pod przyszłe webhooki i synchronizację stanów/cen.
6. **Kontrakty współdzielone** — schematy Zod używane jednocześnie przez frontend (formularze), backend (walidacja) i generowanie OpenAPI.

---

## 2. Rekomendowany stack

| Warstwa | Technologia | Uzasadnienie |
|---|---|---|
| Język | **TypeScript** (strict) w całym repo | Jeden język, współdzielone typy front/back |
| Monorepo | **pnpm workspaces + Turborepo** | Szybkie buildy, cache, wyraźne granice pakietów |
| Backend API | **NestJS** (adapter Fastify) | Moduły, DI, guardy (RBAC), dojrzała dokumentacja, naturalny podział na moduły domenowe |
| Walidacja / kontrakty | **Zod** + `nestjs-zod` → OpenAPI | Jedno źródło prawdy dla DTO |
| Baza danych | **PostgreSQL 16** | JSONB na atrybuty, pełnotekstowe wyszukiwanie, niezawodność |
| ORM / migracje | **Prisma** | Czytelny schemat, migracje, typy generowane automatycznie |
| Kolejki | **BullMQ + Redis** | Retry, backoff, priorytety, rate-limit per konto marketplace, dashboard |
| Worker | NestJS standalone app (ten sam kod modułów) | Publikacja, synchronizacja inboxu, AI, cron (SLA) |
| Frontend | **React + Vite + TanStack Router + TanStack Query** | SPA dla narzędzia wewnętrznego — prostsze niż SSR, szybkie |
| UI | **shadcn/ui + Tailwind CSS**, TanStack Table, React Hook Form | Gęste tabele, formularze, edytor porównawczy |
| Edytor treści | **TipTap** (ograniczony HTML) | Sekcje opisów, zmienne `{{atrybut}}` |
| Pliki | **S3-compatible** (MinIO lokalnie; S3/R2/Azure Blob na produkcji) | Zdjęcia, PDF-y GPSR, certyfikaty |
| AI | Port `TranslationProvider` / `LlmProvider`; domyślnie **Claude API**, opcjonalnie DeepL | Wymienny dostawca, glossary egzekwowany po naszej stronie |
| Auth | Sesje (cookie httpOnly) + argon2; opcjonalnie SSO (OIDC: Microsoft/Google) | Prosty i bezpieczny model dla internal tool |
| Szyfrowanie sekretów | **AES-256-GCM, envelope encryption** (klucz główny z env/KMS) | Tokeny OAuth i klucze API zaszyfrowane w bazie, rotacja kluczy |
| Testy | Vitest, Supertest, Playwright (E2E) | |
| Observability | pino (logi JSON), OpenTelemetry, Sentry | |
| Lokalnie / deploy | Docker Compose (Postgres, Redis, MinIO, Mailpit), obrazy Docker | Gotowe pod VPS, k8s lub chmurę |

---

## 3. Struktura repozytorium

```
.
├── apps/
│   ├── web/                      # React SPA (panel)
│   │   └── src/
│   │       ├── routes/           # catalog, templates, translations, publishing, inbox, admin
│   │       ├── features/         # komponenty per moduł
│   │       ├── components/ui/    # shadcn/ui
│   │       └── lib/              # api client, auth, i18n
│   ├── api/                      # NestJS – HTTP API
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── identity/     # użytkownicy, role, sesje, RBAC
│   │       │   ├── audit/
│   │       │   ├── catalog/      # produkty, warianty, atrybuty, media
│   │       │   ├── templates/    # wzorce ofert, overrides
│   │       │   ├── localization/ # tłumaczenia, glossary, workflow
│   │       │   ├── channels/     # marketplace'y, konta, poświadczenia
│   │       │   ├── publishing/   # mapowania, pre-flight, joby
│   │       │   └── inbox/        # wątki, wiadomości, SLA
│   │       └── infrastructure/   # prisma, queue, storage, crypto, outbox
│   └── worker/                   # NestJS standalone – procesory kolejek + cron
├── packages/
│   ├── contracts/                # Zod schemas, DTO, enumy, kody uprawnień
│   ├── domain/                   # czysta logika (bez I/O): dziedziczenie wariantów,
│   │                             # renderer wzorców, reguły pre-flight, SLA, glossary
│   ├── db/                       # schema.prisma, migracje, seed
│   ├── connectors/
│   │   ├── sdk/                  # interfejs MarketplaceConnector, typy, błędy, testkit
│   │   ├── mock/                 # konfigurowalny fake (opóźnienia, losowe błędy)
│   │   ├── allegro/
│   │   ├── kaufland/
│   │   ├── mirakl/               # baza dla marketplace'ów na Mirakl (np. Leroy Merlin)
│   │   └── leroy-merlin-fr/
│   ├── ai/                       # porty LLM/tłumaczeń + adaptery (Claude, DeepL, fake)
│   └── config/                   # tsconfig, eslint, prettier
├── infra/
│   ├── docker-compose.yml
│   └── docker/                   # Dockerfile api/worker/web
├── docs/
│   ├── ARCHITECTURE.md
│   └── adr/                      # Architecture Decision Records
└── turbo.json / pnpm-workspace.yaml
```

**Reguła zależności** (pilnowana przez ESLint `boundaries`):
`domain` ← `api/worker modules` → `connectors/*`, `ai` (przez porty z `connectors/sdk`).
`domain` nie importuje niczego z infrastruktury; `connectors/*` nie importują `db` ani modułów API.

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
| Tabela | Kluczowe pola |
|---|---|
| `users` | id, email, name, password_hash, is_active, last_login_at |
| `roles` | id, code (`ADMIN`, `ECOMMERCE_SPECIALIST`, `CUSTOMER_SERVICE`), name |
| `role_permissions` | role_id, permission (np. `catalog.write`, `publishing.execute`, `inbox.reply`) |
| `user_roles` | user_id, role_id |
| `sessions` | id, user_id, expires_at, ip, user_agent |
| `audit_logs` | id, actor_id, action, entity_type, entity_id, diff (jsonb), created_at |

### 5.2 Katalog (PIM)
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

### 5.4 Lokalizacja
| Tabela | Kluczowe pola |
|---|---|
| `locales` | code (`pl`, `en`, `de`, `fr`, `cs`, `nl`, …), is_active |
| `translations` | entity_type (section/override/attribute), entity_id, locale, content, **status** (`AI_DRAFT`, `PENDING_REVIEW`, `APPROVED`), **source_hash** (wykrywa nieaktualne tłumaczenie po zmianie PL), provider, reviewed_by, reviewed_at |
| `glossary_terms` | source_term, locale, target_term, rule (`DO_NOT_TRANSLATE`, `FORCE`, `FORBIDDEN`), case_sensitive, note |

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
