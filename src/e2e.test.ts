// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerStorage } from './ledger';
import { deriveHoldings, derivePortfolioMetrics, deriveRealizedGains, deriveGainsByYear } from './calculations';
import type { TradeEvent, DividendEvent, CashEvent, Instrument } from './types';

beforeEach(() => {
  localStorage.clear();
});

// Helper to create trade events concisely
function buy(id: string, isin: string, date: string, qty: number, price: number, fee = 0): TradeEvent {
  return {
    id, accountId: 'default', date, type: 'TRADE_BUY',
    amount: qty * price, currency: 'NOK', createdAt: '', source: 'MANUAL',
    isin, quantity: qty, pricePerShare: price, fee: fee || undefined,
  } as TradeEvent;
}

function sell(id: string, isin: string, date: string, qty: number, price: number, fee = 0): TradeEvent {
  return {
    id, accountId: 'default', date, type: 'TRADE_SELL',
    amount: qty * price, currency: 'NOK', createdAt: '', source: 'MANUAL',
    isin, quantity: qty, pricePerShare: price, fee: fee || undefined,
  } as TradeEvent;
}

function dividend(id: string, isin: string, date: string, qty: number, perShare: number): DividendEvent {
  return {
    id, accountId: 'default', date, type: 'DIVIDEND',
    amount: qty * perShare, currency: 'NOK', createdAt: '', source: 'MANUAL',
    isin, quantity: qty, perShare,
  };
}

function cashIn(id: string, date: string, amount: number): CashEvent {
  return {
    id, accountId: 'default', date, type: 'CASH_IN',
    amount, currency: 'NOK', createdAt: '', source: 'MANUAL',
  };
}

function setupInstrument(isin: string, ticker: string, name: string): Instrument {
  const inst: Instrument = { isin, ticker, name, currency: 'NOK' };
  LedgerStorage.upsertInstrument(inst);
  return inst;
}

describe('E2E Scenario 1: Enkel portefolje - ett kjop', () => {
  it('single buy with current price gives correct holding values', () => {
    LedgerStorage.initializeLedger();
    const isin = 'NO0010096985';
    setupInstrument(isin, 'EQNR', 'Equinor ASA');
    LedgerStorage.addEvents([buy('e1', isin, '2025-01-15', 100, 280.50)]);

    const ledger = LedgerStorage.loadLedger()!;
    const prices = new Map([[isin, 399.10]]);
    const holdings = deriveHoldings(ledger.events, ledger.instruments, prices);

    expect(holdings).toHaveLength(1);
    const h = holdings[0];
    expect(h.quantity).toBe(100);
    expect(h.costBasis).toBe(28050);
    expect(h.marketValue).toBeCloseTo(39910, 0);
    expect(h.unrealizedGain).toBeCloseTo(11860, 0);
    expect(h.unrealizedGainPercent).toBeCloseTo(42.28, 1);
  });
});

describe('E2E Scenario 2: Flere kjop pa samme aksje', () => {
  it('multiple buys yield correct average cost and totals', () => {
    LedgerStorage.initializeLedger();
    const isin = 'NO0010657505';
    setupInstrument(isin, 'DNB', 'DNB Bank ASA');
    LedgerStorage.addEvents([
      buy('e1', isin, '2024-03-01', 50, 180),
      buy('e2', isin, '2024-09-01', 50, 220),
    ]);

    const ledger = LedgerStorage.loadLedger()!;
    const prices = new Map([[isin, 304.30]]);
    const holdings = deriveHoldings(ledger.events, ledger.instruments, prices);

    expect(holdings).toHaveLength(1);
    const h = holdings[0];
    expect(h.quantity).toBe(100);
    expect(h.averageCostPerShare).toBeCloseTo(200, 0);
    expect(h.costBasis).toBeCloseTo(20000, 0);
    expect(h.marketValue).toBeCloseTo(30430, 0);
    expect(h.unrealizedGain).toBeCloseTo(10430, 0);
  });
});

describe('E2E Scenario 3: Kjop + salg (realisert gevinst)', () => {
  it('buy then partial sell gives correct holding and realized gain (FIFO)', () => {
    LedgerStorage.initializeLedger();
    const isin = 'NO0005052605';
    setupInstrument(isin, 'MOWI', 'Mowi ASA');
    LedgerStorage.addEvents([
      buy('e1', isin, '2024-01-01', 100, 150),
      sell('e2', isin, '2024-06-01', 40, 200),
    ]);

    const ledger = LedgerStorage.loadLedger()!;
    const prices = new Map([[isin, 223.80]]);
    const holdings = deriveHoldings(ledger.events, ledger.instruments, prices);

    // deriveHoldings uses average cost: avg=150, sell 40 removes 40*150=6000
    // remaining: 60 shares, costBasis = 15000 - 6000 = 9000
    expect(holdings).toHaveLength(1);
    const h = holdings[0];
    expect(h.quantity).toBe(60);
    expect(h.costBasis).toBeCloseTo(9000, 0);
    expect(h.marketValue).toBeCloseTo(13428, 0);

    // Realized gains use FIFO (same result here since single lot)
    const gains = deriveRealizedGains(ledger.events, ledger.instruments);
    expect(gains).toHaveLength(1);
    expect(gains[0].saleProceeds).toBe(8000);
    expect(gains[0].costBasis).toBeCloseTo(6000, 0); // 40 * 150 FIFO
    expect(gains[0].realizedGain).toBeCloseTo(2000, 0);
  });
});

describe('E2E Scenario 4: FIFO med flere kjopspriser', () => {
  it('FIFO consumes oldest lots first on sell', () => {
    LedgerStorage.initializeLedger();
    const isin = 'NO0005076696';
    setupInstrument(isin, 'YAR', 'Yara International ASA');
    LedgerStorage.addEvents([
      buy('e1', isin, '2024-01-01', 30, 400),
      buy('e2', isin, '2024-04-01', 30, 500),
      buy('e3', isin, '2024-07-01', 40, 600),
      sell('e4', isin, '2024-10-01', 50, 550),
    ]);

    const ledger = LedgerStorage.loadLedger()!;

    // FIFO realized gains: sell 50 → consume 30@400 + 20@500 = 12000+10000 = 22000
    const gains = deriveRealizedGains(ledger.events, ledger.instruments);
    expect(gains).toHaveLength(1);
    expect(gains[0].saleProceeds).toBe(27500); // 50 * 550
    expect(gains[0].costBasis).toBeCloseTo(22000, 0);
    expect(gains[0].realizedGain).toBeCloseTo(5500, 0);

    // Remaining after FIFO: 10@500 + 40@600 = 50 shares
    // deriveHoldings uses avg cost, not FIFO, so check differently:
    // Total bought: 30*400 + 30*500 + 40*600 = 12000+15000+24000 = 51000 for 100 shares, avg=510
    // Sell 50 at avg 510 = 25500 removed → remaining costBasis = 51000 - 25500 = 25500
    const prices = new Map([[isin, 580]]);
    const holdings = deriveHoldings(ledger.events, ledger.instruments, prices);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].quantity).toBe(50);
    expect(holdings[0].costBasis).toBeCloseTo(25500, 0);
  });
});

describe('E2E Scenario 5: Utbytte', () => {
  it('dividend is tracked and included in total return', () => {
    LedgerStorage.initializeLedger();
    const isin = 'NO0010096985';
    setupInstrument(isin, 'STB', 'Storebrand ASA');
    LedgerStorage.addEvents([
      buy('e1', isin, '2024-01-01', 200, 80),
      dividend('e2', isin, '2024-06-15', 200, 3.50),
    ]);

    const ledger = LedgerStorage.loadLedger()!;
    const prices = new Map([[isin, 90]]);
    const holdings = deriveHoldings(ledger.events, ledger.instruments, prices);

    expect(holdings).toHaveLength(1);
    const h = holdings[0];
    expect(h.totalDividendsReceived).toBe(700);
    expect(h.costBasis).toBe(16000);
    expect(h.marketValue).toBe(18000);
    expect(h.unrealizedGain).toBe(2000);

    // Total return = unrealized gain + dividends
    const totalReturn = h.unrealizedGain + h.totalDividendsReceived;
    expect(totalReturn).toBe(2700);

    // Portfolio metrics should also reflect dividends
    const metrics = derivePortfolioMetrics(ledger.events, holdings);
    expect(metrics.totalDividends).toBe(700);
  });
});

describe('E2E Scenario 6: Fond (ikke aksje)', () => {
  it('handles fractional fund units correctly', () => {
    LedgerStorage.initializeLedger();
    const isin = 'NO0010165335';
    setupInstrument(isin, 'KLPAKSJEA', 'KLP AksjeAsia Indeks');
    // Kjop 38.3544 andeler @ 2199.20 kr
    const qty = 38.3544;
    const price = 2199.20;
    LedgerStorage.addEvents([buy('e1', isin, '2025-03-07', qty, price)]);

    const ledger = LedgerStorage.loadLedger()!;
    const currentPrice = 2828.39;
    const prices = new Map([[isin, currentPrice]]);
    const holdings = deriveHoldings(ledger.events, ledger.instruments, prices);

    expect(holdings).toHaveLength(1);
    const h = holdings[0];
    expect(h.quantity).toBeCloseTo(38.3544, 4);
    // costBasis = 38.3544 * 2199.20 = ~84349.28
    expect(h.costBasis).toBeCloseTo(84349, 0);
    // marketValue = 38.3544 * 2828.39 = ~108481
    expect(h.marketValue).toBeCloseTo(108481, 0);
  });
});

describe('E2E Scenario 7: Full portefolje med metrics', () => {
  it('combined portfolio calculates metrics with XIRR and allocation', () => {
    LedgerStorage.initializeLedger();
    const eqnr = 'NO0010096985';
    const dnb = 'NO0010657505';
    const fund = 'NO0010165335';
    setupInstrument(eqnr, 'EQNR', 'Equinor ASA');
    setupInstrument(dnb, 'DNB', 'DNB Bank ASA');
    setupInstrument(fund, 'KLPAKSJEA', 'KLP AksjeAsia Indeks');

    LedgerStorage.addEvents([
      cashIn('c1', '2024-01-01', 100000),
      buy('e1', eqnr, '2024-01-15', 100, 280, 29),
      buy('e2', dnb, '2024-02-01', 50, 200, 29),
      buy('e3', fund, '2024-03-01', 10, 2000),
    ]);

    const ledger = LedgerStorage.loadLedger()!;
    const prices = new Map([
      [eqnr, 300],
      [dnb, 220],
      [fund, 2200],
    ]);
    const holdings = deriveHoldings(ledger.events, ledger.instruments, prices);

    expect(holdings).toHaveLength(3);

    const metrics = derivePortfolioMetrics(ledger.events, holdings);
    expect(metrics.totalInvested).toBe(100000);
    expect(metrics.currentValue).toBeGreaterThan(0);
    // XIRR should be calculable
    expect(metrics.xirr).not.toBeNull();

    // Allocation should sum to 100%
    const totalValue = holdings.reduce((s, h) => s + h.marketValue, 0);
    const allocationSum = holdings.reduce((s, h) => s + (h.marketValue / totalValue) * 100, 0);
    expect(allocationSum).toBeCloseTo(100, 5);
  });
});

describe('E2E Scenario 8: Realisert gevinst per ar', () => {
  it('groups realized gains by year correctly', () => {
    LedgerStorage.initializeLedger();
    const isin = 'NO0010096985';
    setupInstrument(isin, 'EQNR', 'Equinor ASA');

    LedgerStorage.addEvents([
      buy('e1', isin, '2024-01-01', 100, 200),
      sell('e2', isin, '2024-06-01', 50, 250),  // 2024: gain = 50*250 - 50*200 = 2500
      buy('e3', isin, '2025-01-15', 50, 220),
      sell('e4', isin, '2025-06-01', 50, 300),   // 2025: FIFO takes from remaining 50@200 lot
    ]);

    const ledger = LedgerStorage.loadLedger()!;
    const gainsByYear = deriveGainsByYear(ledger.events, ledger.instruments);

    expect(gainsByYear.length).toBe(2);

    const y2024 = gainsByYear.find(g => g.year === 2024)!;
    const y2025 = gainsByYear.find(g => g.year === 2025)!;

    expect(y2024).toBeDefined();
    expect(y2025).toBeDefined();

    // 2024: sell 50@250, FIFO cost 50@200 = 10000, proceeds 12500, gain 2500
    expect(y2024.netGain).toBeCloseTo(2500, 0);

    // 2025: sell 50@300 = 15000, FIFO: remaining 50@200 lot still exists
    // (only 50 of 100 were sold in 2024). cost = 50*200 = 10000, gain = 5000
    expect(y2025.netGain).toBeCloseTo(5000, 0);
  });
});

describe('E2E Scenario 9: Tom portefolje', () => {
  it('empty portfolio returns no holdings and null/zero metrics', () => {
    LedgerStorage.initializeLedger();

    const ledger = LedgerStorage.loadLedger()!;
    const holdings = deriveHoldings(ledger.events, ledger.instruments, new Map());

    expect(holdings).toHaveLength(0);

    const metrics = derivePortfolioMetrics(ledger.events, holdings);
    expect(metrics.totalInvested).toBe(0);
    expect(metrics.currentValue).toBe(0);
    expect(metrics.totalDividends).toBe(0);
    expect(metrics.totalFees).toBe(0);
    expect(metrics.xirr).toBeNull();
  });
});

describe('E2E Scenario 10: Salg med tap', () => {
  it('sell at a loss yields negative realized gain', () => {
    LedgerStorage.initializeLedger();
    const isin = 'NO0010096985';
    setupInstrument(isin, 'EQNR', 'Equinor ASA');
    LedgerStorage.addEvents([
      buy('e1', isin, '2024-01-01', 100, 300),
      sell('e2', isin, '2024-06-01', 100, 200),
    ]);

    const ledger = LedgerStorage.loadLedger()!;
    const gains = deriveRealizedGains(ledger.events, ledger.instruments);

    expect(gains).toHaveLength(1);
    expect(gains[0].saleProceeds).toBe(20000);
    expect(gains[0].costBasis).toBeCloseTo(30000, 0);
    expect(gains[0].realizedGain).toBeCloseTo(-10000, 0);

    // Holdings should be empty (all sold)
    const holdings = deriveHoldings(ledger.events, ledger.instruments, new Map([[isin, 200]]));
    expect(holdings).toHaveLength(0);
  });
});
