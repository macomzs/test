#!/usr/bin/env bash
# Zbiera informacje diagnostyczne. Uruchom:  bash .devcontainer/diagnose.sh
cd "$(dirname "$0")/.."
echo "=== Wersja kodu ===";        git log --oneline -1; git status --short | head -5
echo "=== Narzędzia ===";          echo "node $(node -v 2>&1) | pnpm $(pnpm -v 2>&1)"
echo "=== Baza danych (port 5432) ==="; (echo > /dev/tcp/127.0.0.1/5432) 2>/dev/null && echo "OK – baza odpowiada" || echo "BRAK połączenia z bazą"
echo "=== Aplikacja (port 3000) ==="; curl -s -m 5 http://127.0.0.1:3000/api/health || echo "BRAK odpowiedzi"
echo
echo "=== Procesy ===";            pgrep -af "next|tsx" | grep -v diagnose | head -5 || echo "brak uruchomionych procesów aplikacji"
echo "=== Log instalacji (ostatnie 25 linii) ==="; tail -n 25 /tmp/setup.log 2>/dev/null || echo "brak /tmp/setup.log – instalacja się nie uruchomiła"
echo "=== Log aplikacji (ostatnie 25 linii) ===";  tail -n 25 /tmp/app.log 2>/dev/null || echo "brak /tmp/app.log – aplikacja nie była uruchamiana"
