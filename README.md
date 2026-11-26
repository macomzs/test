# E-commerce Hub

Wewnętrzny system działu e-commerce: katalog produktów (PIM), wzorce ofert, tłumaczenia AI, publikacja na marketplace'ach (Allegro, Erli, Kaufland DE, OBI DE, Leroy Merlin FR, …) oraz wspólna skrzynka reklamacji i wiadomości.

Architektura, schemat bazy i plan etapów: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stan prac
| Etap | Zakres | Status |
|---|---|---|
| 0 | Architektura i plan | ✅ |
| 1 | Fundament: logowanie, role (RBAC), log audytowy, szyfrowanie kluczy API, kolejka zadań, układ panelu | ✅ |
| 2 | Katalog produktów (PIM) | ⏳ następny |
| 3–6 | Wzorce, tłumaczenia AI, publikacja (konektory symulowane), skrzynka wiadomości | planowane |

## Uruchomienie – sposób 0: w przeglądarce, bez instalacji (GitHub Codespaces)
1. Na stronie repozytorium kliknij zielony przycisk **Code** → zakładka **Codespaces** → **Create codespace on** (wybierz branch z najnowszym etapem).
2. Poczekaj kilka minut na pierwsze uruchomienie: instalują się zależności, tworzy się baza i konto administratora.
3. W terminalu (na dole) wpisz `bash .devcontainer/start.sh` i poczekaj na napis „Ready”.
4. Otwórz zakładkę **Porty** i kliknij ikonę globusa przy porcie 3000.
5. Zaloguj się: `admin@firma.local` / `ZmienToHaslo123!`.

Aplikacja działa, dopóki terminal z poleceniem `bash .devcontainer/start.sh` jest otwarty. Po wznowieniu uśpionego codespace'a wpisz to polecenie ponownie.

Codespace zatrzymuje się sam po okresie bezczynności, a dane w bazie zostają. Konta osobiste GitHub mają miesięczny darmowy limit godzin. Po skończonych testach usuń codespace na https://github.com/codespaces.

## Uruchomienie – sposób 1: Docker
Wymagany [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
cp .env.example .env        # na produkcji: zmień klucz szyfrujący i hasło administratora
docker compose -f infra/docker-compose.yml --env-file .env up -d --build
```
Otwórz http://localhost:3000 i zaloguj się danymi z `.env` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

## Uruchomienie – sposób 2: tryb deweloperski
Wymagane: Node.js 22+, pnpm 10+, PostgreSQL 16.

```bash
pnpm install
cp .env.example .env       # ustaw DATABASE_URL
pnpm db:setup              # migracje + dane startowe (role, marketplace'y, administrator)
pnpm dev                   # panel na http://localhost:3000 + worker
```

## Przydatne polecenia
| Polecenie | Co robi |
|---|---|
| `pnpm test` | testy jednostkowe (uprawnienia, szyfrowanie) |
| `pnpm typecheck` | kontrola typów w całym repozytorium |
| `pnpm db:generate` | tworzy migrację po zmianie schematu w `packages/db/src/schema` |
| `pnpm keys:generate` | generuje nowy klucz szyfrujący (do `APP_ENCRYPTION_KEYS`) |

## Bezpieczeństwo – najważniejsze zasady
- **Klucz szyfrujący** (`APP_ENCRYPTION_KEYS`) przechowuj poza repozytorium. Jego utrata oznacza utratę zapisanych kluczy API marketplace'ów. Rotacja: dopisz `2:nowy_klucz` i ustaw `APP_ENCRYPTION_ACTIVE_KEY=2`; stare dane dalej będą czytelne.
- Po pierwszym logowaniu zmień hasło administratora (Moje konto).
- Plik `.env` nie trafia do repozytorium (jest w `.gitignore`).
