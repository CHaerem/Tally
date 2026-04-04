const BASE_URL = import.meta.env.BASE_URL || '/Tally/';
const DATA_URL = BASE_URL + 'data/';
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

// --- Types for static data files ---

interface StockDataFile {
  ticker: string;
  name: string;
  currency: string;
  currentPrice: number | null;
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
  try {
    const res = await fetch(DATA_URL + encodeURIComponent(ticker) + '.json');
    if (!res.ok) return null;
    return await res.json() as StockDataFile;
  } catch {
    return null;
  }
}

// --- Live price fallback (Yahoo Finance) ---

interface YahooChartResult {
  chart: {
    result: Array<{
      meta: { regularMarketPrice: number; currency: string };
    }> | null;
    error: { description: string } | null;
  };
}

async function fetchLivePrice(ticker: string): Promise<number | null> {
  const symbol = ticker.endsWith('.OL') ? ticker : ticker + '.OL';
  try {
    const response = await fetch(YAHOO_BASE + encodeURIComponent(symbol) + '?range=1d&interval=1d');
    if (!response.ok) return null;
    const data = await response.json() as YahooChartResult;
    return data.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
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
