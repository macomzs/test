#!/usr/bin/env bash
# Buduje i uruchamia panel (port 3000) oraz worker NA PIERWSZYM PLANIE w tym terminalu.
# Tryb produkcyjny – szybszy i stabilniejszy niż tryb deweloperski (bez przeładowań strony).
# Aplikacja działa, dopóki ten terminal jest otwarty. Zatrzymanie: Ctrl+C.
# Użycie:  bash .devcontainer/start.sh
cd "$(dirname "$0")/.."

if [ ! -d node_modules ] || [ ! -f /tmp/.ecommerce-hub-ready ]; then
  bash .devcontainer/setup.sh || { echo "✘ Instalacja nie powiodła się – zobacz /tmp/setup.log"; exit 1; }
fi

# Zatrzymaj wcześniej uruchomione kopie i poczekaj, aż port 3000 się zwolni.
pkill -f "next dev" >/dev/null 2>&1 || true
pkill -f "next start" >/dev/null 2>&1 || true
pkill -f "next-server" >/dev/null 2>&1 || true
pkill -f "tsx" >/dev/null 2>&1 || true
for i in $(seq 1 15); do
  (echo > /dev/tcp/127.0.0.1/3000) 2>/dev/null || break
  sleep 1
done
pkill -9 -f "next-server" >/dev/null 2>&1 || true

# Po „git pull”: nowe zależności, migracje bazy i budowa aplikacji.
pnpm install --frozen-lockfile > /tmp/install.log 2>&1 || { echo "✘ Instalacja zależności nie powiodła się"; tail -n 20 /tmp/install.log; exit 1; }
pnpm db:migrate || { echo "✘ Migracja bazy nie powiodła się"; exit 1; }
echo "▶ Budowanie aplikacji (ok. 1 minuty)…"
pnpm build > /tmp/build.log 2>&1 || { echo "✘ Budowanie nie powiodło się. Ostatnie linie:"; tail -n 30 /tmp/build.log; exit 1; }
echo "✔ Zbudowano"

echo
echo "  ▶ E-commerce Hub uruchamia się…"
echo "  ▶ Gdy zobaczysz „Ready”: zakładka PORTY → port 3000 → ikona globusa"
echo "  ▶ Login: admin@firma.local   Hasło: ZmienToHaslo123!"
echo "  ▶ NIE ZAMYKAJ tego terminala – aplikacja działa, dopóki jest otwarty (zatrzymanie: Ctrl+C)"
echo
pnpm start 2>&1 | tee /tmp/app.log
