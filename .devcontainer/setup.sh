#!/usr/bin/env bash
# Jednorazowa instalacja przy tworzeniu Codespace. Log: /tmp/setup.log
set -euo pipefail
exec > >(tee -a /tmp/setup.log) 2>&1
cd "$(dirname "$0")/.."
echo "▶ Instalacja E-commerce Hub…"
command -v pnpm >/dev/null || sudo corepack enable
[ -f .env ] || cp .env.example .env
pnpm install
echo "▶ Czekam na bazę danych…"
for i in $(seq 1 60); do
  (echo > /dev/tcp/127.0.0.1/5432) 2>/dev/null && break
  sleep 2
done
pnpm db:setup
touch /tmp/.ecommerce-hub-ready
echo "✔ Instalacja zakończona"
