# FactCheck Duo 2.0

Zadajesz pytanie raz. Claude i ChatGPT odpowiadają równolegle, a każda odpowiedź **od razu** trafia do drugiego modelu, który sprawdza ją twierdzenie po twierdzeniu, z wyszukiwaniem w sieci i linkami do źródeł.

Tryb „Wklej gotowe odpowiedzi” zostaje na sytuacje, gdy rozmowa toczyła się już w claude.ai lub chatgpt.com.

## Uruchomienie na Macu (pierwszy raz)

1. Zainstaluj Node.js LTS z https://nodejs.org (instalator .pkg).
2. Rozpakuj ZIP (dwuklik).
3. Dwuklik w plik **„Uruchom FactCheck Duo.command”**.
   - Jeśli macOS zablokuje plik: kliknij go prawym przyciskiem → Otwórz → Otwórz.
4. Za pierwszym razem otworzy się plik `.env` w TextEdit. Wklej klucze po znakach `=`:
   - OpenAI: https://platform.openai.com/api-keys
   - Anthropic: https://console.anthropic.com/settings/keys
5. Zapisz (⌘S), zamknij, uruchom `.command` ponownie — przeglądarka otworzy http://localhost:4173.

Zatrzymanie: zamknij okno Terminala albo naciśnij Ctrl+C.

## Koszty

API jest płatne osobno od subskrypcji ChatGPT Plus / Claude Pro (trzeba doładować konto w obu konsolach). Jedno pytanie = 4 wywołania (2 odpowiedzi + 2 weryfikacje) plus wyszukiwania (w API Claude: 10 USD za 1000 wyszukiwań). Tańsze modele ustawisz w `.env` (`CLAUDE_MODEL`, `OPENAI_MODEL`), a liczbę wyszukiwań — w `MAX_SEARCHES`.

## Prywatność

Klucze zostają w lokalnym pliku `.env` i nie trafiają do przeglądarki. Serwer nasłuchuje tylko na tym komputerze (127.0.0.1). Aplikacja niczego nie zapisuje; treść trafia do API OpenAI i Anthropic.
