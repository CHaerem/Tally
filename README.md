# Tally - Norsk porteføljesporing

Beregn din reelle investeringsavkastning basert på transaksjonshistorikk fra megleren din. Tally bruker XIRR (pengevektet avkastning) for å gi deg et mer nøyaktig bilde enn det banken viser.

**Prøv:** [chaerem.github.io/Tally](https://chaerem.github.io/Tally/)

## Slik fungerer det

1. Legg til aksjer og fond manuelt med søk, eller importer CSV fra megleren
2. Kurser hentes automatisk — historisk og nåværende
3. Se din faktiske avkastning (XIRR) med utbytte inkludert

## Funksjoner

- **XIRR-beregning** — årlig avkastning som tar hensyn til tidspunkt for kjøp/salg
- **Aksjesøk** med autocomplete for 370+ norske aksjer og 32 fond
- **Historiske kurser** — velg dato og få kurs automatisk
- **Tre-veis kalkulator** — fyll inn kurs + antall, kurs + totalbeløp, eller antall + totalbeløp
- **Fondstøtte** — norske fond med NAV fra Morningstar via Yahoo Finance
- **Automatisk kurshenting** fra Yahoo Finance for Oslo Børs
- **Utbyttesporing** inkludert i totalavkastning
- **CSV-import** med støtte for norsk format (`;`-separator, norske datoer, desimalkomma)
- **Del portefølje** — del via lenke eller native share
- **Lokal lagring** — all data lagres i nettleseren, ingenting sendes til server
- **Mobiloptimalisert** — FAB, sticky header, store touch targets, iOS safe areas

## Utvikling

```bash
npm install          # Installer avhengigheter
npm run dev          # Start utviklingsserver
npm run build        # Bygg for produksjon (tsc + vite)
npm run test         # Kjør tester (vitest, 104 tester)
npm run type-check   # Kun TypeScript-sjekk
```

## Deploy

Appen deployes automatisk til GitHub Pages via `gh-pages` branch ved push til `main`.

PR-er får automatisk en preview-URL: `https://chaerem.github.io/Tally/pr-preview/pr-<N>/`

## Teknologi

- TypeScript + Vite
- Vanilla CSS med Anthropic-inspirert design (Inter font, varme toner)
- Vitest + jsdom for testing
- LocalStorage for persistens
- Yahoo Finance API + statisk data for kurser
- GitHub Pages + GitHub Actions

## Personvern

- Ingen registrering eller innlogging
- All data lagres lokalt i nettleseren
- Ingen analytics eller sporing
- Kursforespørsler går direkte til Yahoo Finance

## Lisens

MIT
