#!/usr/bin/env bash
# Jednorazowa instalacja przy tworzeniu Codespace. Log: /tmp/setup.log
set -euo pipefail
exec > >(tee -a /tmp/setup.log) 2>&1
cd "$(dirname "$0")/.."
echo "▶ Instalacja E-commerce Hub ($(date))"
echo "  Node: $(node -v)"

# Dokładnie ta wersja pnpm, której używa projekt (niezależnie od tego, co jest w obrazie).
PNPM_VERSION=10.28.0
if [ "$(pnpm -v 2>/dev/null || true)" != "$PNPM_VERSION" ]; then
  echo "▶ Instaluję pnpm $PNPM_VERSION"
  sudo npm install -g "pnpm@$PNPM_VERSION" --no-fund --no-audit
fi
echo "  pnpm: $(pnpm -v)"

[ -f .env ] || cp .env.example .env
pnpm install --frozen-lockfile

echo "▶ Czekam na bazę danych…"
for i in $(seq 1 60); do
  (echo > /dev/tcp/127.0.0.1/5432) 2>/dev/null && break
  sleep 2
done
pnpm db:setup
touch /tmp/.ecommerce-hub-ready
echo "✔ Instalacja zakończona"
