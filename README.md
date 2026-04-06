# Tally — Norsk porteføljesporing

Se din faktiske investeringsavkastning basert på transaksjonshistorikk. Tally beregner hva du virkelig har tjent — med kursgevinst og utbytte separat.

**Prøv:** [chaerem.github.io/Tally](https://chaerem.github.io/Tally/)

## Slik fungerer det

1. Legg til aksjer og fond med søk, eller importer fra VPS Investortjenester
2. Kurser og utbytte hentes automatisk — historisk og nåværende
3. Se avkastning med interaktive grafer og detaljerte nøkkeltall

## Funksjoner

### Portefølje
- **Avkastningsberegning** — kursgevinst og utbytte vist separat, med totalavkastning inkl. utbytte
- **Interaktiv porteføljegraf** — touch for å se verdi på en dato, med kjøps-/salgsmarkører
- **Allokering** — visuell fordeling av porteføljen
- **Periodevelger** — HiÅ, 1 år, 3 år, 5 år, Total

### Per posisjon
- **Posisjonsgraf** — din verdi over tid (antall × kurs), ikke bare kursutvikling
- **Nøkkeltall** — P/E, P/B, markedsverdi, 52-ukers range, volum, margin
- **Daglig endring** — "+X% i dag" på hvert kort
- **Kollapserbare seksjoner** — markedsdata og transaksjoner skjules til du trenger dem

### Transaksjoner
- **Automatisk utbytte** — registreres automatisk fra historiske data ved kjøp
- **Realisert gevinst/tap** — FIFO-beregning for salg
- **Transaksjonslogg** — full historikk med rediger/slett, drag-to-fullscreen
- **VPS-import** — direkte lenke til VPS Investortjenester + XLSX-parser
- **CSV-import** — norsk format med `;`-separator og desimalkomma

### Aksjesøk
- **435+ norske aksjer** og **130+ fond** med autocomplete
- **Historiske kurser** — velg dato og få kurs automatisk
- **Tre-veis kalkulator** — kurs × antall = totalbeløp
- **Diakritikk-normalisering** — "Höegh" finner "HOEGH AUTOLINERS"

### Generelt
- **PWA** — installerbar på iPhone homescreen, fungerer offline
- **Del portefølje** — del via lenke eller native share
- **Lokal lagring** — all data lagres i nettleseren, ingenting sendt til server
- **Mobiloptimalisert** — FAB, bottom-sheet modals, pull-to-refresh, iOS safe areas
- **Børsmeldinger** — lenke til NewsWeb for hver aksje

## Utvikling

```bash
npm install          # Installer avhengigheter
npm run dev          # Start utviklingsserver
npm run build        # Bygg for produksjon (tsc + vite)
npm run test         # Kjør tester (vitest, 148 tester)
npm run type-check   # Kun TypeScript-sjekk
```

### Prosjektstruktur

```
src/
├── main.ts              # Bootstrapper
├── app.ts               # TallyApp — render-koordinering
├── state.ts             # AppState — delt tilstand
├── views/               # Rene render-funksjoner
├── modals/              # Trade og import-dialoger
├── charts/              # Canvas-baserte grafer
├── data/                # Prisoppdatering, utbytte, fondsliste
├── utils/               # Deling, eksport
├── calculations/        # XIRR, holdings, FIFO, formatering
├── ledger/              # localStorage CRUD
├── import/              # CSV og VPS XLSX-parsing
└── types/               # TypeScript-definisjoner
```

### Dataoppdatering

Aksjedata (priser + nøkkeltall) oppdateres automatisk via GitHub Actions:
- **Hverdager 17:00** — inkrementell oppdatering etter børs stenger
- **Søndager 02:00** — full oppdatering med utbyttehistorikk

## Deploy

Appen deployes automatisk til GitHub Pages ved push til `main`.

PR-er får automatisk preview: `https://chaerem.github.io/Tally/pr-preview/pr-<N>/`

## Teknologi

- TypeScript + Vite + vite-plugin-pwa
- Vanilla CSS med warm calm design (Inter font, #f5f0e8 + #da7756)
- Canvas-baserte grafer med bezier-kurver og touch-interaksjon
- Vitest + jsdom for testing (148 tester)
- LocalStorage for persistens
- Yahoo Finance API + yahoo-finance2 for priser og nøkkeltall
- SheetJS (xlsx) for VPS-import
- GitHub Pages + GitHub Actions

## Personvern

- Ingen registrering eller innlogging
- All data lagres lokalt i nettleseren
- Ingen analytics eller sporing
- Kursforespørsler går direkte til Yahoo Finance
- PWA fungerer offline med cached data

## Lisens

MIT
