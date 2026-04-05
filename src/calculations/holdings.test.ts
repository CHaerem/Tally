import { describe, it, expect } from 'vitest';
import { deriveHoldings, deriveCashFlows, derivePortfolioMetrics, calculatePeriodXIRR, getPeriodStartDate, deriveDividendSummary, buildMissingDividendEvents } from './holdings';
import type { ReturnPeriod } from './holdings';
import type { TradeEvent, DividendEvent, CashEvent, FeeEvent, Instrument } from '../types';

function makeTrade(overrides: Partial<TradeEvent> & Pick<TradeEvent, 'type' | 'isin' | 'quantity' | 'pricePerShare' | 'amount' | 'date'>): TradeEvent {
  return {
    id: 'evt_' + Math.random().toString(36).substring(2),
    accountId: 'default',
    currency: 'NOK',
    createdAt: new Date().toISOString(),
    source: 'MANUAL',
    ...overrides,
  };
}

function makeDividend(isin: string, amount: number, date: string): DividendEvent {
  return {
    id: 'evt_div_' + Math.random().toString(36).substring(2),
    accountId: 'default', type: 'DIVIDEND', date, amount, currency: 'NOK',
    createdAt: new Date().toISOString(), source: 'MANUAL',
    isin, quantity: 100, perShare: amount / 100,
  };
}

function makeCash(type: 'CASH_IN' | 'CASH_OUT', amount: number, date: string): CashEvent {
  return {
    id: 'evt_cash_' + Math.random().toString(36).substring(2),
    accountId: 'default', type, date, amount, currency: 'NOK',
    createdAt: new Date().toISOString(), source: 'MANUAL',
  };
}

function makeFee(amount: number, date: string): FeeEvent {
  return {
    id: 'evt_fee_' + Math.random().toString(36).substring(2),
    accountId: 'default', type: 'FEE', date, amount, currency: 'NOK',
    createdAt: new Date().toISOString(), source: 'MANUAL',
    description: 'Test fee',
  };
}

const instruments: Instrument[] = [
  { isin: 'NO001', ticker: 'EQNR', name: 'Equinor ASA', currency: 'NOK' },
  { isin: 'NO002', ticker: 'DNB', name: 'DNB Bank ASA', currency: 'NOK' },
];

describe('deriveHoldings', () => {
  it('returns empty array with no events', () => {
    expect(deriveHoldings([], instruments, new Map())).toEqual([]);
  });

  it('derives single holding from one buy', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 280, amount: 28000, date: '2023-01-15' }),
    ];
    const holdings = deriveHoldings(events, instruments, new Map());
    expect(holdings).toHaveLength(1);
    expect(holdings[0].ticker).toBe('EQNR');
    expect(holdings[0].quantity).toBe(100);
    expect(holdings[0].costBasis).toBe(28000);
    expect(holdings[0].averageCostPerShare).toBe(280);
  });

  it('includes fees in cost basis', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 280, amount: 28000, date: '2023-01-15', fee: 29 }),
    ];
    const holdings = deriveHoldings(events, instruments, new Map());
    expect(holdings[0].costBasis).toBe(28029);
  });

  it('calculates market value with current prices', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 280, amount: 28000, date: '2023-01-15' }),
    ];
    const prices = new Map([['NO001', 300]]);
    const holdings = deriveHoldings(events, instruments, prices);
    expect(holdings[0].currentPrice).toBe(300);
    expect(holdings[0].marketValue).toBe(30000);
    expect(holdings[0].unrealizedGain).toBe(2000);
  });

  it('handles partial sell (FIFO cost basis)', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 200, amount: 20000, date: '2023-01-15' }),
      makeTrade({ type: 'TRADE_SELL', isin: 'NO001', quantity: 50, pricePerShare: 250, amount: 12500, date: '2023-06-15' }),
    ];
    const holdings = deriveHoldings(events, instruments, new Map());
    expect(holdings[0].quantity).toBe(50);
    expect(holdings[0].costBasis).toBe(10000); // Half the original cost
  });

  it('removes holding when fully sold', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 200, amount: 20000, date: '2023-01-15' }),
      makeTrade({ type: 'TRADE_SELL', isin: 'NO001', quantity: 100, pricePerShare: 250, amount: 25000, date: '2023-06-15' }),
    ];
    const holdings = deriveHoldings(events, instruments, new Map());
    expect(holdings).toHaveLength(0);
  });

  it('accumulates dividends per holding', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 280, amount: 28000, date: '2023-01-15' }),
      makeDividend('NO001', 870, '2023-06-15'),
      makeDividend('NO001', 920, '2023-12-15'),
    ];
    const holdings = deriveHoldings(events, instruments, new Map());
    expect(holdings[0].totalDividendsReceived).toBe(1790);
  });

  it('handles multiple instruments', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 50, pricePerShare: 280, amount: 14000, date: '2023-01-15' }),
      makeTrade({ type: 'TRADE_BUY', isin: 'NO002', quantity: 200, pricePerShare: 180, amount: 36000, date: '2023-01-20' }),
    ];
    const prices = new Map([['NO001', 300], ['NO002', 190]]);
    const holdings = deriveHoldings(events, instruments, prices);
    expect(holdings).toHaveLength(2);
    // Sorted by market value desc: DNB (200*190=38000) > EQNR (50*300=15000)
    expect(holdings[0].ticker).toBe('DNB');
    expect(holdings[1].ticker).toBe('EQNR');
  });
});

describe('deriveCashFlows', () => {
  it('maps CASH_IN as negative (outflow)', () => {
    const events = [makeCash('CASH_IN', 50000, '2023-01-01')];
    const flows = deriveCashFlows(events, 0);
    expect(flows[0].amount).toBe(-50000);
  });

  it('maps CASH_OUT as positive (inflow)', () => {
    const events = [makeCash('CASH_OUT', 10000, '2023-06-01')];
    const flows = deriveCashFlows(events, 0);
    expect(flows[0].amount).toBe(10000);
  });

  it('maps TRADE_BUY as negative', () => {
    const events = [makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 280, amount: 28000, date: '2023-01-15', fee: 29 })];
    const flows = deriveCashFlows(events, 0);
    expect(flows[0].amount).toBe(-28029);
  });

  it('maps TRADE_SELL as positive', () => {
    const events = [makeTrade({ type: 'TRADE_SELL', isin: 'NO001', quantity: 100, pricePerShare: 300, amount: 30000, date: '2023-06-15' })];
    const flows = deriveCashFlows(events, 0);
    expect(flows[0].amount).toBe(30000);
  });

  it('maps DIVIDEND as positive', () => {
    const events = [makeDividend('NO001', 870, '2023-06-15')];
    const flows = deriveCashFlows(events, 0);
    expect(flows[0].amount).toBe(870);
  });

  it('maps FEE as negative', () => {
    const events = [makeFee(100, '2023-06-15')];
    const flows = deriveCashFlows(events, 0);
    expect(flows[0].amount).toBe(-100);
  });

  it('adds terminal value as final positive flow', () => {
    const events = [makeCash('CASH_IN', 50000, '2023-01-01')];
    const terminalDate = new Date('2024-01-01');
    const flows = deriveCashFlows(events, 60000, terminalDate);
    expect(flows).toHaveLength(2);
    expect(flows[1].amount).toBe(60000);
    expect(flows[1].date).toEqual(terminalDate);
  });
});

describe('derivePortfolioMetrics', () => {
  it('sums invested and withdrawn amounts', () => {
    const events = [
      makeCash('CASH_IN', 50000, '2023-01-01'),
      makeCash('CASH_IN', 20000, '2023-06-01'),
      makeCash('CASH_OUT', 5000, '2023-09-01'),
    ];
    const metrics = derivePortfolioMetrics(events, []);
    expect(metrics.totalInvested).toBe(70000);
    expect(metrics.totalWithdrawn).toBe(5000);
    expect(metrics.netCashFlow).toBe(65000);
  });

  it('sums dividends from events', () => {
    const events = [
      makeDividend('NO001', 870, '2023-06-15'),
      makeDividend('NO001', 920, '2023-12-15'),
    ];
    const metrics = derivePortfolioMetrics(events, []);
    expect(metrics.totalDividends).toBe(1790);
  });

  it('sums fees from fee events and trade fees', () => {
    const events = [
      makeFee(100, '2023-03-01'),
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 280, amount: 28000, date: '2023-01-15', fee: 29 }),
    ];
    const metrics = derivePortfolioMetrics(events, []);
    expect(metrics.totalFees).toBe(129);
  });

  it('calculates current value from holdings', () => {
    const holdings = [
      { isin: 'NO001', ticker: 'EQNR', name: 'Equinor', quantity: 100, costBasis: 28000, averageCostPerShare: 280, currentPrice: 300, marketValue: 30000, unrealizedGain: 2000, unrealizedGainPercent: 7.14, totalDividendsReceived: 0 },
    ];
    const metrics = derivePortfolioMetrics([], holdings);
    expect(metrics.currentValue).toBe(30000);
  });
});

describe('getPeriodStartDate', () => {
  it('returns null for total', () => {
    expect(getPeriodStartDate('total')).toBeNull();
  });

  it('returns Jan 1 of current year for ytd', () => {
    const start = getPeriodStartDate('ytd')!;
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(start.getFullYear()).toBe(new Date().getFullYear());
  });

  it('returns correct date for 1y, 3y, 5y', () => {
    const now = new Date();
    for (const [period, years] of [['1y', 1], ['3y', 3], ['5y', 5]] as [ReturnPeriod, number][]) {
      const start = getPeriodStartDate(period)!;
      expect(start.getFullYear()).toBe(now.getFullYear() - years);
    }
  });
});

describe('calculatePeriodXIRR', () => {
  it('returns total XIRR for total period', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 100, amount: 10000, date: '2023-01-01' }),
    ];
    const result = calculatePeriodXIRR(events, 'total', 12000, null);
    expect(result).not.toBeNull();
  });

  it('returns null when no portfolio history for non-total period', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 100, amount: 10000, date: '2023-01-01' }),
    ];
    const result = calculatePeriodXIRR(events, '1y', 12000, null);
    expect(result).toBeNull();
  });

  it('calculates period XIRR with portfolio history', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 100, amount: 10000, date: '2020-01-01' }),
    ];
    const series = [
      { date: '2020-01-01', value: 10000 },
      { date: '2024-01-01', value: 11000 },
      { date: '2025-01-01', value: 12000 },
    ];
    const result = calculatePeriodXIRR(events, '1y', 13000, series);
    expect(result).not.toBeNull();
    // From 12000 to 13000 over ~1 year is ~8.3% return
    expect(result!).toBeGreaterThan(0);
  });

  it('handles period with events in range', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 100, amount: 10000, date: '2020-01-01' }),
      makeDividend('NO001', 500, '2025-03-01'),
    ];
    const series = [
      { date: '2020-01-01', value: 10000 },
      { date: '2024-12-31', value: 11000 },
    ];
    const result = calculatePeriodXIRR(events, 'ytd', 11500, series);
    expect(result).not.toBeNull();
  });
});

describe('deriveDividendSummary', () => {
  const holdings = [
    { isin: 'NO001', ticker: 'EQNR', name: 'Equinor ASA', quantity: 100, costBasis: 28000, averageCostPerShare: 280, currentPrice: 300, marketValue: 30000, unrealizedGain: 2000, unrealizedGainPercent: 7.14, totalDividendsReceived: 1500 },
    { isin: 'NO002', ticker: 'DNB', name: 'DNB Bank ASA', quantity: 50, costBasis: 10000, averageCostPerShare: 200, currentPrice: 220, marketValue: 11000, unrealizedGain: 1000, unrealizedGainPercent: 10, totalDividendsReceived: 500 },
  ];

  it('returns zero totalAllTime with no dividends', () => {
    const result = deriveDividendSummary([], instruments, []);
    expect(result.totalAllTime).toBe(0);
    expect(result.byYear).toEqual([]);
    expect(result.byHolding).toEqual([]);
  });

  it('groups dividends by year', () => {
    const events = [
      makeDividend('NO001', 500, '2023-06-15'),
      makeDividend('NO001', 600, '2024-06-15'),
      makeDividend('NO001', 400, '2024-12-15'),
    ];
    const result = deriveDividendSummary(events, instruments, holdings);
    expect(result.totalAllTime).toBe(1500);
    expect(result.byYear).toHaveLength(2);
    expect(result.byYear[0]).toEqual({ year: 2023, total: 500 });
    expect(result.byYear[1]).toEqual({ year: 2024, total: 1000 });
  });

  it('groups dividends by holding with yield on cost', () => {
    const events = [
      makeDividend('NO001', 1000, '2024-06-15'),
      makeDividend('NO002', 300, '2024-06-15'),
    ];
    const result = deriveDividendSummary(events, instruments, holdings);
    expect(result.byHolding).toHaveLength(2);
    // Sorted by total descending
    expect(result.byHolding[0].ticker).toBe('EQNR');
    expect(result.byHolding[0].total).toBe(1000);
    // YoC: 1000 / 28000 * 100 ≈ 3.57%
    expect(result.byHolding[0].yieldOnCost).toBeCloseTo(3.57, 1);
    expect(result.byHolding[1].ticker).toBe('DNB');
    expect(result.byHolding[1].total).toBe(300);
  });

  it('handles yield on cost when no matching holding', () => {
    const events = [
      makeDividend('NO999', 200, '2024-01-01'),
    ];
    const result = deriveDividendSummary(events, instruments, []);
    expect(result.byHolding[0].yieldOnCost).toBeNull();
  });

  it('sorts years ascending', () => {
    const events = [
      makeDividend('NO001', 100, '2025-01-01'),
      makeDividend('NO001', 200, '2022-01-01'),
      makeDividend('NO001', 300, '2024-01-01'),
    ];
    const result = deriveDividendSummary(events, instruments, holdings);
    expect(result.byYear.map(y => y.year)).toEqual([2022, 2024, 2025]);
  });
});

describe('buildMissingDividendEvents', () => {
  let idCounter = 0;
  const genId = () => 'test_' + (++idCounter);

  it('returns empty when no trades exist', () => {
    const history = [{ date: '2024-06-15', amount: 8.7 }];
    const result = buildMissingDividendEvents([], 'NO001', history, genId);
    expect(result).toEqual([]);
  });

  it('creates events for dividends after first buy', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 280, amount: 28000, date: '2023-01-15' }),
    ];
    const history = [
      { date: '2022-06-15', amount: 8.0 },  // before buy — skip
      { date: '2023-06-15', amount: 8.7 },  // after buy
      { date: '2024-06-15', amount: 9.2 },  // after buy
    ];
    const result = buildMissingDividendEvents(events, 'NO001', history, genId);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2023-06-15');
    expect(result[0].amount).toBe(870);   // 8.7 * 100
    expect(result[0].quantity).toBe(100);
    expect(result[1].date).toBe('2024-06-15');
    expect(result[1].amount).toBe(920);   // 9.2 * 100
  });

  it('skips already existing dividend events', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 280, amount: 28000, date: '2023-01-15' }),
      makeDividend('NO001', 870, '2023-06-15'),
    ];
    const history = [
      { date: '2023-06-15', amount: 8.7 },
      { date: '2024-06-15', amount: 9.2 },
    ];
    const result = buildMissingDividendEvents(events, 'NO001', history, genId);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-06-15');
  });

  it('tracks quantity changes from buys and sells', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 280, amount: 28000, date: '2023-01-01' }),
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 50, pricePerShare: 290, amount: 14500, date: '2023-06-01' }),
      makeTrade({ type: 'TRADE_SELL', isin: 'NO001', quantity: 30, pricePerShare: 300, amount: 9000, date: '2024-03-01' }),
    ];
    const history = [
      { date: '2023-03-15', amount: 10 },  // qty = 100
      { date: '2023-09-15', amount: 10 },  // qty = 150
      { date: '2024-06-15', amount: 10 },  // qty = 120
    ];
    const result = buildMissingDividendEvents(events, 'NO001', history, genId);
    expect(result).toHaveLength(3);
    expect(result[0].amount).toBe(1000);  // 10 * 100
    expect(result[1].amount).toBe(1500);  // 10 * 150
    expect(result[2].amount).toBe(1200);  // 10 * 120
  });

  it('skips dividends when position is fully sold', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 280, amount: 28000, date: '2023-01-01' }),
      makeTrade({ type: 'TRADE_SELL', isin: 'NO001', quantity: 100, pricePerShare: 300, amount: 30000, date: '2023-06-01' }),
    ];
    const history = [
      { date: '2023-09-15', amount: 8.7 },  // no shares held
    ];
    const result = buildMissingDividendEvents(events, 'NO001', history, genId);
    expect(result).toEqual([]);
  });

  it('only looks at trades for the specified ISIN', () => {
    const events = [
      makeTrade({ type: 'TRADE_BUY', isin: 'NO001', quantity: 100, pricePerShare: 280, amount: 28000, date: '2023-01-01' }),
      makeTrade({ type: 'TRADE_BUY', isin: 'NO002', quantity: 50, pricePerShare: 200, amount: 10000, date: '2023-01-01' }),
    ];
    const history = [{ date: '2023-06-15', amount: 10 }];
    const result = buildMissingDividendEvents(events, 'NO001', history, genId);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(100); // only NO001 shares
  });
});
