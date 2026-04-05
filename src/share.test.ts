// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerStorage } from './ledger';
import type { TradeEvent, Instrument, LedgerEvent } from './types';

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
});

// Helper: create a share URL from events + instruments
function createShareUrl(events: LedgerEvent[], instruments: Instrument[]): string {
  const payload = { events, instruments };
  const json = JSON.stringify(payload);
  const encoded = btoa(encodeURIComponent(json));
  return '#share=' + encoded;
}

// Helper: decode a share URL hash back to payload
function decodeShareUrl(hash: string): { events: LedgerEvent[]; instruments: Instrument[] } {
  const encoded = hash.substring(7); // strip '#share='
  const json = decodeURIComponent(atob(encoded));
  return JSON.parse(json);
}

const sampleInstrument: Instrument = {
  isin: 'NO0010096985',
  ticker: 'EQNR',
  name: 'Equinor ASA',
  instrumentType: 'STOCK',
  currency: 'NOK',
};

const sampleEvent: TradeEvent = {
  id: 'test-1',
  accountId: 'acc-1',
  date: '2025-03-07',
  type: 'TRADE_BUY',
  isin: 'NO0010096985',
  quantity: 100,
  pricePerShare: 280.50,
  amount: 28050,
  fee: 29,
  currency: 'NOK',
  createdAt: '2025-03-07T12:00:00Z',
  source: 'MANUAL',
};

describe('Share URL: encoding', () => {
  it('creates a valid base64-encoded share hash', () => {
    const hash = createShareUrl([sampleEvent], [sampleInstrument]);
    expect(hash).toMatch(/^#share=[A-Za-z0-9+/=]+$/);
  });

  it('encodes events and instruments correctly', () => {
    const hash = createShareUrl([sampleEvent], [sampleInstrument]);
    const decoded = decodeShareUrl(hash);
    expect(decoded.events).toHaveLength(1);
    expect(decoded.events[0].type).toBe('TRADE_BUY');
    expect(decoded.instruments).toHaveLength(1);
    expect(decoded.instruments[0].ticker).toBe('EQNR');
  });

  it('handles Norwegian characters in names', () => {
    const inst: Instrument = { ...sampleInstrument, name: 'Gjensidige Forsikring ASA — Børs' };
    const hash = createShareUrl([sampleEvent], [inst]);
    const decoded = decodeShareUrl(hash);
    expect(decoded.instruments[0].name).toBe('Gjensidige Forsikring ASA — Børs');
  });

  it('handles empty events array', () => {
    const hash = createShareUrl([], [sampleInstrument]);
    const decoded = decodeShareUrl(hash);
    expect(decoded.events).toHaveLength(0);
    expect(decoded.instruments).toHaveLength(1);
  });

  it('handles multiple events and instruments', () => {
    const event2: TradeEvent = {
      ...sampleEvent,
      id: 'test-2',
      isin: 'NO0010657505',
      quantity: 200,
      pricePerShare: 180,
      amount: 36000,
    };
    const inst2: Instrument = {
      isin: 'NO0010657505',
      ticker: 'DNB',
      name: 'DNB Bank ASA',
      instrumentType: 'STOCK',
      currency: 'NOK',
    };
    const hash = createShareUrl([sampleEvent, event2], [sampleInstrument, inst2]);
    const decoded = decodeShareUrl(hash);
    expect(decoded.events).toHaveLength(2);
    expect(decoded.instruments).toHaveLength(2);
  });
});

describe('Share URL: decoding and import', () => {
  it('imports shared events into ledger', () => {
    LedgerStorage.initializeLedger();
    const hash = createShareUrl([sampleEvent], [sampleInstrument]);
    const decoded = decodeShareUrl(hash);

    LedgerStorage.addEvents(decoded.events);
    for (const inst of decoded.instruments) {
      LedgerStorage.upsertInstrument(inst);
    }

    const ledger = LedgerStorage.loadLedger()!;
    expect(ledger.events).toHaveLength(1);
    expect(ledger.events[0].type).toBe('TRADE_BUY');
    expect((ledger.events[0] as TradeEvent).isin).toBe('NO0010096985');
    expect(ledger.instruments).toHaveLength(1);
    expect(ledger.instruments[0].ticker).toBe('EQNR');
  });

  it('does not duplicate instruments on re-import', () => {
    LedgerStorage.initializeLedger();
    const decoded = decodeShareUrl(createShareUrl([sampleEvent], [sampleInstrument]));

    // Import twice
    LedgerStorage.addEvents(decoded.events);
    for (const inst of decoded.instruments) LedgerStorage.upsertInstrument(inst);
    LedgerStorage.addEvents(decoded.events);
    for (const inst of decoded.instruments) LedgerStorage.upsertInstrument(inst);

    const ledger = LedgerStorage.loadLedger()!;
    expect(ledger.events).toHaveLength(2); // events duplicated (no dedup)
    expect(ledger.instruments).toHaveLength(1); // instruments deduped by ISIN
  });

  it('merges shared data with existing portfolio', () => {
    LedgerStorage.initializeLedger();

    // Existing event
    const existingEvent: TradeEvent = {
      ...sampleEvent,
      id: 'existing-1',
      isin: 'NO0010657505',
      quantity: 50,
      pricePerShare: 200,
      amount: 10000,
    };
    const existingInst: Instrument = {
      isin: 'NO0010657505',
      ticker: 'DNB',
      name: 'DNB Bank ASA',
      instrumentType: 'STOCK',
      currency: 'NOK',
    };
    LedgerStorage.addEvents([existingEvent]);
    LedgerStorage.upsertInstrument(existingInst);

    // Import shared data
    const decoded = decodeShareUrl(createShareUrl([sampleEvent], [sampleInstrument]));
    LedgerStorage.addEvents(decoded.events);
    for (const inst of decoded.instruments) LedgerStorage.upsertInstrument(inst);

    const ledger = LedgerStorage.loadLedger()!;
    expect(ledger.events).toHaveLength(2); // existing + shared
    expect(ledger.instruments).toHaveLength(2); // DNB + EQNR
  });
});

describe('Share URL: edge cases', () => {
  it('handles invalid base64 gracefully', () => {
    expect(() => {
      const hash = '#share=!!!invalid!!!';
      atob(hash.substring(7));
    }).toThrow();
  });

  it('handles invalid JSON after decoding', () => {
    const encoded = btoa('not-valid-json');
    expect(() => {
      JSON.parse(decodeURIComponent(atob(encoded)));
    }).toThrow();
  });

  it('handles hash without share prefix', () => {
    const hash = '#other=data';
    expect(hash.startsWith('#share=')).toBe(false);
  });

  it('handles empty hash', () => {
    expect(''.startsWith('#share=')).toBe(false);
  });

  it('preserves event fields through encode/decode roundtrip', () => {
    const hash = createShareUrl([sampleEvent], [sampleInstrument]);
    const decoded = decodeShareUrl(hash);
    const event = decoded.events[0] as TradeEvent;

    expect(event.id).toBe('test-1');
    expect(event.accountId).toBe('acc-1');
    expect(event.date).toBe('2025-03-07');
    expect(event.type).toBe('TRADE_BUY');
    expect(event.isin).toBe('NO0010096985');
    expect(event.quantity).toBe(100);
    expect(event.pricePerShare).toBe(280.50);
    expect(event.amount).toBe(28050);
    expect(event.fee).toBe(29);
    expect(event.currency).toBe('NOK');
    expect(event.source).toBe('MANUAL');
  });

  it('preserves instrument fields through roundtrip', () => {
    const hash = createShareUrl([sampleEvent], [sampleInstrument]);
    const decoded = decodeShareUrl(hash);
    const inst = decoded.instruments[0];

    expect(inst.isin).toBe('NO0010096985');
    expect(inst.ticker).toBe('EQNR');
    expect(inst.name).toBe('Equinor ASA');
    expect(inst.instrumentType).toBe('STOCK');
  });

  it('handles fund instruments', () => {
    const fundInst: Instrument = {
      isin: 'IE00B4L5Y983',
      ticker: '0P00017YPW.IR',
      name: 'KLP AksjeAsia Indeks Valutasikret',
      instrumentType: 'FUND',
      currency: 'NOK',
    };
    const hash = createShareUrl([], [fundInst]);
    const decoded = decodeShareUrl(hash);
    expect(decoded.instruments[0].instrumentType).toBe('FUND');
    expect(decoded.instruments[0].ticker).toBe('0P00017YPW.IR');
  });

  it('handles large portfolios', () => {
    const events: TradeEvent[] = Array.from({ length: 100 }, (_, i) => ({
      ...sampleEvent,
      id: 'event-' + i,
      amount: 1000 + i,
    }));
    const hash = createShareUrl(events, [sampleInstrument]);
    const decoded = decodeShareUrl(hash);
    expect(decoded.events).toHaveLength(100);
  });
});
