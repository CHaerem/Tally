import type { AppState } from '../state';
import { updateDerivedData } from '../state';
import { LedgerStorage } from '../ledger';
import { fetchPricesForHoldings, fetchLivePrice, fetchStockQuote, fetchMarketData, fetchFundamentals } from '../api';
import type { StockQuote, Fundamentals } from '../api';
import { formatCurrency } from '../calculations';

export async function refreshPrices(state: AppState, callbacks: {
  onRerender: () => void;
  onComputePortfolioHistory: () => void;
  onSyncDividends: () => void;
}): Promise<void> {
  if (state.isFetchingPrices) return;
  const tickers = state.ledger.instruments.map(i => ({ isin: i.isin, ticker: i.ticker }));
  if (tickers.length === 0) return;

  state.isFetchingPrices = true;
  callbacks.onRerender();

  const fetched = await fetchPricesForHoldings(tickers);
  for (const [isin, price] of fetched) {
    state.currentPrices.set(isin, price);
  }
  if (fetched.size > 0) {
    LedgerStorage.savePrices(state.currentPrices);
  }

  state.isFetchingPrices = false;
  updateDerivedData(state);
  callbacks.onRerender();
  callbacks.onComputePortfolioHistory();
  callbacks.onSyncDividends();
}

export async function fetchOBXPrice(state: AppState): Promise<void> {
  const price = await fetchLivePrice('^OBX');
  if (price !== null) {
    state.obxPrice = price;
    const el = document.getElementById('obx-price');
    if (el) el.textContent = price.toFixed(2);
  }
}

export async function loadDailyChanges(state: AppState): Promise<void> {
  for (const h of state.holdings) {
    const inst = state.ledger.instruments.find(i => i.isin === h.isin);
    if (!inst) continue;
    const quote = state.quoteCache.get(inst.ticker) || await fetchStockQuote(inst.ticker);
    if (quote) {
      state.quoteCache.set(inst.ticker, quote);
      const el = document.getElementById('daily-' + h.isin);
      if (el && quote.dayChangePct !== null) {
        const sign = quote.dayChangePct >= 0 ? '+' : '';
        const cls = quote.dayChangePct >= 0 ? 'text-success' : 'text-danger';
        el.innerHTML = '<span class="' + cls + '">' + sign + quote.dayChangePct.toFixed(1) + '% i dag</span>';
      }
    }
  }
}

export function loadMarketStats(state: AppState, ticker: string): void {
  const safeTicker = ticker.replace(/\./g, '_');

  fetchMarketData(ticker).then(md => {
    if (md) fillMarketData(safeTicker, md);
  });
  fetchFundamentals(ticker).then(f => {
    if (f) fillFundamentals(safeTicker, f);
  });

  const cached = state.quoteCache.get(ticker);
  if (cached) {
    fillLiveQuote(safeTicker, cached);
  } else {
    fetchStockQuote(ticker).then(quote => {
      if (!quote) return;
      state.quoteCache.set(ticker, quote);
      fillLiveQuote(safeTicker, quote);
    });
  }
}

export function fillMarketData(safeTicker: string, md: { previousClose: number | null; dayHigh: number | null; dayLow: number | null; volume: number | null; fiftyTwoWeekHigh: number | null; fiftyTwoWeekLow: number | null }): void {
  const w52El = document.getElementById('mstat-52w-' + safeTicker);
  const volEl = document.getElementById('mstat-vol-' + safeTicker);
  if (w52El && md.fiftyTwoWeekLow !== null && md.fiftyTwoWeekHigh !== null) {
    w52El.className = 'value';
    w52El.textContent = formatCurrency(md.fiftyTwoWeekLow, 2) + ' — ' + formatCurrency(md.fiftyTwoWeekHigh, 2);
  }
  if (volEl && md.volume !== null) {
    volEl.className = 'value';
    volEl.textContent = md.volume.toLocaleString('nb-NO');
  }
}

export function fillFundamentals(safeTicker: string, f: Fundamentals): void {
  const peEl = document.getElementById('mstat-pe-' + safeTicker);
  const pbEl = document.getElementById('mstat-pb-' + safeTicker);
  const mcapEl = document.getElementById('mstat-mcap-' + safeTicker);
  const divyEl = document.getElementById('mstat-divy-' + safeTicker);
  const marginEl = document.getElementById('mstat-margin-' + safeTicker);

  if (peEl) {
    peEl.className = 'value';
    peEl.textContent = f.trailingPE ? f.trailingPE.toFixed(1) : (f.forwardPE ? f.forwardPE.toFixed(1) + ' (fwd)' : '—');
  }
  if (pbEl) {
    pbEl.className = 'value';
    pbEl.textContent = f.priceToBook ? f.priceToBook.toFixed(2) : '—';
  }
  if (mcapEl && f.marketCap) {
    mcapEl.className = 'value';
    if (f.marketCap >= 1e12) mcapEl.textContent = (f.marketCap / 1e12).toFixed(1) + ' bill kr';
    else if (f.marketCap >= 1e9) mcapEl.textContent = (f.marketCap / 1e9).toFixed(1) + ' mrd kr';
    else mcapEl.textContent = (f.marketCap / 1e6).toFixed(0) + ' mill kr';
  }
  if (divyEl) {
    divyEl.className = 'value';
    divyEl.textContent = f.dividendYield ? (f.dividendYield * 100).toFixed(2) + '%' : '—';
  }
  if (marginEl) {
    marginEl.className = 'value';
    marginEl.textContent = f.profitMargins ? (f.profitMargins * 100).toFixed(1) + '%' : '—';
  }
}

export function fillLiveQuote(safeTicker: string, q: StockQuote): void {
  const dayEl = document.getElementById('mstat-day-' + safeTicker);
  const w52El = document.getElementById('mstat-52w-' + safeTicker);
  const volEl = document.getElementById('mstat-vol-' + safeTicker);

  if (dayEl && q.dayChange !== null && q.dayChangePct !== null) {
    const sign = q.dayChange >= 0 ? '+' : '';
    const cls = q.dayChange >= 0 ? 'text-success' : 'text-danger';
    dayEl.className = 'value ' + cls;
    dayEl.textContent = sign + q.dayChange.toFixed(2) + ' (' + sign + q.dayChangePct.toFixed(2) + '%)';
  }
  if (w52El && q.weekLow52 !== null && q.weekHigh52 !== null) {
    w52El.className = 'value';
    w52El.textContent = formatCurrency(q.weekLow52, 2) + ' — ' + formatCurrency(q.weekHigh52, 2);
  }
  if (volEl && q.volume !== null) {
    volEl.className = 'value';
    volEl.textContent = q.volume.toLocaleString('nb-NO');
  }
}
