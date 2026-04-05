const BASE_URL = import.meta.env.BASE_URL || '/Tally/';
const DATA_URL = BASE_URL + 'data/';
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

// --- Types for static data files ---

export interface Fundamentals {
  trailingPE: number | null;
  forwardPE: number | null;
  marketCap: number | null;
  dividendYield: number | null;
  dividendRate: number | null;
  payoutRatio: number | null;
  beta: number | null;
  priceToBook: number | null;
  enterpriseToEbitda: number | null;
  profitMargins: number | null;
  returnOnEquity: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  grossMargins: number | null;
  totalRevenue: number | null;
  ebitda: number | null;
}

interface StockDataFile {
  ticker: string;
  name: string;
  currency: string;
  currentPrice: number | null;
  previousClose?: number | null;
  dayHigh?: number | null;
  dayLow?: number | null;
  volume?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  fundamentals?: Fundamentals;
  prices: Array<{ date: string; close: number }>;
  dividends: Array<{ date: string; amount: number }>;
  lastUpdated: string;
}

interface StockIndex {
  metadata: { lastUpdated: string; symbolCount: number };
  symbols: Record<string, {
    name: string;
    currentPrice: number | null;
    priceCount: number;
    dividendCount: number;
    lastDate: string | null;
    lastUpdated: string;
  }>;
}

// --- Static data (pre-fetched, stored in repo) ---

let indexCache: StockIndex | null = null;

/** Reset module cache (for testing) */
export function _resetIndexCache(): void {
  indexCache = null;
}

export async function fetchStockIndex(): Promise<StockIndex | null> {
  if (indexCache) return indexCache;
  try {
    const res = await fetch(DATA_URL + 'index.json');
    if (!res.ok) return null;
    indexCache = await res.json() as StockIndex;
    return indexCache;
  } catch {
    return null;
  }
}

export async function fetchStockData(ticker: string): Promise<StockDataFile | null> {
  // Fund tickers have dots (e.g. 0P0000PS3U.IR) — filenames use underscores
  const filename = ticker.replace(/\./g, '_');
  try {
    const res = await fetch(DATA_URL + encodeURIComponent(filename) + '.json');
    if (!res.ok) return null;
    return await res.json() as StockDataFile;
  } catch {
    return null;
  }
}

// --- Live price fallback (Yahoo Finance) ---

interface YahooChartMeta {
  regularMarketPrice: number;
  currency: string;
  chartPreviousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

interface YahooChartResult {
  chart: {
    result: Array<{ meta: YahooChartMeta }> | null;
    error: { description: string } | null;
  };
}

export interface StockQuote {
  price: number;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  weekHigh52: number | null;
  weekLow52: number | null;
  dayChange: number | null;
  dayChangePct: number | null;
}

export async function fetchLivePrice(ticker: string): Promise<number | null> {
  // Fund tickers already have .IR suffix (Morningstar), stocks use .OL (Oslo)
  const symbol = (ticker.includes('.')) ? ticker : ticker + '.OL';
  try {
    const response = await fetch(YAHOO_BASE + encodeURIComponent(symbol) + '?range=1d&interval=1d');
    if (!response.ok) return null;
    const data = await response.json() as YahooChartResult;
    return data.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

export async function fetchStockQuote(ticker: string): Promise<StockQuote | null> {
  const symbol = (ticker.includes('.')) ? ticker : ticker + '.OL';
  try {
    const response = await fetch(YAHOO_BASE + encodeURIComponent(symbol) + '?range=5d&interval=1d');
    if (!response.ok) return null;
    const data = await response.json() as YahooChartResult;
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const prev = meta.chartPreviousClose ?? null;
    const price = meta.regularMarketPrice;
    return {
      price,
      previousClose: prev,
      dayHigh: meta.regularMarketDayHigh ?? null,
      dayLow: meta.regularMarketDayLow ?? null,
      volume: meta.regularMarketVolume ?? null,
      weekHigh52: meta.fiftyTwoWeekHigh ?? null,
      weekLow52: meta.fiftyTwoWeekLow ?? null,
      dayChange: prev ? price - prev : null,
      dayChangePct: prev ? ((price - prev) / prev) * 100 : null,
    };
  } catch {
    return null;
  }
}

// --- Public API ---

/**
 * Fetch current prices for all holdings.
 * Strategy: static data first, then live Yahoo Finance as fallback.
 */
export async function fetchPricesForHoldings(
  tickers: Array<{ isin: string; ticker: string }>
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();

  // 1. Try static data files (fast, no CORS issues)
  const index = await fetchStockIndex();
  if (index) {
    for (const { isin, ticker } of tickers) {
      const entry = index.symbols[ticker];
      if (entry?.currentPrice) {
        prices.set(isin, entry.currentPrice);
      }
    }
  }

  // 2. For any missing prices, try live Yahoo Finance
  const missing = tickers.filter(t => !prices.has(t.isin));
  if (missing.length > 0) {
    const results = await Promise.allSettled(
      missing.map(async ({ isin, ticker }) => {
        const price = await fetchLivePrice(ticker);
        if (price !== null) {
          prices.set(isin, price);
        }
      })
    );
    void results;
  }

  return prices;
}

/**
 * Get historical dividends for a ticker from static data.
 */
export async function fetchDividendHistory(
  ticker: string
): Promise<Array<{ date: string; amount: number }>> {
  const data = await fetchStockData(ticker);
  return data?.dividends || [];
}

/**
 * Get historical prices for a ticker from static data.
 */
export async function fetchFundamentals(ticker: string): Promise<Fundamentals | null> {
  const data = await fetchStockData(ticker);
  return data?.fundamentals || null;
}

export async function fetchMarketData(ticker: string): Promise<{
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
} | null> {
  const data = await fetchStockData(ticker);
  if (!data) return null;
  return {
    previousClose: data.previousClose ?? null,
    dayHigh: data.dayHigh ?? null,
    dayLow: data.dayLow ?? null,
    volume: data.volume ?? null,
    fiftyTwoWeekHigh: data.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: data.fiftyTwoWeekLow ?? null,
  };
}

export async function fetchPriceHistory(
  ticker: string
): Promise<Array<{ date: string; close: number }>> {
  const data = await fetchStockData(ticker);
  return data?.prices || [];
}

/**
 * Get the closing price for a ticker on or closest before a given date.
 * Returns null if no data available.
 */
export async function fetchPriceForDate(
  ticker: string,
  date: string
): Promise<number | null> {
  const data = await fetchStockData(ticker);
  if (!data || data.prices.length === 0) return null;

  // Prices are sorted chronologically. Find the last price on or before the date.
  let best: number | null = null;
  for (const p of data.prices) {
    if (p.date <= date) {
      best = p.close;
    } else {
      break;
    }
  }
  return best;
}
