// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerStorage } from './storage';
import type { TradeEvent, Instrument, DataQualityWarning } from '../types';

beforeEach(() => {
  localStorage.clear();
});

describe('LedgerStorage', () => {
  describe('initializeLedger', () => {
    it('creates a new ledger with default account when none exists', () => {
      const ledger = LedgerStorage.initializeLedger();
      expect(ledger.version).toBe(2);
      expect(ledger.accounts).toHaveLength(1);
      expect(ledger.accounts[0].id).toBe('default');
      expect(ledger.accounts[0].name).toBe('Hovedkonto');
      expect(ledger.accounts[0].type).toBe('VPS_ORDINARY');
      expect(ledger.events).toHaveLength(0);
      expect(ledger.instruments).toHaveLength(0);
    });

    it('returns existing ledger if one exists', () => {
      const first = LedgerStorage.initializeLedger();
      first.events.push({
        id: 'test', accountId: 'default', date: '2023-01-01', type: 'CASH_IN',
        amount: 50000, currency: 'NOK', createdAt: new Date().toISOString(), source: 'MANUAL',
      } as any);
      LedgerStorage.saveLedger(first);

      const second = LedgerStorage.initializeLedger();
      expect(second.events).toHaveLength(1);
    });

    it('persists to localStorage', () => {
      LedgerStorage.initializeLedger();
      const raw = localStorage.getItem('tally_ledger_v2');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.version).toBe(2);
    });
  });

  describe('loadLedger / saveLedger', () => {
    it('returns null when nothing stored', () => {
      expect(LedgerStorage.loadLedger()).toBeNull();
    });

    it('round-trips ledger data', () => {
      const ledger = LedgerStorage.initializeLedger();
      ledger.instruments.push({ isin: 'NO001', ticker: 'EQNR', name: 'Equinor', currency: 'NOK' });
      LedgerStorage.saveLedger(ledger);

      const loaded = LedgerStorage.loadLedger();
      expect(loaded).not.toBeNull();
      expect(loaded!.instruments).toHaveLength(1);
      expect(loaded!.instruments[0].ticker).toBe('EQNR');
    });

    it('sets lastModified on save', () => {
      const ledger = LedgerStorage.initializeLedger();
      LedgerStorage.saveLedger(ledger);
      const loaded = LedgerStorage.loadLedger();
      expect(loaded!.lastModified).toBeDefined();
      // Should be a valid ISO date
      expect(new Date(loaded!.lastModified).getTime()).not.toBeNaN();
    });
  });

  describe('clearLedger', () => {
    it('removes ledger from localStorage', () => {
      LedgerStorage.initializeLedger();
      expect(LedgerStorage.loadLedger()).not.toBeNull();

      LedgerStorage.clearLedger();
      expect(LedgerStorage.loadLedger()).toBeNull();
    });
  });

  describe('addEvents', () => {
    it('appends events to existing ledger', () => {
      LedgerStorage.initializeLedger();

      const event: TradeEvent = {
        id: 'evt_1', accountId: 'default', date: '2023-01-15',
        type: 'TRADE_BUY', amount: 28000, currency: 'NOK',
        createdAt: new Date().toISOString(), source: 'MANUAL',
        isin: 'NO001', quantity: 100, pricePerShare: 280,
      };
      LedgerStorage.addEvents([event]);

      const ledger = LedgerStorage.loadLedger();
      expect(ledger!.events).toHaveLength(1);
      expect(ledger!.events[0].id).toBe('evt_1');
    });

    it('appends multiple events at once', () => {
      LedgerStorage.initializeLedger();

      const events: TradeEvent[] = [
        { id: 'evt_1', accountId: 'default', date: '2023-01-15', type: 'TRADE_BUY', amount: 28000, currency: 'NOK', createdAt: '', source: 'MANUAL', isin: 'NO001', quantity: 100, pricePerShare: 280 },
        { id: 'evt_2', accountId: 'default', date: '2023-02-15', type: 'TRADE_BUY', amount: 18000, currency: 'NOK', createdAt: '', source: 'MANUAL', isin: 'NO002', quantity: 100, pricePerShare: 180 },
      ];
      LedgerStorage.addEvents(events);

      const ledger = LedgerStorage.loadLedger();
      expect(ledger!.events).toHaveLength(2);
    });

    it('preserves existing events when adding new ones', () => {
      LedgerStorage.initializeLedger();
      LedgerStorage.addEvents([
        { id: 'evt_1', accountId: 'default', date: '2023-01-15', type: 'TRADE_BUY', amount: 28000, currency: 'NOK', createdAt: '', source: 'MANUAL', isin: 'NO001', quantity: 100, pricePerShare: 280 } as TradeEvent,
      ]);
      LedgerStorage.addEvents([
        { id: 'evt_2', accountId: 'default', date: '2023-02-15', type: 'TRADE_BUY', amount: 18000, currency: 'NOK', createdAt: '', source: 'MANUAL', isin: 'NO002', quantity: 100, pricePerShare: 180 } as TradeEvent,
      ]);

      const ledger = LedgerStorage.loadLedger();
      expect(ledger!.events).toHaveLength(2);
      expect(ledger!.events[0].id).toBe('evt_1');
      expect(ledger!.events[1].id).toBe('evt_2');
    });
  });

  describe('upsertInstrument', () => {
    it('adds new instrument', () => {
      LedgerStorage.initializeLedger();
      const inst: Instrument = { isin: 'NO001', ticker: 'EQNR', name: 'Equinor ASA', currency: 'NOK' };
      LedgerStorage.upsertInstrument(inst);

      const ledger = LedgerStorage.loadLedger();
      expect(ledger!.instruments).toHaveLength(1);
      expect(ledger!.instruments[0].ticker).toBe('EQNR');
    });

    it('updates existing instrument with same ISIN', () => {
      LedgerStorage.initializeLedger();
      LedgerStorage.upsertInstrument({ isin: 'NO001', ticker: 'EQNR', name: 'Equinor', currency: 'NOK' });
      LedgerStorage.upsertInstrument({ isin: 'NO001', ticker: 'EQNR', name: 'Equinor ASA', currency: 'NOK' });

      const ledger = LedgerStorage.loadLedger();
      expect(ledger!.instruments).toHaveLength(1);
      expect(ledger!.instruments[0].name).toBe('Equinor ASA');
    });

    it('adds multiple instruments with different ISINs', () => {
      LedgerStorage.initializeLedger();
      LedgerStorage.upsertInstrument({ isin: 'NO001', ticker: 'EQNR', name: 'Equinor', currency: 'NOK' });
      LedgerStorage.upsertInstrument({ isin: 'NO002', ticker: 'DNB', name: 'DNB', currency: 'NOK' });

      const ledger = LedgerStorage.loadLedger();
      expect(ledger!.instruments).toHaveLength(2);
    });
  });

  describe('addWarning', () => {
    it('appends warning to ledger', () => {
      LedgerStorage.initializeLedger();
      const warning: DataQualityWarning = {
        id: 'warn_1', severity: 'WARNING',
        message: 'Mangler kurtasje', affectedEventIds: ['evt_1'],
      };
      LedgerStorage.addWarning(warning);

      const ledger = LedgerStorage.loadLedger();
      expect(ledger!.warnings).toHaveLength(1);
      expect(ledger!.warnings[0].message).toBe('Mangler kurtasje');
    });
  });

  describe('exportAsJSON', () => {
    it('returns valid JSON string', () => {
      LedgerStorage.initializeLedger();
      const json = LedgerStorage.exportAsJSON();
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(2);
    });

    it('returns empty ledger when nothing stored', () => {
      const json = LedgerStorage.exportAsJSON();
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(2);
      expect(parsed.events).toHaveLength(0);
    });
  });

  describe('savePrices / loadPrices', () => {
    it('returns empty map when no prices stored', () => {
      const prices = LedgerStorage.loadPrices();
      expect(prices.size).toBe(0);
    });

    it('round-trips price data', () => {
      const prices = new Map([['NO001', 285.5], ['NO002', 192.3]]);
      LedgerStorage.savePrices(prices);

      const loaded = LedgerStorage.loadPrices();
      expect(loaded.size).toBe(2);
      expect(loaded.get('NO001')).toBe(285.5);
      expect(loaded.get('NO002')).toBe(192.3);
    });

    it('overwrites previous prices', () => {
      LedgerStorage.savePrices(new Map([['NO001', 280]]));
      LedgerStorage.savePrices(new Map([['NO001', 300]]));

      const loaded = LedgerStorage.loadPrices();
      expect(loaded.get('NO001')).toBe(300);
    });

    it('stores in separate localStorage key from ledger', () => {
      LedgerStorage.initializeLedger();
      LedgerStorage.savePrices(new Map([['NO001', 280]]));

      // Both should exist independently
      expect(localStorage.getItem('tally_ledger_v2')).not.toBeNull();
      expect(localStorage.getItem('tally_prices')).not.toBeNull();
    });
  });
});
