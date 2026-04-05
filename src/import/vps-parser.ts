import * as XLSX from 'xlsx';
import type { TradeEvent, Instrument } from '../types';
import { generateEventId, generateWarningId } from '../ledger/utils';
import type { CSVParseResult } from './csv-parser';

/**
 * Parse a VPS Investor Services XLSX export file.
 *
 * Expected columns (from VPS Transactions export):
 *   Account, ISIN, Registration date, Trade date, Settled date,
 *   Volume, Fees, Amount, Price, Currency code, Transaction type,
 *   Transfer type, VPS serial number, Security, Settled, Security group
 */
export function parseVPSExport(
  buffer: ArrayBuffer,
  accountId: string,
  tickerLookup?: (name: string) => { ticker: string; type: 'STOCK' | 'FUND' } | null
): CSVParseResult {
  const result: CSVParseResult = {
    events: [], instruments: [], warnings: [], errors: [],
    stats: { totalRows: 0, parsedRows: 0, skippedRows: 0, tradeEvents: 0, dividendEvents: 0, cashEvents: 0 }
  };

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array' });
  } catch {
    result.errors.push({ row: 0, message: 'Kunne ikke lese XLSX-filen' });
    return result;
  }

  // Try "transactions" sheet first, then first sheet
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('transaction')) || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    result.errors.push({ row: 0, message: 'Ingen ark funnet i filen' });
    return result;
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  if (rows.length === 0) {
    result.errors.push({ row: 0, message: 'Ingen transaksjoner funnet' });
    return result;
  }

  const seenInstruments = new Map<string, Instrument>();
  const now = new Date().toISOString();

  for (let i = 0; i < rows.length; i++) {
    result.stats.totalRows++;
    const row = rows[i];

    try {
      const isin = String(row['ISIN'] || '').trim();
      const name = String(row['Security'] || '').trim();
      const volume = Number(row['Volume']) || 0;
      const amount = Math.abs(Number(row['Amount']) || 0);
      const price = Number(row['Price']) || 0;
      const fees = Number(row['Fees']) || 0;
      const securityGroup = String(row['Security group'] || '').toLowerCase();

      // Parse trade date (Excel serial number or string)
      const rawDate = row['Trade date'];
      let date: string;
      if (typeof rawDate === 'number') {
        // Excel serial date → JS Date
        const d = XLSX.SSF.parse_date_code(rawDate);
        date = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      } else {
        date = String(rawDate || '').trim();
        // Handle dd.mm.yyyy format
        if (date.includes('.')) {
          const parts = date.split('.');
          if (parts.length === 3) date = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      if (!isin || !date || volume === 0) {
        result.stats.skippedRows++;
        continue;
      }

      // Determine buy/sell from volume sign
      const isBuy = volume > 0;
      const absVolume = Math.abs(volume);

      // Track instruments — resolve ticker from stock list by name
      if (!seenInstruments.has(isin)) {
        const resolved = tickerLookup ? tickerLookup(name) : null;
        const instrumentType = resolved?.type
          || (securityGroup.includes('fund') ? 'FUND' as const : 'STOCK' as const);
        seenInstruments.set(isin, {
          isin,
          ticker: resolved?.ticker || name.split(' ')[0].toUpperCase(),
          name,
          instrumentType,
          currency: 'NOK',
        });
      }

      const event: TradeEvent = {
        id: generateEventId(),
        accountId,
        date,
        type: isBuy ? 'TRADE_BUY' : 'TRADE_SELL',
        isin,
        quantity: absVolume,
        pricePerShare: price || (absVolume > 0 ? amount / absVolume : 0),
        amount,
        fee: fees > 0 ? fees : undefined,
        currency: 'NOK',
        createdAt: now,
        source: 'CSV_IMPORT',
      };

      result.events.push(event);
      result.stats.tradeEvents++;
      result.stats.parsedRows++;
    } catch (e) {
      result.errors.push({ row: i + 1, message: e instanceof Error ? e.message : 'Ukjent feil' });
    }
  }

  result.instruments = Array.from(seenInstruments.values());

  if (result.events.length > 0) {
    result.warnings.push({
      id: generateWarningId(),
      severity: 'INFO',
      message: 'Importert ' + result.events.length + ' transaksjoner fra VPS',
      affectedEventIds: result.events.map(e => e.id),
    });
  }

  return result;
}

/**
 * Check if a file is a VPS XLSX export (by extension or content).
 */
export function isVPSFile(file: File): boolean {
  return file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
}
