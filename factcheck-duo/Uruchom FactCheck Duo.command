#!/bin/bash
# Dwuklik w Finderze uruchamia aplikację.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Nie znaleziono Node.js. Zainstaluj wersję LTS ze strony https://nodejs.org"; read -n 1; exit 1
fi
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Utworzyłem plik .env — otwieram go w TextEdit. Wklej klucze API, zapisz (⌘S) i uruchom ten plik ponownie."
  open -e .env; read -n 1; exit 0
fi
(sleep 1.5 && open "http://localhost:${PORT:-4173}") &
node server.js
