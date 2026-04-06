import type { LedgerEvent, Instrument } from '../types';

export interface RealizedGain {
  eventId: string;
  isin: string;
  ticker: string;
  name: string;
  date: string;
  quantitySold: number;
  saleProceeds: number;
  costBasis: number;
  realizedGain: number;
  fee: number;
}

export interface GainsByYear {
  year: number;
  totalGains: number;
  totalLosses: number;
  netGain: number;
  dividends: number;
  trades: RealizedGain[];
}

interface Lot {
  date: string;
  quantity: number;
  costPerShare: number;
}

/**
 * Derive realized gains from all sell events using FIFO.
 * For each sell, match against oldest buy lots first.
 */
export function deriveRealizedGains(
  events: LedgerEvent[],
  instruments: Instrument[]
): RealizedGain[] {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const lots = new Map<string, Lot[]>(); // isin → lot queue
  const gains: RealizedGain[] = [];

  for (const e of sorted) {
    const te = e as unknown as { isin?: string; quantity?: number; pricePerShare?: number; fee?: number };
    if (!te.isin) continue;

    if (e.type === 'TRADE_BUY' && te.quantity && te.pricePerShare) {
      const q = lots.get(te.isin) || [];
      q.push({ date: e.date, quantity: te.quantity, costPerShare: te.pricePerShare });
      lots.set(te.isin, q);
    }

    if (e.type === 'TRADE_SELL' && te.quantity && te.pricePerShare) {
      const q = lots.get(te.isin) || [];
      let remaining = te.quantity;
      let costBasis = 0;

      // FIFO: consume oldest lots first
      while (remaining > 0 && q.length > 0) {
        const lot = q[0];
        const taken = Math.min(lot.quantity, remaining);
        costBasis += taken * lot.costPerShare;
        lot.quantity -= taken;
        remaining -= taken;
        if (lot.quantity <= 0.0001) q.shift(); // remove depleted lot
      }

      const saleProceeds = e.amount;
      const fee = te.fee || 0;
      const realizedGain = saleProceeds - costBasis - fee;

      const inst = instruments.find(i => i.isin === te.isin);
      gains.push({
        eventId: e.id,
        isin: te.isin,
        ticker: inst?.ticker || te.isin,
        name: inst?.name || te.isin,
        date: e.date,
        quantitySold: te.quantity,
        saleProceeds,
        costBasis: Math.round(costBasis * 100) / 100,
        realizedGain: Math.round(realizedGain * 100) / 100,
        fee,
      });
    }
  }

  return gains;
}

/**
 * Group realized gains by year, including dividends.
 */
export function deriveGainsByYear(
  events: LedgerEvent[],
  instruments: Instrument[]
): GainsByYear[] {
  const gains = deriveRealizedGains(events, instruments);

  // Group by year
  const yearMap = new Map<number, { gains: RealizedGain[]; dividends: number }>();

  for (const g of gains) {
    const year = parseInt(g.date.substring(0, 4));
    const entry = yearMap.get(year) || { gains: [], dividends: 0 };
    entry.gains.push(g);
    yearMap.set(year, entry);
  }

  // Add dividends
  for (const e of events) {
    if (e.type === 'DIVIDEND') {
      const year = parseInt(e.date.substring(0, 4));
      const entry = yearMap.get(year) || { gains: [], dividends: 0 };
      entry.dividends += e.amount;
      yearMap.set(year, entry);
    }
  }

  // Sort by year descending
  return Array.from(yearMap.entries())
    .map(([year, data]) => {
      const totalGains = data.gains.filter(g => g.realizedGain > 0).reduce((s, g) => s + g.realizedGain, 0);
      const totalLosses = data.gains.filter(g => g.realizedGain < 0).reduce((s, g) => s + g.realizedGain, 0);
      return {
        year,
        totalGains: Math.round(totalGains * 100) / 100,
        totalLosses: Math.round(totalLosses * 100) / 100,
        netGain: Math.round((totalGains + totalLosses) * 100) / 100,
        dividends: Math.round(data.dividends * 100) / 100,
        trades: data.gains,
      };
    })
    .sort((a, b) => b.year - a.year);
}
