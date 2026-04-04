import { describe, it, expect } from 'vitest';
import { calculateXIRR, formatXIRRPercent } from './xirr';
import type { CashFlow } from '../types';

describe('calculateXIRR', () => {
  it('returns null for fewer than 2 cash flows', () => {
    expect(calculateXIRR([])).toBeNull();
    expect(calculateXIRR([{ date: new Date('2023-01-01'), amount: -1000 }])).toBeNull();
  });

  it('returns null when all flows are same sign', () => {
    const flows: CashFlow[] = [
      { date: new Date('2023-01-01'), amount: -1000 },
      { date: new Date('2024-01-01'), amount: -500 },
    ];
    expect(calculateXIRR(flows)).toBeNull();
  });

  it('calculates simple investment return', () => {
    // Invest 10000, get back 11000 after 1 year = ~10% return
    const flows: CashFlow[] = [
      { date: new Date('2023-01-01'), amount: -10000 },
      { date: new Date('2024-01-01'), amount: 11000 },
    ];
    const result = calculateXIRR(flows);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(0.10, 1);
  });

  it('calculates return with multiple investments', () => {
    // From MVP spec example
    const flows: CashFlow[] = [
      { date: new Date('2019-01-10'), amount: -10000 },
      { date: new Date('2020-03-15'), amount: -5000 },
      { date: new Date('2021-06-01'), amount: 1200 },
      { date: new Date('2024-12-31'), amount: 18000 },
    ];
    const result = calculateXIRR(flows);
    expect(result).not.toBeNull();
    // Should be a reasonable positive return
    expect(result!).toBeGreaterThan(0);
    expect(result!).toBeLessThan(0.20);
  });

  it('handles negative return (loss)', () => {
    // Invest 10000, get back 8000 after 1 year = ~-20% return
    const flows: CashFlow[] = [
      { date: new Date('2023-01-01'), amount: -10000 },
      { date: new Date('2024-01-01'), amount: 8000 },
    ];
    const result = calculateXIRR(flows);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(-0.20, 1);
  });

  it('handles zero return (break even)', () => {
    const flows: CashFlow[] = [
      { date: new Date('2023-01-01'), amount: -10000 },
      { date: new Date('2024-01-01'), amount: 10000 },
    ];
    const result = calculateXIRR(flows);
    expect(result).not.toBeNull();
    expect(Math.abs(result!)).toBeLessThan(0.01);
  });

  it('handles dividends as positive cash flows', () => {
    const flows: CashFlow[] = [
      { date: new Date('2023-01-01'), amount: -10000 },
      { date: new Date('2023-06-01'), amount: 500 },    // dividend
      { date: new Date('2023-12-01'), amount: 500 },    // dividend
      { date: new Date('2024-01-01'), amount: 10000 },  // terminal value
    ];
    const result = calculateXIRR(flows);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0.05); // Should be > 5% due to dividends
  });
});

describe('formatXIRRPercent', () => {
  it('formats null as N/A', () => {
    expect(formatXIRRPercent(null)).toBe('N/A');
  });

  it('formats positive return with + sign', () => {
    expect(formatXIRRPercent(0.15)).toBe('+15.00%');
  });

  it('formats negative return', () => {
    expect(formatXIRRPercent(-0.05)).toBe('-5.00%');
  });

  it('formats zero return', () => {
    expect(formatXIRRPercent(0)).toBe('+0.00%');
  });
});
