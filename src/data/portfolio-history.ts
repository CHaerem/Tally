import type { AppState } from '../state';
import { fetchPriceHistory } from '../api';
import { renderPortfolioChartSVG, drawPortfolioChart, attachChartInteraction } from '../charts/portfolio-chart';
import { renderDividendList, attachDividendToggle } from './dividends';

export async function computePortfolioHistory(state: AppState): Promise<void> {
  if (state.isLoadingChart || state.ledger.events.length === 0) return;
  state.isLoadingChart = true;

  try {
    // Collect unique ISINs and their tickers
    const isinTickers = new Map<string, string>();
    for (const e of state.ledger.events) {
      if ('isin' in e) {
        const ev = e as unknown as { isin: string };
        const inst = state.ledger.instruments.find(i => i.isin === ev.isin);
        if (inst) isinTickers.set(inst.isin, inst.ticker);
      }
    }

    // Fetch price histories in parallel
    const priceMap = new Map<string, Array<{ date: string; close: number }>>();
    const fetches = Array.from(isinTickers.entries()).map(async ([isin, ticker]) => {
      const prices = await fetchPriceHistory(ticker);
      if (prices.length > 0) priceMap.set(isin, prices);
    });
    await Promise.allSettled(fetches);

    // Build price lookup: closest price on or before date
    const getPrice = (isin: string, date: string): number | null => {
      const prices = priceMap.get(isin);
      if (!prices) return null;
      let best: number | null = null;
      for (const p of prices) {
        if (p.date <= date) best = p.close;
        else break;
      }
      return best;
    };

    // Sort events chronologically
    const sortedEvents = [...state.ledger.events].sort((a, b) => a.date.localeCompare(b.date));
    if (sortedEvents.length === 0) { state.isLoadingChart = false; return; }

    // Collect all unique dates from price histories (sampled weekly)
    const allDates = new Set<string>();
    for (const prices of priceMap.values()) {
      for (let i = 0; i < prices.length; i += 5) {
        allDates.add(prices[i].date);
      }
      if (prices.length > 0) allDates.add(prices[prices.length - 1].date);
    }
    for (const e of sortedEvents) allDates.add(e.date);
    const today = new Date().toISOString().split('T')[0];
    allDates.add(today);

    const firstEventDate = sortedEvents[0].date;
    const sampleDates = Array.from(allDates)
      .filter(d => d >= firstEventDate)
      .sort();

    // Replay events to compute portfolio value at each sample date
    const quantities = new Map<string, number>();
    let totalCostBasis = 0;
    let eventIdx = 0;
    const series: Array<{ date: string; value: number; costBasis: number }> = [];
    const eventMarkers: Array<{ date: string; type: string; amount: number; name: string }> = [];

    for (const date of sampleDates) {
      while (eventIdx < sortedEvents.length && sortedEvents[eventIdx].date <= date) {
        const ev = sortedEvents[eventIdx];
        if (ev.type === 'TRADE_BUY' || ev.type === 'TRADE_SELL') {
          const te = ev as unknown as { isin: string; quantity: number; fee?: number };
          const prevQty = quantities.get(te.isin) || 0;
          if (ev.type === 'TRADE_BUY') {
            quantities.set(te.isin, prevQty + te.quantity);
            totalCostBasis += ev.amount + (te.fee || 0);
          } else {
            quantities.set(te.isin, prevQty - te.quantity);
            totalCostBasis -= ev.amount;
          }
          const inst = state.ledger.instruments.find(i => i.isin === te.isin);
          eventMarkers.push({ date: ev.date, type: ev.type, amount: ev.amount, name: inst?.name || te.isin });
        } else if (ev.type === 'DIVIDEND') {
          const de = ev as unknown as { isin: string };
          const inst = state.ledger.instruments.find(i => i.isin === de.isin);
          eventMarkers.push({ date: ev.date, type: ev.type, amount: ev.amount, name: inst?.name || de.isin });
        }
        eventIdx++;
      }

      let value = 0;
      let hasAnyPrice = false;
      for (const [isin, qty] of quantities) {
        if (qty <= 0) continue;
        const price = getPrice(isin, date);
        if (price !== null) {
          value += qty * price;
          hasAnyPrice = true;
        }
      }

      if (hasAnyPrice || value === 0) {
        series.push({ date, value, costBasis: totalCostBasis });
      }
    }

    state.portfolioHistory = { series, events: eventMarkers };

    // Inject into DOM
    const container = document.getElementById('portfolio-chart-container');
    if (container && series.length >= 2) {
      container.innerHTML = renderPortfolioChartSVG(state);
      drawPortfolioChart(state);
      attachChartInteraction(state);
    } else if (container) {
      container.innerHTML = '';
    }
    const divList = document.getElementById('portfolio-dividend-list');
    if (divList) {
      divList.innerHTML = renderDividendList(state);
      attachDividendToggle();
    }

  } finally {
    state.isLoadingChart = false;
  }
}

export function reattachChartIfNeeded(state: AppState): void {
  if (!state.portfolioHistory) return;
  const container = document.getElementById('portfolio-chart-container');
  if (container && state.portfolioHistory.series.length >= 2) {
    container.innerHTML = renderPortfolioChartSVG(state);
    drawPortfolioChart(state);
    attachChartInteraction(state);
  }
  const divList = document.getElementById('portfolio-dividend-list');
  if (divList) {
    divList.innerHTML = renderDividendList(state);
    attachDividendToggle();
  }
}
