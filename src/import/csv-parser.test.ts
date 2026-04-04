import { describe, it, expect } from 'vitest';
import { parseCSV, validateCSV } from './csv-parser';

describe('validateCSV', () => {
  it('rejects empty string', () => {
    expect(validateCSV('')).toContain('Filen er tom');
  });

  it('rejects whitespace only', () => {
    expect(validateCSV('   ')).toContain('Filen er tom');
  });

  it('rejects single line (header only)', () => {
    const errors = validateCSV('Dato;Type;ISIN');
    expect(errors).toContain('Filen må ha minst en header og en datarad');
  });

  it('accepts valid CSV with header + data', () => {
    const csv = 'Dato;Type;ISIN\n2023-01-15;Kjøp;NO001';
    expect(validateCSV(csv)).toHaveLength(0);
  });
});

describe('parseCSV', () => {
  const sampleCSV = `Dato;Type;ISIN;Navn;Antall;Kurs;Beløp;Kurtasje;Valuta
2023-01-15;Innskudd;;;;50000;;NOK
2023-01-16;Kjøp;NO0010096985;Equinor ASA;100;280,50;28050,00;29,00;NOK
2023-03-15;Utbytte;NO0010096985;Equinor ASA;100;8,70;870,00;;NOK
2023-06-01;Salg;NO0010096985;Equinor ASA;50;310,00;15500,00;29,00;NOK`;

  it('parses all event types', () => {
    const result = parseCSV(sampleCSV, 'default');
    expect(result.stats.cashEvents).toBe(1);
    expect(result.stats.tradeEvents).toBe(2);
    expect(result.stats.dividendEvents).toBe(1);
    expect(result.stats.parsedRows).toBe(4);
  });

  it('extracts instruments', () => {
    const result = parseCSV(sampleCSV, 'default');
    expect(result.instruments).toHaveLength(1);
    expect(result.instruments[0].isin).toBe('NO0010096985');
    expect(result.instruments[0].name).toBe('Equinor ASA');
  });

  it('sets correct event types', () => {
    const result = parseCSV(sampleCSV, 'default');
    const types = result.events.map(e => e.type);
    expect(types).toContain('CASH_IN');
    expect(types).toContain('TRADE_BUY');
    expect(types).toContain('DIVIDEND');
    expect(types).toContain('TRADE_SELL');
  });

  it('parses Norwegian numbers correctly', () => {
    const result = parseCSV(sampleCSV, 'default');
    const buy = result.events.find(e => e.type === 'TRADE_BUY');
    expect(buy).toBeDefined();
    expect(buy!.amount).toBe(28050);
  });

  it('parses fees on trades', () => {
    const result = parseCSV(sampleCSV, 'default');
    const buy = result.events.find(e => e.type === 'TRADE_BUY');
    expect((buy as any).fee).toBe(29);
  });

  it('warns about missing fees', () => {
    // The dividend and cash events don't have fees, but only trades without fees trigger warnings
    // In our sample, the Utbytte row has no fee but that's expected.
    // Let's make a CSV where a trade is missing its fee
    const csv = `Dato;Type;ISIN;Navn;Antall;Kurs;Beløp;Kurtasje
2023-01-16;Kjøp;NO001;Test;100;280;28000;`;
    const result = parseCSV(csv, 'default');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].message).toContain('kurtasje');
  });

  it('handles comma-delimited CSV', () => {
    const csv = `Dato,Type,ISIN,Navn,Antall,Kurs,Beløp
2023-01-16,Buy,NO001,Test Stock,100,280,28000`;
    const result = parseCSV(csv, 'default');
    expect(result.stats.tradeEvents).toBe(1);
  });

  it('skips rows with unknown type', () => {
    const csv = `Dato;Type;Beløp
2023-01-01;UkjentType;1000`;
    const result = parseCSV(csv, 'default');
    expect(result.stats.skippedRows).toBe(1);
    expect(result.events).toHaveLength(0);
  });

  it('sets source as CSV_IMPORT', () => {
    const result = parseCSV(sampleCSV, 'default');
    for (const event of result.events) {
      expect(event.source).toBe('CSV_IMPORT');
    }
  });

  it('uses provided accountId', () => {
    const result = parseCSV(sampleCSV, 'my-account');
    for (const event of result.events) {
      expect(event.accountId).toBe('my-account');
    }
  });
});
