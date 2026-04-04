import { describe, it, expect } from 'vitest';
import { generateEventId, generateWarningId, parseNorwegianDate, parseNorwegianNumber } from './utils';

describe('generateEventId', () => {
  it('starts with evt_', () => {
    expect(generateEventId()).toMatch(/^evt_/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateEventId()));
    expect(ids.size).toBe(100);
  });
});

describe('generateWarningId', () => {
  it('starts with warn_', () => {
    expect(generateWarningId()).toMatch(/^warn_/);
  });
});

describe('parseNorwegianDate', () => {
  it('passes through ISO format', () => {
    expect(parseNorwegianDate('2024-03-15')).toBe('2024-03-15');
  });

  it('parses DD.MM.YYYY', () => {
    expect(parseNorwegianDate('15.03.2024')).toBe('2024-03-15');
  });

  it('parses DD/MM/YYYY', () => {
    expect(parseNorwegianDate('15/03/2024')).toBe('2024-03-15');
  });

  it('pads single-digit day and month', () => {
    expect(parseNorwegianDate('1.3.2024')).toBe('2024-03-01');
  });

  it('throws on invalid format', () => {
    expect(() => parseNorwegianDate('not-a-date')).toThrow('Ugyldig datoformat');
  });
});

describe('parseNorwegianNumber', () => {
  it('parses simple integer', () => {
    expect(parseNorwegianNumber('1000')).toBe(1000);
  });

  it('parses number with space as thousands separator', () => {
    expect(parseNorwegianNumber('1 234')).toBe(1234);
  });

  it('parses number with comma as decimal separator', () => {
    expect(parseNorwegianNumber('280,50')).toBe(280.5);
  });

  it('parses full Norwegian format', () => {
    expect(parseNorwegianNumber('1 234,56')).toBe(1234.56);
  });

  it('throws on invalid input', () => {
    expect(() => parseNorwegianNumber('abc')).toThrow('Ugyldig tallformat');
  });
});
