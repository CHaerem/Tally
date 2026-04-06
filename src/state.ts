import { LedgerStorage } from './ledger';
import { deriveHoldings, derivePortfolioMetrics, deriveDividendSummary } from './calculations';
import type { ReturnPeriod, DividendSummary } from './calculations';
import type { LedgerState, Holding, PortfolioMetrics } from './types';
import type { StockQuote } from './api';
import type { StockSuggestion } from './data/funds';
import type { CSVParseResult } from './import';

export interface PortfolioHistory {
  series: Array<{ date: string; value: number; costBasis: number }>;
  events: Array<{ date: string; type: string; amount: number; name: string }>;
  benchmarkSeries: Array<{ date: string; value: number }>;
}

export interface AppState {
  ledger: LedgerState;
  holdings: Holding[];
  metrics: PortfolioMetrics | null;
  currentPrices: Map<string, number>;
  pendingImport: CSVParseResult | null;
  isFetchingPrices: boolean;
  stockList: StockSuggestion[];
  selectedSuggestionIndex: number;
  tradeModalMode: 'simple' | 'full';
  watchlist: Array<{ ticker: string; name: string; type: 'STOCK' | 'FUND' }>;
  obxPrice: number | null;
  selectedPeriod: ReturnPeriod;
  dividendSummary: DividendSummary | null;
  quoteCache: Map<string, StockQuote>;
  portfolioHistory: PortfolioHistory | null;
  isLoadingChart: boolean;
  holdingSort: 'value' | 'gain' | 'name';
}

export function createInitialState(): AppState {
  return {
    ledger: LedgerStorage.initializeLedger(),
    holdings: [],
    metrics: null,
    currentPrices: LedgerStorage.loadPrices(),
    pendingImport: null,
    isFetchingPrices: false,
    stockList: [],
    selectedSuggestionIndex: -1,
    tradeModalMode: 'simple',
    watchlist: loadWatchlist(),
    obxPrice: null,
    selectedPeriod: 'total',
    dividendSummary: null,
    quoteCache: new Map(),
    portfolioHistory: null,
    isLoadingChart: false,
    holdingSort: 'value',
  };
}

export function updateDerivedData(state: AppState): void {
  state.holdings = deriveHoldings(state.ledger.events, state.ledger.instruments, state.currentPrices);
  state.metrics = derivePortfolioMetrics(state.ledger.events, state.holdings);
  state.dividendSummary = deriveDividendSummary(state.ledger.events, state.ledger.instruments, state.holdings);
  state.portfolioHistory = null;
}

export function loadWatchlist(): Array<{ ticker: string; name: string; type: 'STOCK' | 'FUND' }> {
  try {
    const raw = localStorage.getItem('tally_watchlist');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveWatchlist(watchlist: Array<{ ticker: string; name: string; type: 'STOCK' | 'FUND' }>): void {
  localStorage.setItem('tally_watchlist', JSON.stringify(watchlist));
}
