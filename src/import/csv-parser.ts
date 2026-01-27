import type { LedgerEvent, TradeEvent, DividendEvent, CashEvent, Instrument, DataQualityWarning } from '../types';
import { generateEventId, generateWarningId, parseNorwegianDate, parseNorwegianNumber } from '../ledger/utils';

export interface CSVParseResult {
  events: LedgerEvent[];
  instruments: Instrument[];
  warnings: DataQualityWarning[];
  errors: Array<{ row: number; message: string }>;
  stats: { totalRows: number; parsedRows: number; skippedRows: number; tradeEvents: number; dividendEvents: number; cashEvents: number };
}

const TYPE_MAPPINGS: Record<string, 'BUY' | 'SELL' | 'DIVIDEND' | 'CASH_IN' | 'CASH_OUT'> = {
  'kjøp': 'BUY', 'kjop': 'BUY', 'buy': 'BUY',
  'salg': 'SELL', 'sell': 'SELL',
  'utbytte': 'DIVIDEND', 'dividend': 'DIVIDEND',
  'innskudd': 'CASH_IN', 'deposit': 'CASH_IN',
  'uttak': 'CASH_OUT', 'withdrawal': 'CASH_OUT',
};

export function parseCSV(content: string, accountId: string): CSVParseResult {
  const result: CSVParseResult = {
    events: [], instruments: [], warnings: [], errors: [],
    stats: { totalRows: 0, parsedRows: 0, skippedRows: 0, tradeEvents: 0, dividendEvents: 0, cashEvents: 0 }
  };

  const delimiter = content.includes(';') ? ';' : ',';
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return result;

  const headers = lines[0].toLowerCase().split(delimiter).map(h => h.trim());
  const getCol = (names: string[]) => headers.findIndex(h => names.some(n => h.includes(n)));
  
  const dateIdx = getCol(['dato', 'date']);
  const typeIdx = getCol(['type', 'transaksjon']);
  const isinIdx = getCol(['isin']);
  const nameIdx = getCol(['navn', 'name', 'verdipapir']);
  const qtyIdx = getCol(['antall', 'quantity']);
  const priceIdx = getCol(['kurs', 'pris', 'price']);
  const amountIdx = getCol(['beløp', 'belop', 'amount', 'sum']);
  const feeIdx = getCol(['kurtasje', 'fee', 'gebyr']);

  const seenInstruments = new Map<string, Instrument>();
  const eventsWithMissingFee: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    result.stats.totalRows++;
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
    
    if (!cols[dateIdx]) { result.stats.skippedRows++; continue; }

    try {
      const date = parseNorwegianDate(cols[dateIdx]);
      const typeStr = (cols[typeIdx] || '').toLowerCase();
      const eventType = TYPE_MAPPINGS[typeStr];
      if (!eventType) { result.stats.skippedRows++; continue; }

      const now = new Date().toISOString();
      let amount = amountIdx >= 0 && cols[amountIdx] ? Math.abs(parseNorwegianNumber(cols[amountIdx])) : 0;

      if (eventType === 'CASH_IN' || eventType === 'CASH_OUT') {
        result.events.push({ id: generateEventId(), accountId, date, type: eventType, amount, currency: 'NOK', createdAt: now, source: 'CSV_IMPORT' } as CashEvent);
        result.stats.cashEvents++;
        result.stats.parsedRows++;
        continue;
      }

      const isin = cols[isinIdx] || 'UNKNOWN_' + (cols[nameIdx] || 'X').substring(0, 6).toUpperCase();
      const name = cols[nameIdx] || 'Ukjent';
      const quantity = qtyIdx >= 0 && cols[qtyIdx] ? parseNorwegianNumber(cols[qtyIdx]) : 0;
      const price = priceIdx >= 0 && cols[priceIdx] ? parseNorwegianNumber(cols[priceIdx]) : 0;
      const fee = feeIdx >= 0 && cols[feeIdx] ? Math.abs(parseNorwegianNumber(cols[feeIdx])) : undefined;

      if (!amount && quantity && price) amount = quantity * price;

      if (!seenInstruments.has(isin)) {
        seenInstruments.set(isin, { isin, ticker: isin.substring(0, 6), name, currency: 'NOK' });
      }

      if (eventType === 'DIVIDEND') {
        result.events.push({ id: generateEventId(), accountId, date, type: 'DIVIDEND', amount, currency: 'NOK', createdAt: now, source: 'CSV_IMPORT', isin, quantity, perShare: quantity > 0 ? amount / quantity : amount } as DividendEvent);
        result.stats.dividendEvents++;
      } else {
        const evt: TradeEvent = { id: generateEventId(), accountId, date, type: eventType === 'BUY' ? 'TRADE_BUY' : 'TRADE_SELL', amount, currency: 'NOK', createdAt: now, source: 'CSV_IMPORT', isin, quantity, pricePerShare: price || (quantity > 0 ? amount / quantity : 0), fee };
        result.events.push(evt);
        result.stats.tradeEvents++;
        if (!fee) eventsWithMissingFee.push(evt.id);
      }
      result.stats.parsedRows++;
    } catch (e) {
      result.errors.push({ row: i + 1, message: e instanceof Error ? e.message : 'Ukjent feil' });
    }
  }

  result.instruments = Array.from(seenInstruments.values());
  if (eventsWithMissingFee.length > 0) {
    result.warnings.push({ id: generateWarningId(), severity: 'WARNING', message: 'Mangler kurtasje på ' + eventsWithMissingFee.length + ' handler', affectedEventIds: eventsWithMissingFee, suggestedFix: 'Sjekk transaksjonshistorikk' });
  }

  return result;
}

export function validateCSV(content: string): string[] {
  const errors: string[] = [];
  if (!content?.trim()) { errors.push('Filen er tom'); return errors; }
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) errors.push('Filen må ha minst en header og en datarad');
  return errors;
}
