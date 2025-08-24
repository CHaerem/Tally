# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Norwegian Stock Portfolio Tracker - A web application for tracking Norwegian stock investments with dividend history and performance calculations. Built with TypeScript and Vite, deployed via GitHub Pages.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check TypeScript
npm run type-check

# Deploy to GitHub Pages
npm run deploy
```

## Architecture

### Core Modules

- **src/main.ts**: Application entry point and UI orchestration
- **src/types.ts**: TypeScript interfaces for Stock, Portfolio, Dividend, and calculations
- **src/storage.ts**: LocalStorage persistence layer for portfolio data
- **src/api.ts**: Stock price and dividend fetching via Yahoo Finance proxy
- **src/portfolio.ts**: Portfolio calculations for returns, dividends, and profit/loss

### Data Flow

1. User adds stocks with purchase price/date via modal form
2. Portfolio saved to localStorage for persistence
3. API fetches current prices from Yahoo Finance (*.OL tickers for Oslo Børs)
4. Dividend history retrieved for each holding
5. Net profit calculated: (Current Value - Purchase Price) + Dividends
6. Results displayed with color-coded gains/losses

### API Integration

Using Yahoo Finance public API proxy for Norwegian stocks:
- Ticker format: `TICKER.OL` for Oslo Stock Exchange
- Falls back to mock data if API unavailable
- Includes predefined list of major Norwegian stocks for search

### Deployment

GitHub Actions workflow automatically deploys to GitHub Pages on push to main branch. Site available at: `https://[username].github.io/Tally/`

## Key Implementation Details

- **State Management**: Single App class manages portfolio state and UI updates
- **Data Persistence**: Portfolio stored in localStorage with automatic save on changes
- **Price Updates**: Manual refresh button fetches latest prices for all holdings
- **Calculations**: Total return includes both unrealized gains and received dividends
- **Currency**: All values in NOK with Norwegian locale formatting