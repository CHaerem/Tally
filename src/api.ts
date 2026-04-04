const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

interface YahooChartResult {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        currency: string;
      };
    }> | null;
    error: { description: string } | null;
  };
}

export async function fetchCurrentPrice(ticker: string): Promise<number | null> {
  const symbol = ticker.endsWith('.OL') ? ticker : ticker + '.OL';
  try {
    const response = await fetch(YAHOO_BASE + encodeURIComponent(symbol) + '?range=1d&interval=1d');
    if (!response.ok) return null;
    const data = await response.json() as YahooChartResult;
    const result = data.chart?.result?.[0];
    return result?.meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

export async function fetchPricesForHoldings(
  tickers: Array<{ isin: string; ticker: string }>
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  const results = await Promise.allSettled(
    tickers.map(async ({ isin, ticker }) => {
      const price = await fetchCurrentPrice(ticker);
      if (price !== null) {
        prices.set(isin, price);
      }
    })
  );
  // Ignore individual failures — partial results are fine
  void results;
  return prices;
}
