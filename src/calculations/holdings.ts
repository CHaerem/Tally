import type { LedgerEvent, TradeEvent, DividendEvent, Instrument, Holding, PortfolioMetrics, CashFlow } from '../types';
import { isTradeEvent, isDividendEvent, isCashEvent, isFeeEvent } from '../types';
import { calculateXIRR } from './xirr';

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
