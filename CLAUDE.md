# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Tally** is a mobile-first Norwegian stock and fund portfolio tracker that calculates real investment returns from transaction history. Built with TypeScript and Vite, deployed to GitHub Pages as a PWA. Primarily used on iPhone.

The core value proposition: calculate historical investment returns more accurately than banks and brokers, based on real transaction data.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # TypeScript check + Vite build (always run before pushing)
npm run test         # Run tests (vitest)
npm run type-check   # TypeScript only
npm run preview      # Preview production build
```

## Architecture

### Event-Sourced Ledger

All state is derived from an append-only event log. Returns are never stored — always calculated from events.

**Event types:** `TRADE_BUY`, `TRADE_SELL`, `DIVIDEND`, `FEE`, `CASH_IN`, `CASH_OUT`
**Event sources:** `MANUAL`, `CSV_IMPORT`, `AUTO` (auto-registered dividends)

### Source Files

```
src/
├── main.ts                  # Bootstrapper (3 lines)
├── app.ts                   # TallyApp class: render coordination, event wiring
├── state.ts                 # AppState interface, createInitialState(), updateDerivedData()
├── api.ts                   # Yahoo Finance price fetching + static stock data index
├── style.css                # Mobile-first CSS, calm palette, iOS safe areas
├── vite-env.d.ts            # Vite client type declarations
│
├── views/                   # Pure render functions (state → HTML string)
│   ├── header.ts            # renderHeader(), renderEmptyState(), renderOnboardingHint()
│   ├── summary.ts           # renderSummary() — portfolio value, breakdown, allocation
│   ├── holdings.ts          # renderHoldings(), renderHoldingTransactions(), renderMarketStats()
│   ├── footer.ts            # renderFooter()
│   ├── transaction-log.ts   # renderTransactionLog() — bottom-sheet modal
│   └── gains.ts             # renderGainsView() — realized gains by year
│
├── modals/                  # Modal dialogs
│   ├── trade.ts             # Trade form: renderTradeModal(), submitTrade(), attachTradeModalListeners()
│   └── import.ts            # Import: renderImportModal(), handleFileSelect(), confirmImport()
│
├── charts/                  # Canvas-based chart rendering
│   ├── portfolio-chart.ts   # Portfolio value over time with event markers
│   └── holding-chart.ts     # Per-holding position value chart
│
├── data/                    # Data fetching and processing
│   ├── funds.ts             # StockSuggestion type + NORWEGIAN_FUNDS array (130+ funds)
│   ├── prices.ts            # refreshPrices(), loadDailyChanges(), loadMarketStats()
│   ├── portfolio-history.ts # computePortfolioHistory() — time-series calculation
│   └── dividends.ts         # syncDividends(), renderDividendList()
│
├── utils/                   # Utility functions
│   └── share.ts             # shareData(), checkShareUrl(), exportData(), clearAllData()
│
├── types/                   # TypeScript type definitions
│   ├── index.ts             # Re-exports all types + type guards
│   ├── account.ts           # Account (ASK, VPS_ORDINARY, IPS)
│   ├── event.ts             # Event types (TRADE_BUY, DIVIDEND, etc.)
│   ├── instrument.ts        # Instrument (ISIN, ticker, name, instrumentType)
│   ├── holding.ts           # Holding, PortfolioMetrics, CashFlow
│   ├── ledger.ts            # LedgerState (master state, version 2)
│   └── warning.ts           # DataQualityWarning
│
├── ledger/                  # Persistence layer
│   ├── storage.ts           # LedgerStorage: localStorage CRUD + price persistence
│   └── utils.ts             # Date/number parsing (Norwegian locale), ID generation
│
├── calculations/            # Pure calculation functions
│   ├── holdings.ts          # deriveHoldings(), derivePortfolioMetrics(), deriveCashFlows()
│   ├── xirr.ts              # XIRR via Newton-Raphson method
│   ├── tax.ts               # deriveRealizedGains() (FIFO), deriveGainsByYear()
│   └── format.ts            # formatCurrency(), formatPercent(), formatDateShort()
│
└── import/                  # File import parsers
    ├── csv-parser.ts        # CSV parsing with Norwegian column/type mapping
    └── vps-parser.ts        # VPS Investortjenester XLSX import
```

### Test Files

```
src/
├── api.test.ts              # API + stock index tests
├── integration.test.ts      # Full flow integration tests
├── share.test.ts            # Portfolio URL sharing roundtrip tests
├── ledger/
│   ├── storage.test.ts      # localStorage CRUD tests
│   └── utils.test.ts        # Utility function tests
├── calculations/
│   ├── xirr.test.ts         # XIRR calculation tests
│   ├── holdings.test.ts     # Holdings derivation tests
│   ├── tax.test.ts          # Realized gains FIFO tests
│   └── format.test.ts       # Formatting tests
└── import/
    └── csv-parser.test.ts   # CSV parsing tests
```

**148 tests across 10 test files.**

### Data Flow

1. User adds holdings manually (with autocomplete search), imports CSV/XLSX, or imports via VPS link
2. Events appended to ledger, saved to localStorage (`tally_ledger_v2`)
3. Dividends auto-registered from historical data for new buy trades
4. Current prices fetched from Yahoo Finance + static data, cached in localStorage (`tally_prices`)
5. Historical prices fetched from static per-ticker JSON files in `public/data/`
6. Holdings derived: FIFO cost basis, dividends per holding
7. Portfolio metrics calculated: market value, kursgevinst, totalavkastning
8. Realized gains calculated per sell event (FIFO)
9. UI rendered with interactive charts, touch scrubbing, collapsible sections

### Key Design Decisions

- **No framework** — vanilla TypeScript with innerHTML rendering
- **Modular architecture** — views/, modals/, charts/, data/ directories with pure functions
- **AppState pattern** — shared state object passed to all view functions
- **re-render pattern:** `updateDerivedData()` → `render()` → `attachEventListeners()`
- **PWA** — installable on iPhone, offline-capable with service worker
- **Mobile-first CSS** with iOS safe areas, 44px+ touch targets, bottom-sheet modals
- **Floating action button (FAB)** for primary action on mobile
- **Collapsible holding details** — core stats always visible, markedsdata/transaksjoner expandable
- **Auto-dividends** — historical dividends registered automatically on buy
- **FIFO realized gains** — sell events matched against oldest buy lots
- **Stock + Fund support:** Stocks use `.OL` suffix, funds use `.IR` suffix (Morningstar IDs)
- **Static stock data** — pre-fetched JSON in `public/data/`, includes fundamentals (P/E, P/B, margin)
- **VPS import** — direct link to VPS Investortjenester + XLSX parser

### Instrument Types

- `STOCK` — Norwegian stocks (435 tickers from Oslo Børs, Euronext Expand, Euronext Growth)
- `FUND` — Norwegian mutual funds (130+ funds with Morningstar IDs)

### Storage Keys

- `tally_ledger_v2` — full ledger state (events, instruments, accounts, warnings)
- `tally_prices` — cached current prices by ISIN
- `tally_watchlist` — followed stocks/funds
- `tally_hint_shown` — onboarding hint dismissed flag

### API & Data Sources

- **Yahoo Finance chart API:** `https://query1.finance.yahoo.com/v8/finance/chart/TICKER.OL`
- **Yahoo Finance quoteSummary** (via yahoo-finance2 in build script): P/E, P/B, market cap, margins
- **Static stock index:** `public/data/index.json` (all tickers + current prices + fundamentals)
- **Per-ticker history:** `public/data/TICKER.json` (historical prices + dividends + fundamentals)
- **Fund prices:** Yahoo Finance with `.IR` suffix (Morningstar IDs)
- **NewsWeb:** Link to Oslo Børs announcements per stock
- Prices cached locally, runtime-cached by service worker

## Design

### Design Principles

The UI follows **calm design** — an approach that respects the user's attention and avoids visual noise:

- **Intuitive over clever** — every interaction should be immediately understandable
- **Simple over feature-rich** — resist adding unless it serves a clear, frequent need
- **Minimalist over decorative** — every visual element must earn its place
- **Calm over attention-grabbing** — muted tones, gentle transitions, quiet and trustworthy
- **Information density with clarity** — typography hierarchy over boxes and borders
- **Progressive disclosure** — essential first, details on interaction (tap-to-expand, collapsible sections)

### Visual Language

- **Warm palette** — sandy background (#f5f0e8), terracotta accent (#da7756)
- **Inter font** from Google Fonts
- **Card-based holdings** with tap-to-expand details
- **Sticky header** + **FAB** for mobile-optimized interaction
- **Bottom-sheet modals** with grab handle, blur backdrop, drag-to-fullscreen
- **Colored labels** for transaction types (green KJØP, red SALG, orange UTBYTTE)
- **Subtle transitions** (0.2s) for interactive states
- **Color sparingly** — success green and danger red only for gain/loss values

## Deployment

### Production

Deployed to GitHub Pages via `gh-pages` branch. The `deploy.yml` workflow builds on push to `main`.

**GitHub Pages source:** Deploy from branch → `gh-pages` / `root`

### Data Updates

Stock data (prices + fundamentals) updated automatically:
- **Weekdays 17:00 CET** — incremental update after market close
- **Sundays 02:00 CET** — full update with dividend history
- Via `fetch-stock-data-v2.yml` workflow using `yahoo-finance2`

### PR Previews

Every PR gets a preview at: `https://CHaerem.github.io/Tally/pr-preview/pr-<N>/`

## Important Notes

- **Language:** UI is in Norwegian (bokmål). Keep all user-facing text in Norwegian.
- **Currency:** All values in NOK, formatted with Norwegian locale (`nb-NO`).
- **ISIN is the primary key** for instruments and prices, not ticker.
- **iPhone is the primary target** — always test mobile layout assumptions.
- **`npm run build` must pass** before committing — it runs `tsc && vite build`.
- **`npm run test` must pass** — 148 tests across 10 test files (vitest + jsdom).
- **vite-env.d.ts is required** — without it, TypeScript fails on CSS imports.
- **GitHub Pages base path** is `/Tally/` (set in `vite.config.ts`).
- **Squash merge workflow** — PRs are squash-merged; rebase on `origin/main` before pushing.
- **Diacritics in search** — search normalizes ö→o, æ→a etc for matching (e.g. "Höegh" → "HOEGH")
- **Dividend validation** — Yahoo sometimes reports wrong dividend data; validated against actual history
