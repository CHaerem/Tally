import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPricesForHoldings, fetchDividendHistory, fetchPriceHistory, fetchPriceForDate, _resetIndexCache } from './api';

// Reset module state between tests (indexCache)
beforeEach(() => {
  vi.restoreAllMocks();
  _resetIndexCache();
});

describe('fetchPricesForHoldings', () => {
  it('returns prices from static index when available', async () => {
    const mockIndex = {
      metadata: { lastUpdated: '2024-01-01', symbolCount: 2 },
      symbols: {
        'EQNR': { name: 'Equinor', currentPrice: 285.5, priceCount: 100, dividendCount: 10, lastDate: '2024-01-01', lastUpdated: '2024-01-01' },
        'DNB': { name: 'DNB', currentPrice: 192.3, priceCount: 100, dividendCount: 5, lastDate: '2024-01-01', lastUpdated: '2024-01-01' },
      },
    };

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockIndex) }) // index.json
    );

    const prices = await fetchPricesForHoldings([
      { isin: 'NO001', ticker: 'EQNR' },
      { isin: 'NO002', ticker: 'DNB' },
    ]);

    expect(prices.get('NO001')).toBe(285.5);
    expect(prices.get('NO002')).toBe(192.3);
  });

  it('falls back to Yahoo Finance for missing tickers', async () => {
    const mockIndex = {
      metadata: { lastUpdated: '2024-01-01', symbolCount: 1 },
      symbols: {
        'EQNR': { name: 'Equinor', currentPrice: 285.5, priceCount: 100, dividendCount: 10, lastDate: null, lastUpdated: '' },
      },
    };

    const yahooResponse = {
      chart: {
        result: [{ meta: { regularMarketPrice: 195.0, currency: 'NOK' } }],
        error: null,
      },
    };

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockIndex) }) // index.json
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(yahooResponse) }) // Yahoo for DNB
    );

    const prices = await fetchPricesForHoldings([
      { isin: 'NO001', ticker: 'EQNR' },
      { isin: 'NO002', ticker: 'DNB' },
    ]);

    expect(prices.get('NO001')).toBe(285.5); // from static
    expect(prices.get('NO002')).toBe(195.0); // from Yahoo
  });

  it('handles static data fetch failure gracefully', async () => {
    const yahooResponse = {
      chart: {
        result: [{ meta: { regularMarketPrice: 285.5, currency: 'NOK' } }],
        error: null,
      },
    };

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false }) // index.json fails
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(yahooResponse) }) // Yahoo
    );

    const prices = await fetchPricesForHoldings([
      { isin: 'NO001', ticker: 'EQNR' },
    ]);

    expect(prices.get('NO001')).toBe(285.5);
  });

  it('handles complete fetch failure gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const prices = await fetchPricesForHoldings([
      { isin: 'NO001', ticker: 'EQNR' },
    ]);

    expect(prices.size).toBe(0);
  });

  it('returns empty map for empty tickers array', async () => {
    const prices = await fetchPricesForHoldings([]);
    expect(prices.size).toBe(0);
  });

  it('appends .OL suffix for Yahoo Finance', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false }) // index fails
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({
        chart: { result: [{ meta: { regularMarketPrice: 100, currency: 'NOK' } }], error: null }
      })})
    );

    await fetchPricesForHoldings([{ isin: 'NO001', ticker: 'EQNR' }]);

    const calls = (fetch as any).mock.calls;
    const yahooCall = calls.find((c: string[]) => c[0].includes('yahoo'));
    expect(yahooCall[0]).toContain('EQNR.OL');
  });
});

describe('fetchDividendHistory', () => {
  it('returns dividends from static data', async () => {
    const mockData = {
      ticker: 'EQNR', name: 'Equinor', currency: 'NOK', currentPrice: 285,
      prices: [], lastUpdated: '2024-01-01',
      dividends: [
        { date: '2023-06-15', amount: 8.7 },
        { date: '2023-12-15', amount: 9.2 },
      ],
    };

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) })
    );

    const divs = await fetchDividendHistory('EQNR');
    expect(divs).toHaveLength(2);
    expect(divs[0].amount).toBe(8.7);
    expect(divs[1].date).toBe('2023-12-15');
  });

  it('returns empty array when no data available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false }));

    const divs = await fetchDividendHistory('UNKNOWN');
    expect(divs).toEqual([]);
  });
});

describe('fetchPriceHistory', () => {
  it('returns price history from static data', async () => {
    const mockData = {
      ticker: 'EQNR', name: 'Equinor', currency: 'NOK', currentPrice: 285,
      dividends: [], lastUpdated: '2024-01-01',
      prices: [
        { date: '2024-01-02', close: 280.5 },
        { date: '2024-01-03', close: 282.1 },
      ],
    };

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) })
    );

    const prices = await fetchPriceHistory('EQNR');
    expect(prices).toHaveLength(2);
    expect(prices[0].close).toBe(280.5);
  });

  it('returns empty array on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));

    const prices = await fetchPriceHistory('EQNR');
    expect(prices).toEqual([]);
  });
});

describe('fetchPriceForDate', () => {
  it('returns closest price on or before given date', async () => {
    const mockData = {
      ticker: 'EQNR', name: 'Equinor', currency: 'NOK', currentPrice: 300,
      prices: [
        { date: '2025-03-05', close: 275.0 },
        { date: '2025-03-06', close: 278.0 },
        { date: '2025-03-07', close: 280.5 },
        { date: '2025-03-10', close: 282.0 },
      ],
      dividends: [], lastUpdated: '2025-03-10',
    };

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) })
    );

    const price = await fetchPriceForDate('EQNR', '2025-03-07');
    expect(price).toBe(280.5);
  });

  it('returns closest earlier price when exact date not available', async () => {
    const mockData = {
      ticker: 'EQNR', name: 'Equinor', currency: 'NOK', currentPrice: 300,
      prices: [
        { date: '2025-03-05', close: 275.0 },
        { date: '2025-03-07', close: 280.5 },
        { date: '2025-03-10', close: 282.0 },
      ],
      dividends: [], lastUpdated: '2025-03-10',
    };

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) })
    );

    // Weekend date - should return Friday's price
    const price = await fetchPriceForDate('EQNR', '2025-03-08');
    expect(price).toBe(280.5);
  });

  it('returns null when no static data file exists (e.g. fund without data)', async () => {
    // Simulates KLP AksjeAsia Indeks Valutasikret (0P00017YPW.IR) which has no data file
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false }) // 404 - file not found
    );

    const price = await fetchPriceForDate('0P00017YPW.IR', '2025-03-07');
    expect(price).toBeNull();
  });

  it('converts fund ticker dots to underscores in filename', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false })
    );

    await fetchPriceForDate('0P00017YPW.IR', '2025-03-07');

    const calls = (fetch as any).mock.calls;
    // Should request 0P00017YPW_IR.json (dots replaced with underscores)
    expect(calls[0][0]).toContain('0P00017YPW_IR.json');
  });
});

describe('fund price fetching (KLP AksjeAsia Indeks Valutasikret scenario)', () => {
  it('fetches fund live price via Yahoo Finance with .IR suffix', async () => {
    const mockIndex = {
      metadata: { lastUpdated: '2025-03-07', symbolCount: 1 },
      symbols: {}, // Fund not in index
    };
    const yahooResponse = {
      chart: {
        result: [{ meta: { regularMarketPrice: 2199.20, currency: 'NOK' } }],
        error: null,
      },
    };

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockIndex) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(yahooResponse) })
    );

    const prices = await fetchPricesForHoldings([
      { isin: 'MANUAL_0P00017YPW.IR', ticker: '0P00017YPW.IR' },
    ]);

    expect(prices.get('MANUAL_0P00017YPW.IR')).toBe(2199.20);

    // Verify Yahoo Finance was called with the .IR suffix (not .OL)
    const calls = (fetch as any).mock.calls;
    const yahooCall = calls.find((c: string[]) => c[0].includes('yahoo'));
    expect(yahooCall[0]).toContain('0P00017YPW.IR');
    expect(yahooCall[0]).not.toContain('.OL');
  });

  it('fund not in static index falls back to Yahoo Finance', async () => {
    const mockIndex = {
      metadata: { lastUpdated: '2025-03-07', symbolCount: 0 },
      symbols: {}, // No funds in index
    };

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockIndex) })
      .mockResolvedValueOnce({ ok: false }) // Yahoo also fails
    );

    const prices = await fetchPricesForHoldings([
      { isin: 'MANUAL_0P00017YPW.IR', ticker: '0P00017YPW.IR' },
    ]);

    // No price available from either source
    expect(prices.has('MANUAL_0P00017YPW.IR')).toBe(false);
  });
});
