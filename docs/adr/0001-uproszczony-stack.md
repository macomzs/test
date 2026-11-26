# ADR 0001 – Uproszczony stack technologiczny

**Data:** 2026-11-26 · **Status:** przyjęty

## Kontekst
Propozycja z Etapu 0 zakładała NestJS + React/Vite + Prisma + BullMQ/Redis. Po doprecyzowaniu okazało się, że:
- systemem opiekuje się jedna osoba, która nie jest programistą,
- logowanie ma być na kontach lokalnych,
- interfejs ma być tylko po polsku,
- hosting nie jest jeszcze wybrany.

## Decyzja
- **Next.js (panel + API w jednej aplikacji)** zamiast osobnego NestJS i SPA. Jedna aplikacja do wdrożenia.
- **pg-boss** (kolejka w PostgreSQL) zamiast BullMQ + Redis. Jedna usługa stanowa mniej.
- **Drizzle** zamiast Prisma. Brak kroku generowania klienta i binarnych silników, prostsze obrazy Docker.
- Architektura heksagonalna zostaje: logika domeny w `@app/domain`, integracje w osobnych pakietach.

## Konsekwencje
- Mniej elementów do utrzymania i niższy koszt hostingu (2 procesy + PostgreSQL).
- Gdy wolumen zadań przekroczy możliwości pg-boss (rzędu setek tysięcy zadań na dobę), można wymienić implementację kolejki w `@app/platform/queue` bez zmian w domenie.
