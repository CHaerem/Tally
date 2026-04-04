# Tally - Norsk porteføljesporing

Beregn din reelle investeringsavkastning basert på transaksjonshistorikk fra megleren din. Tally bruker XIRR (pengevektet avkastning) for å gi deg et mer nøyaktig bilde enn det banken viser.

**Prøv:** [chaerem.github.io/Tally](https://chaerem.github.io/Tally/)

## Slik fungerer det

1. Eksporter transaksjonshistorikk som CSV fra nettbanken (Nordnet, DNB, Sbanken m.fl.)
2. Importer filen i Tally
3. Kurser hentes automatisk — se din faktiske avkastning

## Funksjoner

- **XIRR-beregning** — årlig avkastning som tar hensyn til tidspunkt for kjøp/salg
- **Automatisk kurshenting** fra Yahoo Finance for Oslo Børs
- **Utbyttesporing** inkludert i totalavkastning
- **CSV-import** med støtte for norsk format (`;`-separator, norske datoer, desimalkomma)
- **Datakvalitetsvarsler** — varsler om manglende kurtasje og andre avvik
- **Lokal lagring** — all data lagres i nettleseren, ingenting sendes til server
- **Mobiloptimalisert** — designet primært for iPhone

## Utvikling

```bash
npm install          # Installer avhengigheter
npm run dev          # Start utviklingsserver
npm run build        # Bygg for produksjon (tsc + vite)
npm run type-check   # Kun TypeScript-sjekk
```

## Deploy

Appen deployes automatisk til GitHub Pages ved push til `main` via GitHub Actions.

Manuelt: `npm run deploy`

## Teknologi

- TypeScript + Vite
- Vanilla CSS (ingen rammeverk)
- LocalStorage for persistens
- Yahoo Finance API for kurser
- GitHub Pages + GitHub Actions

## Personvern

- Ingen registrering eller innlogging
- All data lagres lokalt i nettleseren
- Ingen analytics eller sporing
- Kursforespørsler går direkte til Yahoo Finance

## Begrensninger

- Kun norske aksjer (Oslo Børs, `.OL`-tickere)
- Yahoo Finance kan blokkeres av CORS i noen nettlesere
- Mindre aksjer har ikke alltid kursdata — manuell innfylling mulig
- Kun NOK som valuta

## Lisens

MIT
