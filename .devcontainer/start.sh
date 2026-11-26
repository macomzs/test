#!/usr/bin/env bash
# Uruchamia panel (port 3000) i worker w tle. Logi: /tmp/app.log
# Można uruchomić ręcznie w terminalu:  bash .devcontainer/start.sh
cd "$(dirname "$0")/.."
if [ ! -d node_modules ] || [ ! -f /tmp/.ecommerce-hub-ready ]; then
  bash .devcontainer/setup.sh || { echo "✘ Instalacja nie powiodła się – zobacz /tmp/setup.log"; exit 1; }
fi
pkill -f "next dev" >/dev/null 2>&1 || true
pkill -f "tsx watch" >/dev/null 2>&1 || true
setsid nohup pnpm dev > /tmp/app.log 2>&1 < /dev/null &
for i in $(seq 1 60); do
  if curl -fs http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "✔ Aplikacja działa – zakładka PORTS → port 3000 → ikona globusa"
    exit 0
  fi
  sleep 2
done
echo "✘ Aplikacja nie odpowiada po 2 minutach. Ostatnie linie logu:"
tail -n 30 /tmp/app.log
