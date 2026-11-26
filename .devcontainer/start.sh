#!/usr/bin/env bash
# Uruchamia panel i worker w tle przy każdym starcie Codespace. Logi: /tmp/app.log
cd "$(dirname "$0")/.."
pkill -f "next dev" >/dev/null 2>&1 || true
pkill -f "tsx watch" >/dev/null 2>&1 || true
setsid nohup pnpm dev > /tmp/app.log 2>&1 < /dev/null &
echo "✔ Aplikacja startuje – za chwilę otworzy się zakładka z panelem (port 3000). Logi: /tmp/app.log"
