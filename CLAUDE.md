# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Tally** is a mobile-first Norwegian stock and fund portfolio tracker that calculates real investment returns (XIRR) from transaction history. Built with TypeScript and Vite, deployed to GitHub Pages. Primarily used on iPhone.

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

### Source Files

```
src/
├── main.ts              # TallyApp class: UI rendering, event handlers, app lifecycle
├── api.ts               # Yahoo Finance price fetching + static stock data index
├── style.css            # Mobile-first CSS, warm Anthropic-inspired palette, iOS safe areas
├── vite-env.d.ts        # Vite client type declarations
├── types/
│   ├── index.ts         # Re-exports all types
│   ├── account.ts       # Account (ASK, VPS_ORDINARY, IPS)
│   ├── event.ts         # Event types + type guards (isTradeEvent, etc.)
│   ├── instrument.ts    # Instrument (ISIN, ticker, name, instrumentType)
│   ├── holding.ts       # Holding, PortfolioMetrics, CashFlow
│   ├── ledger.ts        # LedgerState (master state, version 2)
│   └── warning.ts       # DataQualityWarning
├── ledger/
│   ├── storage.ts       # LedgerStorage: localStorage CRUD + price persistence
│   └── utils.ts         # Date/number parsing (Norwegian locale), ID generation
├── calculations/
│   ├── holdings.ts      # deriveHoldings(), derivePortfolioMetrics(), deriveCashFlows()
│   ├── xirr.ts          # XIRR via Newton-Raphson method
│   └── format.ts        # formatCurrency(), formatPercent(), formatDateShort()
└── import/
    └── csv-parser.ts    # CSV parsing with Norwegian column/type mapping
```

### Test Files

```
src/
├── api.test.ts              # API + stock index tests
├── integration.test.ts      # Full flow integration tests
├── ledger/storage.test.ts   # localStorage CRUD tests
├── calculations/
│   ├── xirr.test.ts         # XIRR calculation tests
│   ├── holdings.test.ts     # Holdings derivation tests
│   └── format.test.ts       # Formatting tests
├── ledger/utils.test.ts     # Utility function tests
└── import/csv-parser.test.ts # CSV parsing tests
```

### Data Flow

1. User adds holdings manually (with autocomplete search) or imports CSV from broker
2. Events appended to ledger, saved to localStorage (`tally_ledger_v2`)
3. Current prices fetched from Yahoo Finance, cached in localStorage (`tally_prices`)
4. Historical prices fetched from static per-ticker JSON files in `public/data/`
5. Holdings derived: average cost basis, dividends per holding
6. Portfolio metrics calculated: XIRR, market value, unrealized gain, total dividends
7. UI rendered with color-coded results

### Key Design Decisions

- **No framework** — vanilla TypeScript with innerHTML rendering
- **Single TallyApp class** manages all state and UI
- **re-render pattern:** `updateDerivedData()` → `render()` → `attachEventListeners()`
- **Mobile-first CSS** with iOS safe areas, 44px+ touch targets, bottom-sheet modals
- **Floating action button (FAB)** for primary action on mobile
- **Sticky header** with icon-only actions (share, import)
- **Two modal modes:** simple ("Legg til beholdning") and full ("Registrer transaksjon")
- **Three-way form calculation:** price × qty = total (any two compute the third)
- **Stock + Fund support:** Stocks use `.OL` suffix, funds use `.IR` suffix (Morningstar IDs)
- **Static stock data** — pre-fetched JSON in `public/data/`, served via GitHub Pages
- **Prices are separate from ledger** — cached independently, fetched on load + manual refresh
- **Manual price input as fallback** when Yahoo Finance API is unavailable

### Instrument Types

- `STOCK` — Norwegian stocks (370 tickers from Oslo Børs, Euronext Expand, Euronext Growth)
- `FUND` — Norwegian mutual funds (32 popular funds with Morningstar IDs)

### Storage Keys

- `tally_ledger_v2` — full ledger state (events, instruments, accounts, warnings)
- `tally_prices` — cached current prices by ISIN

### API & Data Sources

- **Yahoo Finance chart API:** `https://query1.finance.yahoo.com/v8/finance/chart/TICKER.OL`
- **Static stock index:** `public/data/stock-index.json` (all tickers + current prices)
- **Per-ticker history:** `public/data/tickers/TICKER.json` (historical prices)
- **Fund prices:** Yahoo Finance with `.IR` suffix (Morningstar IDs)
- Prices cached locally to reduce API calls
- Parallel fetching for all holdings via `Promise.allSettled`

## Design

- **Warm, Anthropic/Claude-inspired palette** — sandy background (#f5f0e8), terracotta accent (#da7756)
- **Inter font** from Google Fonts
- **Card-based holdings** with tap-to-expand details
- **Sticky header** + **FAB** for mobile-optimized interaction
- **Bottom-sheet modals** with grab handle, blur backdrop

## Deployment

### Production

Deployed to GitHub Pages via `gh-pages` branch. The `deploy.yml` workflow builds on push to `main` and pushes to `gh-pages` using `peaceiris/actions-gh-pages`.

**GitHub Pages source:** Deploy from branch → `gh-pages` / `root`

### PR Previews

Every PR automatically gets a preview deployment at:
`https://CHaerem.github.io/Tally/pr-preview/pr-<N>/`

Uses `rossjrw/pr-preview-action` which deploys to a subdirectory on the `gh-pages` branch. Preview URL is auto-commented on the PR. Cleaned up when PR is closed.

## Important Notes

- **Language:** UI is in Norwegian (bokmål). Keep all user-facing text in Norwegian.
- **Currency:** All values in NOK, formatted with Norwegian locale (`nb-NO`).
- **ISIN is the primary key** for instruments and prices, not ticker.
- **iPhone is the primary target** — always test mobile layout assumptions.
- **`npm run build` must pass** before committing — it runs `tsc && vite build`.
- **`npm run test` must pass** — 104 tests across 8 test files (vitest + jsdom).
- **vite-env.d.ts is required** — without it, TypeScript fails on CSS imports.
- **GitHub Pages base path** is `/Tally/` (set in `vite.config.ts`).
- **Squash merge workflow** — PRs are squash-merged; rebase on `origin/main` before pushing.
