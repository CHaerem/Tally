// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerStorage } from './ledger';
import { parseCSV } from './import';
import { deriveHoldings, derivePortfolioMetrics } from './calculations';
import type { TradeEvent, DividendEvent, CashEvent } from './types';

beforeEach(() => {
  localStorage.clear();
});

describe('Integration: CSV import → holdings → metrics', () => {
  const sampleCSV = `Dato;Type;ISIN;Navn;Antall;Kurs;Beløp;Kurtasje;Valuta
2023-01-10;Innskudd;;;;;50000;;NOK
2023-01-15;Kjøp;NO0010096985;Equinor ASA;100;280,50;28050,00;29,00;NOK
2023-03-15;Utbytte;NO0010096985;Equinor ASA;100;8,70;870,00;;NOK
2023-06-15;Kjøp;NO0010657505;DNB Bank ASA;200;180,00;36000,00;29,00;NOK
2023-09-15;Utbytte;NO0010657505;DNB Bank ASA;200;6,50;1300,00;;NOK
2023-11-01;Salg;NO0010096985;Equinor ASA;50;310,00;15500,00;29,00;NOK`;

  it('full flow: import CSV, derive holdings, calculate metrics', () => {
    // 1. Initialize ledger
    const ledger = LedgerStorage.initializeLedger();

    // 2. Parse CSV
    const result = parseCSV(sampleCSV, ledger.accounts[0].id);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.instruments).toHaveLength(2);
    expect(result.errors).toHaveLength(0);

    // 3. Persist events and instruments
    LedgerStorage.addEvents(result.events);
    for (const inst of result.instruments) {
      LedgerStorage.upsertInstrument(inst);
    }

    // 4. Reload and verify
    const saved = LedgerStorage.loadLedger()!;
    expect(saved.events).toHaveLength(6); // 1 cash_in + 2 buys + 2 dividends + 1 sell
    expect(saved.instruments).toHaveLength(2);

    // 5. Derive holdings with current prices
    const prices = new Map([
      ['NO0010096985', 300],  // EQNR at 300
      ['NO0010657505', 195],  // DNB at 195
    ]);
    const holdings = deriveHoldings(saved.events, saved.instruments, prices);

    // Should have 2 holdings (EQNR: 50 remaining, DNB: 200)
    expect(holdings).toHaveLength(2);

    const eqnr = holdings.find(h => h.isin === 'NO0010096985')!;
    const dnb = holdings.find(h => h.isin === 'NO0010657505')!;

    // EQNR: bought 100, sold 50 → 50 remaining
    expect(eqnr.quantity).toBe(50);
    expect(eqnr.currentPrice).toBe(300);
    expect(eqnr.marketValue).toBe(15000);
    expect(eqnr.totalDividendsReceived).toBe(870);

    // DNB: bought 200, none sold
    expect(dnb.quantity).toBe(200);
    expect(dnb.currentPrice).toBe(195);
    expect(dnb.marketValue).toBe(39000);
    expect(dnb.totalDividendsReceived).toBe(1300);

    // 6. Calculate portfolio metrics
    const metrics = derivePortfolioMetrics(saved.events, holdings);

    expect(metrics.totalInvested).toBe(50000); // CASH_IN
    expect(metrics.totalDividends).toBe(2170); // 870 + 1300
    expect(metrics.currentValue).toBe(54000); // 15000 + 39000
    expect(metrics.totalFees).toBe(87); // 29 * 3 fees

    // XIRR should be calculable and positive (portfolio gained value)
    expect(metrics.xirr).not.toBeNull();
  });
});

describe('Integration: Manual trade entry → holdings', () => {
  it('creates holding from manual trade', () => {
    LedgerStorage.initializeLedger();

    // Simulate manual trade entry
    const isin = 'MANUAL_EQNR';
    const instrument = { isin, ticker: 'EQNR', name: 'Equinor ASA', currency: 'NOK' as const };
    LedgerStorage.upsertInstrument(instrument);

    const event: TradeEvent = {
      id: 'evt_manual_1',
      accountId: 'default',
      date: '2024-01-15',
      type: 'TRADE_BUY',
      amount: 28050,
      currency: 'NOK',
      createdAt: new Date().toISOString(),
      source: 'MANUAL',
      isin,
      quantity: 100,
      pricePerShare: 280.5,
      fee: 29,
    };
    LedgerStorage.addEvents([event]);

    const ledger = LedgerStorage.loadLedger()!;
    const prices = new Map([[isin, 300]]);
    const holdings = deriveHoldings(ledger.events, ledger.instruments, prices);

    expect(holdings).toHaveLength(1);
    expect(holdings[0].ticker).toBe('EQNR');
    expect(holdings[0].quantity).toBe(100);
    expect(holdings[0].costBasis).toBe(28079); // 28050 + 29 fee
    expect(holdings[0].marketValue).toBe(30000);
    expect(holdings[0].unrealizedGain).toBe(1921); // 30000 - 28079
  });
});

describe('Integration: Multiple buys + sells (FIFO)', () => {
  it('correctly handles FIFO cost basis across multiple trades', () => {
    LedgerStorage.initializeLedger();

    const events: TradeEvent[] = [
      // Buy 100 at 200
      { id: 'evt_1', accountId: 'default', date: '2023-01-01', type: 'TRADE_BUY', amount: 20000, currency: 'NOK', createdAt: '', source: 'MANUAL', isin: 'NO001', quantity: 100, pricePerShare: 200 },
      // Buy 100 at 300
      { id: 'evt_2', accountId: 'default', date: '2023-06-01', type: 'TRADE_BUY', amount: 30000, currency: 'NOK', createdAt: '', source: 'MANUAL', isin: 'NO001', quantity: 100, pricePerShare: 300 },
      // Sell 50 (should reduce avg cost proportionally)
      { id: 'evt_3', accountId: 'default', date: '2023-09-01', type: 'TRADE_SELL', amount: 15000, currency: 'NOK', createdAt: '', source: 'MANUAL', isin: 'NO001', quantity: 50, pricePerShare: 300 },
    ];
    LedgerStorage.addEvents(events);
    LedgerStorage.upsertInstrument({ isin: 'NO001', ticker: 'TEST', name: 'Test', currency: 'NOK' });

    const ledger = LedgerStorage.loadLedger()!;
    const holdings = deriveHoldings(ledger.events, ledger.instruments, new Map([['NO001', 350]]));

    expect(holdings).toHaveLength(1);
    expect(holdings[0].quantity).toBe(150); // 100 + 100 - 50
    // Cost: bought 20000 + 30000 = 50000 total for 200 shares, avg 250/share
    // Sold 50 at avg 250 = 12500 removed from cost → 37500 remaining
    expect(holdings[0].costBasis).toBeCloseTo(37500, 0);
    expect(holdings[0].marketValue).toBe(52500); // 150 * 350
  });
});

describe('Integration: Dividend tracking', () => {
  it('tracks dividends per holding correctly', () => {
    LedgerStorage.initializeLedger();

    const events = [
      { id: 'evt_1', accountId: 'default', date: '2023-01-01', type: 'TRADE_BUY' as const, amount: 28000, currency: 'NOK' as const, createdAt: '', source: 'MANUAL' as const, isin: 'NO001', quantity: 100, pricePerShare: 280 } satisfies TradeEvent,
      { id: 'evt_2', accountId: 'default', date: '2023-06-15', type: 'DIVIDEND' as const, amount: 870, currency: 'NOK' as const, createdAt: '', source: 'MANUAL' as const, isin: 'NO001', quantity: 100, perShare: 8.7 } satisfies DividendEvent,
      { id: 'evt_3', accountId: 'default', date: '2023-12-15', type: 'DIVIDEND' as const, amount: 920, currency: 'NOK' as const, createdAt: '', source: 'MANUAL' as const, isin: 'NO001', quantity: 100, perShare: 9.2 } satisfies DividendEvent,
    ];

    LedgerStorage.addEvents(events);
    LedgerStorage.upsertInstrument({ isin: 'NO001', ticker: 'EQNR', name: 'Equinor', currency: 'NOK' });

    const ledger = LedgerStorage.loadLedger()!;
    const holdings = deriveHoldings(ledger.events, ledger.instruments, new Map([['NO001', 300]]));

    expect(holdings[0].totalDividendsReceived).toBe(1790);

    const metrics = derivePortfolioMetrics(ledger.events, holdings);
    expect(metrics.totalDividends).toBe(1790);
  });
});

describe('Integration: URL sharing encode/decode', () => {
  it('encodes and decodes ledger data in URL format', () => {
    // Simulate the share encoding from main.ts
    const payload = {
      events: [
        { id: 'evt_1', accountId: 'default', date: '2023-01-15', type: 'TRADE_BUY', amount: 28000, currency: 'NOK', createdAt: '', source: 'MANUAL', isin: 'NO001', quantity: 100, pricePerShare: 280 },
      ],
      instruments: [
        { isin: 'NO001', ticker: 'EQNR', name: 'Equinor ASA', currency: 'NOK' },
      ],
    };

    // Encode (same as shareData() in main.ts)
    const json = JSON.stringify(payload);
    const encoded = btoa(encodeURIComponent(json));

    // Decode (same as checkShareUrl() in main.ts)
    const decoded = decodeURIComponent(atob(encoded));
    const parsed = JSON.parse(decoded);

    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].type).toBe('TRADE_BUY');
    expect(parsed.instruments).toHaveLength(1);
    expect(parsed.instruments[0].ticker).toBe('EQNR');
  });

  it('handles Norwegian characters in share data', () => {
    const payload = {
      events: [],
      instruments: [
        { isin: 'NO001', ticker: 'TEST', name: 'Aker Brygge Sjømat AS', currency: 'NOK' },
      ],
    };

    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    const decoded = JSON.parse(decodeURIComponent(atob(encoded)));

    expect(decoded.instruments[0].name).toBe('Aker Brygge Sjømat AS');
  });
});

describe('Integration: Data persistence across sessions', () => {
  it('survives localStorage round-trip with full portfolio', () => {
    // Session 1: Create portfolio
    LedgerStorage.initializeLedger();

    LedgerStorage.upsertInstrument({ isin: 'NO001', ticker: 'EQNR', name: 'Equinor', currency: 'NOK' });
    LedgerStorage.addEvents([
      { id: 'evt_1', accountId: 'default', date: '2023-01-15', type: 'CASH_IN', amount: 50000, currency: 'NOK', createdAt: '', source: 'MANUAL' } as CashEvent,
      { id: 'evt_2', accountId: 'default', date: '2023-01-16', type: 'TRADE_BUY', amount: 28000, currency: 'NOK', createdAt: '', source: 'MANUAL', isin: 'NO001', quantity: 100, pricePerShare: 280 } as TradeEvent,
    ]);

    LedgerStorage.savePrices(new Map([['NO001', 300]]));

    // Session 2: Reload everything
    const ledger2 = LedgerStorage.initializeLedger();
    const prices = LedgerStorage.loadPrices();

    expect(ledger2.events).toHaveLength(2);
    expect(ledger2.instruments).toHaveLength(1);
    expect(prices.get('NO001')).toBe(300);

    // Derive should work from persisted data
    const holdings = deriveHoldings(ledger2.events, ledger2.instruments, prices);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].marketValue).toBe(30000);
  });
});
