# Tally – MVP-grunnlag og gjennomføringsplan

> **Formål:** Dette dokumentet er et praktisk og teknisk utgangspunkt for å bygge en første MVP av Tally. Det er ment å ligge i Git-repoet og fungere som både **retning, avgrensning og sjekkliste** for hva som faktisk må bygges for å bevise verdi.

---

## 1. Hva MVP-en skal bevise

MVP-en skal bevise én ting:

> **At Tally kan beregne historisk investeringsavkastning mer korrekt enn banker og meglere, basert på reelle VPS-data.**

MVP-en skal _ikke_:

- være komplett
- være automatisert
- være skalerbar
- være pen

Den skal være **riktig**.

---

## 2. Avgrensning

### 2.1 Hva MVP-en inkluderer

- Manuell innlasting av data (CSV / PDF)
- Én bruker (deg selv)
- Én eller flere VPS-kontoer
- Aksjer og ETF-er
- Historisk analyse

### 2.2 Hva MVP-en eksplisitt ikke inkluderer

- BankID
- Automatisk synk
- Sanntidsdata
- Handel / ordre
- Investeringsråd

---

## 3. Datagrunnlag for MVP

### 3.1 Datakilder

MVP-en baseres på **manuelt eksportert data fra din egen VPS-profil**, typisk via nettbank / VPS Investortjenester.

Du bør samle:

1. **Transaksjonshistorikk** (CSV hvis mulig)
   - kjøp / salg
   - dato
   - antall
   - pris
   - kurtasje
   - valuta

2. **Beholdning (nåværende)**
   - per ISIN
   - antall
   - konto-type (ASK / ordinær)

3. **Årsoppgaver (PDF)**
   - brukes til validering og backfilling

4. **Utbyttehistorikk**
   - ofte inkludert i transaksjonsloggen

Dette er tilstrekkelig for MVP.

---

## 4. Datamodell (MVP-nivå)

### 4.1 Grunnprinsipp

All logikk i Tally bygger på en **event-basert ledger**.

> Avkastning lagres aldri – den beregnes alltid fra events.

---

### 4.2 Kjerneentiteter

#### Account

- `account_id`
- `account_type` (ASK | VPS_ORDINARY)
- `base_currency`

#### Instrument

- `isin`
- `name`
- `currency`

#### Event (append-only)

Felles felter:

- `event_id`
- `account_id`
- `date`
- `type`
- `amount`
- `currency`

Event-typer i MVP:

- `TRADE_BUY`
- `TRADE_SELL`
- `DIVIDEND`
- `FEE`
- `CASH_IN`
- `CASH_OUT`

---

## 5. Minimum funksjonalitet

### 5.1 Holdings

- Nåværende beholdning per instrument
- Markedsverdi basert på siste pris

### 5.2 Historisk avkastning (kjerne)

#### Money-weighted return (XIRR)

- Basert på alle kontantstrømmer med dato
- Sluttverdi brukes som terminal cash flow

Dette er hovedmetrikken i MVP.

#### Time-weighted return (valgfritt i MVP)

- Kan implementeres senere

---

### 5.3 Utbytte

- Inkluderes som positive kontantstrømmer
- Vises både isolert og som del av totalavkastning

---

## 6. Praktisk XIRR-definisjon (MVP)

Input:

```text
Date        Amount
2019-01-10  -10 000
2020-03-15  -5 000
2021-06-01   +1 200 (dividend)
2024-12-31  +18 000 (market value)
```

Output:

- Én årlig prosentverdi

XIRR må valideres mot Excel.

---

## 7. UI-krav (minimalt)

- Import-side (last opp CSV/PDF)
- Oversiktsside:
  - total investert
  - nåverdi
  - XIRR

- Enkel tidslinje for events

---

## 8. Datakvalitet og validering

MVP-en skal være ærlig om datakvalitet.

Eksempler på varsler:

- "Mangler kurtasje på 3 handler"
- "FX-rate ikke eksplisitt – brukt NOK-beløp"
- "Corporate action rekonstruert indirekte"

Dette bygger tillit.

---

## 9. Teknisk gjennomføring (foreslått)

- Backend:
  - enkel API / CLI
  - PostgreSQL eller SQLite

- Analyse:
  - egen XIRR-implementasjon
  - deterministiske beregninger

- Frontend:
  - enkel web-UI eller lokal app

---

## 10. Arbeidsplan (2–4 uker)

### Uke 1

- Eksporter egne VPS-data
- Definer CSV-format
- Implementer ledger + import

### Uke 2

- Implementer XIRR
- Valider mot Excel
- Bygg enkel UI

### Uke 3–4

- Utbytte
- Flere kontoer
- Dokumenter avvik mot bankens tall

---

## 11. Hva MVP-en gir deg videre

Når MVP-en er ferdig har du:

- et fungerende produkt
- verifisert datamodell
- dokumentert verdiforslag
- konkret liste over manglende datapunkter

Dette er **riktig tidspunkt** å:

- kontakte Euronext
- vurdere partnerskap
- beslutte videre investering

---

## 12. Avslutning

Tally-MVP-en bygges for å bevise **korrekthet**, ikke skala.

Manuell datainnlasting er ikke en nødløsning – det er en **strategisk styrke** i denne fasen.

Dette dokumentet er ment å oppdateres kontinuerlig etter hvert som innsikten øker.
