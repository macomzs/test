#!/usr/bin/env bash
# Jednorazowa instalacja przy tworzeniu Codespace.
set -euo pipefail
sudo corepack enable
[ -f .env ] || cp .env.example .env
pnpm install
until pg_isready -h localhost -U app >/dev/null 2>&1 || (echo > /dev/tcp/localhost/5432) 2>/dev/null; do
  echo "Czekam na bazę danych…"; sleep 2
done
pnpm db:setup
echo "✔ Instalacja zakończona"
