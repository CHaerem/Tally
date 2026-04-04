import { describe, it, expect } from 'vitest';
import { deriveHoldings, deriveCashFlows, derivePortfolioMetrics } from './holdings';
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
