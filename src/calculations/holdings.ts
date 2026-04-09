import type { LedgerEvent, TradeEvent, DividendEvent, Instrument, Holding, PortfolioMetrics, CashFlow } from '../types';
import { isTradeEvent, isDividendEvent, isCashEvent, isFeeEvent } from '../types';
import { calculateXIRR } from './xirr';

export type ReturnPeriod = 'total' | 'ytd' | '1y' | '3y' | '5y';

export function getPeriodStartDate(period: ReturnPeriod): Date | null {
  if (period === 'total') return null;
  const now = new Date();
  if (period === 'ytd') return new Date(now.getFullYear(), 0, 1);
  const years = period === '1y' ? 1 : period === '3y' ? 3 : 5;
  return new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
}

/**
 * Calculate XIRR for a specific time period.
 * Uses the portfolio value at period start as initial "investment",
 * includes all events within the period, and current value as terminal.
 */
export function calculatePeriodXIRR(
  events: LedgerEvent[],
  period: ReturnPeriod,
  currentValue: number,
  portfolioSeries: Array<{ date: string; value: number }> | null,
): number | null {
  if (period === 'total') {
    const cashFlows = deriveCashFlows(events, currentValue);
    return calculateXIRR(cashFlows);
  }

  const startDate = getPeriodStartDate(period);
  if (!startDate) return null;

  const startISO = startDate.toISOString().slice(0, 10);

  // Find portfolio value at period start from history
  let startValue = 0;
  if (portfolioSeries && portfolioSeries.length > 0) {
    // Find closest date <= startDate
    let closest: { date: string; value: number } | null = null;
    for (const pt of portfolioSeries) {
      if (pt.date <= startISO) closest = pt;
      else break;
    }
    if (closest) {
      startValue = closest.value;
    } else {
      // Period starts before any history — all events are within period
      startValue = 0;
    }
  } else {
    // No history available — can't compute period return
    return null;
  }

  // Build cash flows: starting value as outflow, events in period, current value as inflow
  const cashFlows: CashFlow[] = [];

  if (startValue > 0) {
    cashFlows.push({ date: startDate, amount: -startValue });
  }

  // Add events within the period
  for (const event of events) {
    const eventDate = new Date(event.date);
    if (eventDate < startDate) continue;

    const date = eventDate;
    if (isCashEvent(event)) {
      cashFlows.push({ date, amount: event.type === 'CASH_IN' ? -event.amount : event.amount });
    } else if (isTradeEvent(event)) {
      const tradeAmount = event.amount + (event.fee || 0);
      cashFlows.push({ date, amount: event.type === 'TRADE_BUY' ? -tradeAmount : event.amount });
    } else if (isDividendEvent(event)) {
      cashFlows.push({ date, amount: event.amount });
    } else if (isFeeEvent(event)) {
      cashFlows.push({ date, amount: -event.amount });
    }
  }

  if (currentValue > 0) {
    cashFlows.push({ date: new Date(), amount: currentValue });
  }

  if (cashFlows.length < 2) return null;

  return calculateXIRR(cashFlows);
}

export function deriveHoldings(
  events: LedgerEvent[],
  instruments: Instrument[],
  currentPrices: Map<string, number>
): Holding[] {
  const instrumentMap = new Map(instruments.map(i => [i.isin, i]));
  const byIsin = new Map<string, { trades: TradeEvent[]; dividends: DividendEvent[] }>();

  for (const event of events) {
    if (isTradeEvent(event)) {
      const existing = byIsin.get(event.isin) || { trades: [], dividends: [] };
      existing.trades.push(event);
      byIsin.set(event.isin, existing);
    } else if (isDividendEvent(event)) {
      const existing = byIsin.get(event.isin) || { trades: [], dividends: [] };
      existing.dividends.push(event);
      byIsin.set(event.isin, existing);
    }
  }

  const holdings: Holding[] = [];

  for (const [isin, { trades, dividends }] of byIsin) {
    const sortedTrades = [...trades].sort((a, b) => a.date.localeCompare(b.date));
    let quantity = 0;
    let totalCost = 0;
    let totalDividendsReceived = 0;

    for (const trade of sortedTrades) {
      if (trade.type === 'TRADE_BUY') {
        quantity += trade.quantity;
        totalCost += trade.amount + (trade.fee || 0);
      } else {
        if (quantity > 0) {
          const avgCostPerShare = totalCost / quantity;
          totalCost -= avgCostPerShare * trade.quantity;
          quantity -= trade.quantity;
        }
      }
    }

    for (const div of dividends) {
      totalDividendsReceived += div.amount;
    }

    if (quantity > 0) {
      const instrument = instrumentMap.get(isin);
      const currentPrice = currentPrices.get(isin) || 0;
      const marketValue = quantity * currentPrice;
      const unrealizedGain = marketValue - totalCost;

      holdings.push({
        isin,
        ticker: instrument?.ticker || isin.substring(0, 6),
        name: instrument?.name || 'Ukjent',
        quantity,
        costBasis: totalCost,
        averageCostPerShare: totalCost / quantity,
        currentPrice,
        marketValue,
        unrealizedGain,
        unrealizedGainPercent: totalCost > 0 ? (unrealizedGain / totalCost) * 100 : 0,
        totalDividendsReceived,
      });
    }
  }

  return holdings.sort((a, b) => b.marketValue - a.marketValue);
}

export function deriveCashFlows(events: LedgerEvent[], terminalValue: number, terminalDate: Date = new Date()): CashFlow[] {
  const cashFlows: CashFlow[] = [];

  for (const event of events) {
    const date = new Date(event.date);

    if (isCashEvent(event)) {
      cashFlows.push({ date, amount: event.type === 'CASH_IN' ? -event.amount : event.amount });
    } else if (isTradeEvent(event)) {
      const tradeAmount = event.amount + (event.fee || 0);
      cashFlows.push({ date, amount: event.type === 'TRADE_BUY' ? -tradeAmount : event.amount });
    } else if (isDividendEvent(event)) {
      cashFlows.push({ date, amount: event.amount });
    } else if (isFeeEvent(event)) {
      cashFlows.push({ date, amount: -event.amount });
    }
  }

  if (terminalValue > 0) {
    cashFlows.push({ date: terminalDate, amount: terminalValue });
  }

  return cashFlows;
}

export function derivePortfolioMetrics(events: LedgerEvent[], holdings: Holding[]): PortfolioMetrics {
  let totalInvested = 0, totalWithdrawn = 0, totalDividends = 0, totalFees = 0;

  for (const event of events) {
    if (isCashEvent(event)) {
      if (event.type === 'CASH_IN') totalInvested += event.amount;
      else totalWithdrawn += event.amount;
    } else if (isDividendEvent(event)) {
      totalDividends += event.amount;
    } else if (isFeeEvent(event)) {
      totalFees += event.amount;
    } else if (isTradeEvent(event) && event.fee) {
      totalFees += event.fee;
    }
  }

  const currentValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const cashFlows = deriveCashFlows(events, currentValue);
  const xirr = calculateXIRR(cashFlows);

  return {
    totalInvested,
    totalWithdrawn,
    netCashFlow: totalInvested - totalWithdrawn,
    currentValue,
    totalDividends,
    totalFees,
    xirr,
    xirrPercent: xirr !== null ? xirr * 100 : null,
  };
}

export interface DividendByYear {
  year: number;
  total: number;
}

export interface DividendByHolding {
  isin: string;
  ticker: string;
  name: string;
  total: number;
  yieldOnCost: number | null; // dividend / costBasis as percentage
}

export interface DividendSummary {
  totalAllTime: number;
  byYear: DividendByYear[];
  byHolding: DividendByHolding[];
}

export function deriveDividendSummary(
  events: LedgerEvent[],
  instruments: Instrument[],
  holdings: Holding[],
): DividendSummary {
  const dividends = events.filter(isDividendEvent);
  const instrumentMap = new Map(instruments.map(i => [i.isin, i]));

  // By year
  const yearMap = new Map<number, number>();
  let totalAllTime = 0;
  for (const div of dividends) {
    const year = new Date(div.date).getFullYear();
    yearMap.set(year, (yearMap.get(year) || 0) + div.amount);
    totalAllTime += div.amount;
  }
  const byYear = Array.from(yearMap.entries())
    .map(([year, total]) => ({ year, total }))
    .sort((a, b) => a.year - b.year);

  // By holding
  const holdingMap = new Map<string, number>();
  for (const div of dividends) {
    holdingMap.set(div.isin, (holdingMap.get(div.isin) || 0) + div.amount);
  }
  const byHolding = Array.from(holdingMap.entries())
    .map(([isin, total]) => {
      const inst = instrumentMap.get(isin);
      const holding = holdings.find(h => h.isin === isin);
      const costBasis = holding?.costBasis || 0;
      return {
        isin,
        ticker: inst?.ticker || isin.substring(0, 6),
        name: inst?.name || 'Ukjent',
        total,
        yieldOnCost: costBasis > 0 ? (total / costBasis) * 100 : null,
      };
    })
    .sort((a, b) => b.total - a.total);

  return { totalAllTime, byYear, byHolding };
}

/**
 * Given existing events and dividend history from static data,
 * compute which dividend events are missing and should be created.
 * Returns new DividendEvent objects ready to be added to the ledger.
 */
export function buildMissingDividendEvents(
  events: LedgerEvent[],
  isin: string,
  dividendHistory: Array<{ date: string; amount: number }>,
  generateId: () => string,
): DividendEvent[] {
  // Existing dividend dates for this ISIN
  const existingKeys = new Set(
    events.filter(isDividendEvent)
      .filter(e => e.isin === isin)
      .map(e => e.date)
  );

  // Trade timeline for quantity calculation
  const trades = events
    .filter(isTradeEvent)
    .filter(e => e.isin === isin)
    .sort((a, b) => a.date.localeCompare(b.date));

  const firstBuy = trades.find(t => t.type === 'TRADE_BUY');
  if (!firstBuy) return [];

  const result: DividendEvent[] = [];
  const now = new Date().toISOString();

  for (const div of dividendHistory) {
    if (div.date < firstBuy.date) continue;
    if (existingKeys.has(div.date)) continue;

    // Quantity held on dividend date
    let qty = 0;
    for (const trade of trades) {
      if (trade.date > div.date) break;
      if (trade.type === 'TRADE_BUY') qty += trade.quantity;
      else qty -= trade.quantity;
    }
    if (qty <= 0) continue;

    const amount = +(div.amount * qty).toFixed(2);
    result.push({
      id: generateId(),
      accountId: 'default',
      date: div.date,
      type: 'DIVIDEND',
      amount,
      currency: 'NOK',
      createdAt: now,
      source: 'AUTO',
      isin,
      quantity: qty,
      perShare: div.amount,
    });
  }

  return result;
}
