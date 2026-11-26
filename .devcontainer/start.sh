#!/usr/bin/env bash
# Uruchamia panel (port 3000) i worker NA PIERWSZYM PLANIE w tym terminalu.
# Aplikacja działa, dopóki ten terminal jest otwarty. Zatrzymanie: Ctrl+C.
# Użycie:  bash .devcontainer/start.sh
cd "$(dirname "$0")/.."

if [ ! -d node_modules ] || [ ! -f /tmp/.ecommerce-hub-ready ]; then
  bash .devcontainer/setup.sh || { echo "✘ Instalacja nie powiodła się – zobacz /tmp/setup.log"; exit 1; }
fi

# Zatrzymaj wcześniej uruchomione kopie i poczekaj, aż port 3000 się zwolni.
pkill -f "next dev" >/dev/null 2>&1 || true
pkill -f "tsx watch" >/dev/null 2>&1 || true
for i in $(seq 1 15); do
  (echo > /dev/tcp/127.0.0.1/3000) 2>/dev/null || break
  sleep 1
done
pkill -9 -f "next dev" >/dev/null 2>&1 || true

echo
echo "  ▶ E-commerce Hub uruchamia się…"
echo "  ▶ Gdy zobaczysz „Ready”: zakładka PORTY → port 3000 → ikona globusa"
echo "  ▶ Login: admin@firma.local   Hasło: ZmienToHaslo123!"
echo "  ▶ NIE ZAMYKAJ tego terminala – aplikacja działa, dopóki jest otwarty (zatrzymanie: Ctrl+C)"
echo
pnpm dev 2>&1 | tee /tmp/app.log
