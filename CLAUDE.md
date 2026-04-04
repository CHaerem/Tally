# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Tally** is a mobile-first Norwegian stock portfolio tracker that calculates real investment returns (XIRR) from transaction history. Built with TypeScript and Vite, deployed to GitHub Pages. Primarily used on iPhone.

The core value proposition: calculate historical investment returns more accurately than banks and brokers, based on real VPS (Norwegian Securities Registry) data.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # TypeScript check + Vite build (always run before pushing)
npm run type-check   # TypeScript only
npm run preview      # Preview production build
npm run deploy       # Build + deploy to GitHub Pages
```

## Architecture

### Event-Sourced Ledger

All state is derived from an append-only event log. Returns are never stored — always calculated from events.

**Event types:** `TRADE_BUY`, `TRADE_SELL`, `DIVIDEND`, `FEE`, `CASH_IN`, `CASH_OUT`

### Source Files

```
src/
├── main.ts              # TallyApp class: UI rendering, event handlers, app lifecycle
├── api.ts               # Yahoo Finance price fetching (TICKER.OL format)
├── style.css            # Mobile-first CSS, iOS safe areas, system font
├── vite-env.d.ts        # Vite client type declarations
├── types/
│   ├── index.ts         # Re-exports all types
│   ├── account.ts       # Account (ASK, VPS_ORDINARY, IPS)
│   ├── event.ts         # Event types + type guards (isTradeEvent, etc.)
│   ├── instrument.ts    # Instrument (ISIN, ticker, name)
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

### Data Flow

1. User imports CSV from broker (Nordnet, DNB, Sbanken, etc.)
2. CSV parsed into typed events + instruments
3. Events appended to ledger, saved to localStorage (`tally_ledger_v2`)
4. Current prices fetched from Yahoo Finance, cached in localStorage (`tally_prices`)
5. Holdings derived: FIFO cost basis, dividends per holding
6. Portfolio metrics calculated: XIRR, market value, unrealized gain, total dividends
7. UI rendered with color-coded results

### Key Design Decisions

- **No framework** — vanilla TypeScript with innerHTML rendering
- **Single TallyApp class** manages all state and UI
- **re-render pattern:** `updateDerivedData()` → `render()` → `attachEventListeners()`
- **Mobile-first CSS** with iOS safe areas, 44px touch targets, bottom-sheet modals
- **Prices are separate from ledger** — cached independently, fetched on load + manual refresh
- **Manual price input as fallback** when Yahoo Finance API is unavailable (CORS, rate limits)

### Storage Keys

- `tally_ledger_v2` — full ledger state (events, instruments, accounts, warnings)
- `tally_prices` — cached current prices by ISIN

### API

Yahoo Finance chart API: `https://query1.finance.yahoo.com/v8/finance/chart/TICKER.OL`

- May be blocked by CORS in some environments
- Prices cached locally to reduce API calls
- Parallel fetching for all holdings via `Promise.allSettled`

## Important Notes

- **Language:** UI is in Norwegian (bokmål). Keep all user-facing text in Norwegian.
- **Currency:** All values in NOK, formatted with Norwegian locale (`nb-NO`).
- **ISIN is the primary key** for instruments and prices, not ticker.
- **iPhone is the primary target** — always test mobile layout assumptions.
- **`npm run build` must pass** before committing — it runs `tsc && vite build`.
- **vite-env.d.ts is required** — without it, TypeScript fails on CSS imports.
- **GitHub Pages base path** is `/Tally/` (set in `vite.config.ts`).

## What's Not Yet Implemented

- Event timeline view (listed in MVP spec)
- Charts (chart.js is a dependency but unused)
- Tests (no test framework configured)
- Stock data fetch scripts (GitHub Actions workflows reference missing `scripts/` files)
- Search/popular stocks features (CSS exists, JS not wired up)
