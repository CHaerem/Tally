import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercent, formatDateShort } from './format';

describe('formatCurrency', () => {
  it('formats positive amount in NOK', () => {
    const result = formatCurrency(50000);
    expect(result).toContain('50');
    expect(result).toContain('000');
  });

  it('formats with decimals', () => {
    const result = formatCurrency(280.5, 2);
    expect(result).toContain('280');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('formats negative amount', () => {
    const result = formatCurrency(-1500);
    // Should contain minus sign or equivalent
    expect(result).toMatch(/[-−]/);
  });
});

describe('formatPercent', () => {
  it('formats null as N/A', () => {
    expect(formatPercent(null)).toBe('N/A');
  });

  it('formats positive with + sign and comma', () => {
    expect(formatPercent(15.5)).toBe('+15,50%');
  });

  it('formats negative', () => {
    expect(formatPercent(-5.25)).toBe('-5,25%');
  });

  it('formats zero with + sign', () => {
    expect(formatPercent(0)).toBe('+0,00%');
  });
});

describe('formatDateShort', () => {
  it('formats ISO string to Norwegian date', () => {
    const result = formatDateShort('2024-03-15');
    expect(result).toContain('15');
    expect(result).toContain('03');
    expect(result).toContain('2024');
  });

  it('formats Date object', () => {
    const result = formatDateShort(new Date(2024, 0, 1)); // January 1
    expect(result).toContain('01');
    expect(result).toContain('2024');
  });
});
