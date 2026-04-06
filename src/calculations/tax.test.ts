import { describe, it, expect } from 'vitest';
import { deriveRealizedGains, deriveGainsByYear } from './tax';
import type { TradeEvent, DividendEvent, Instrument } from '../types';

const inst: Instrument = { isin: 'NO001', ticker: 'TEST', name: 'Test ASA', instrumentType: 'STOCK', currency: 'NOK' };

function buy(date: string, qty: number, price: number): TradeEvent {
  return { id: 'b' + date, accountId: 'a', date, type: 'TRADE_BUY', isin: 'NO001', quantity: qty, pricePerShare: price, amount: qty * price, currency: 'NOK', createdAt: '', source: 'MANUAL' };
}

function sell(date: string, qty: number, price: number, fee = 0): TradeEvent {
  return { id: 's' + date, accountId: 'a', date, type: 'TRADE_SELL', isin: 'NO001', quantity: qty, pricePerShare: price, amount: qty * price, currency: 'NOK', createdAt: '', source: 'MANUAL', fee };
}

function div(date: string, amount: number): DividendEvent {
  return { id: 'd' + date, accountId: 'a', date, type: 'DIVIDEND', isin: 'NO001', quantity: 100, perShare: amount / 100, amount, currency: 'NOK', createdAt: '', source: 'MANUAL' };
}

describe('deriveRealizedGains — FIFO', () => {
  it('simple buy and sell at profit', () => {
    const events = [buy('2024-01-01', 100, 50), sell('2024-06-01', 100, 70)];
    const gains = deriveRealizedGains(events, [inst]);
    expect(gains).toHaveLength(1);
    expect(gains[0].costBasis).toBe(5000);
    expect(gains[0].saleProceeds).toBe(7000);
    expect(gains[0].realizedGain).toBe(2000);
  });

  it('simple buy and sell at loss', () => {
    const events = [buy('2024-01-01', 100, 50), sell('2024-06-01', 100, 30)];
    const gains = deriveRealizedGains(events, [inst]);
    expect(gains[0].realizedGain).toBe(-2000);
  });

  it('sell with fee reduces gain', () => {
    const events = [buy('2024-01-01', 100, 50), sell('2024-06-01', 100, 70, 29)];
    const gains = deriveRealizedGains(events, [inst]);
    expect(gains[0].realizedGain).toBe(2000 - 29);
  });

  it('FIFO: sells oldest lots first', () => {
    const events = [
      buy('2024-01-01', 50, 40),  // lot 1: 50 @ 40
      buy('2024-03-01', 50, 60),  // lot 2: 50 @ 60
      sell('2024-06-01', 50, 70), // sells lot 1 first (FIFO)
    ];
    const gains = deriveRealizedGains(events, [inst]);
    expect(gains[0].costBasis).toBe(2000); // 50 × 40
    expect(gains[0].realizedGain).toBe(3500 - 2000); // 1500
  });

  it('FIFO: sell spans multiple lots', () => {
    const events = [
      buy('2024-01-01', 30, 40),  // lot 1: 30 @ 40
      buy('2024-02-01', 30, 50),  // lot 2: 30 @ 50
      buy('2024-03-01', 40, 60),  // lot 3: 40 @ 60
      sell('2024-06-01', 70, 80), // sells lot1 (30) + lot2 (30) + lot3 (10)
    ];
    const gains = deriveRealizedGains(events, [inst]);
    const expectedCost = 30 * 40 + 30 * 50 + 10 * 60; // 1200 + 1500 + 600 = 3300
    expect(gains[0].costBasis).toBe(expectedCost);
    expect(gains[0].realizedGain).toBe(70 * 80 - expectedCost); // 5600 - 3300 = 2300
  });

  it('partial sell leaves remaining lots', () => {
    const events = [
      buy('2024-01-01', 100, 50),
      sell('2024-06-01', 40, 70),
      sell('2024-09-01', 60, 80),
    ];
    const gains = deriveRealizedGains(events, [inst]);
    expect(gains).toHaveLength(2);
    expect(gains[0].costBasis).toBe(2000); // 40 × 50
    expect(gains[1].costBasis).toBe(3000); // 60 × 50
  });

  it('no sells = no gains', () => {
    const events = [buy('2024-01-01', 100, 50)];
    const gains = deriveRealizedGains(events, [inst]);
    expect(gains).toHaveLength(0);
  });
});

describe('deriveGainsByYear', () => {
  it('groups gains by year', () => {
    const events = [
      buy('2023-01-01', 100, 50),
      sell('2023-06-01', 50, 70),
      sell('2024-03-01', 50, 80),
    ];
    const years = deriveGainsByYear(events, [inst]);
    expect(years).toHaveLength(2);
    expect(years[0].year).toBe(2024); // most recent first
    expect(years[1].year).toBe(2023);
  });

  it('includes dividends in year summary', () => {
    const events = [
      buy('2024-01-01', 100, 50),
      div('2024-06-01', 500),
      sell('2024-09-01', 100, 60),
    ];
    const years = deriveGainsByYear(events, [inst]);
    expect(years[0].dividends).toBe(500);
    expect(years[0].netGain).toBe(1000); // (60-50) * 100
  });

  it('separates gains and losses', () => {
    const events = [
      buy('2024-01-01', 50, 100),
      buy('2024-02-01', 50, 50),
      sell('2024-06-01', 50, 40),  // loss: (40-100)*50 = -3000
      sell('2024-09-01', 50, 80),  // gain: (80-50)*50 = 1500... wait FIFO
    ];
    // FIFO: first sell uses lot1 (50@100): cost=5000, proceeds=2000, loss=-3000
    // Second sell uses lot2 (50@50): cost=2500, proceeds=4000, gain=+1500
    const years = deriveGainsByYear(events, [inst]);
    expect(years[0].totalGains).toBe(1500);
    expect(years[0].totalLosses).toBe(-3000);
    expect(years[0].netGain).toBe(-1500);
  });
});
