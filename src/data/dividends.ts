import type { AppState } from '../state';
import { updateDerivedData } from '../state';
import { LedgerStorage, generateEventId } from '../ledger';
import { fetchDividendHistory } from '../api';
import { buildMissingDividendEvents, formatCurrency, formatDateShort } from '../calculations';
import type { DividendEvent } from '../types';

export async function syncDividends(state: AppState, callbacks: {
  onRerender: () => void;
  onReattachChart: () => void;
}): Promise<void> {
  const instruments = state.ledger.instruments;
  if (instruments.length === 0) return;

  const newEvents: DividendEvent[] = [];

  const results = await Promise.allSettled(
    instruments.map(async (inst) => {
      const history = await fetchDividendHistory(inst.ticker);
      if (history.length === 0) return;
      const missing = buildMissingDividendEvents(
        state.ledger.events, inst.isin, history, generateEventId,
      );
      newEvents.push(...missing);
    })
  );
  void results;

  if (newEvents.length > 0) {
    state.ledger = LedgerStorage.addEvents(newEvents);
    updateDerivedData(state);
    callbacks.onRerender();
    callbacks.onReattachChart();
  }
}

export function renderDividendList(state: AppState): string {
  if (!state.dividendSummary || state.dividendSummary.totalAllTime === 0) return '';
  const ds = state.dividendSummary;

  // Year bars
  const maxYear = Math.max(...ds.byYear.map(y => y.total));
  const yearBars = ds.byYear.map(y => {
    const pct = maxYear > 0 ? (y.total / maxYear) * 100 : 0;
    return '<div class="div-year-row">'
      + '<span class="div-year-label">' + y.year + '</span>'
      + '<div class="div-year-bar-bg"><div class="div-year-bar" style="width:' + pct.toFixed(1) + '%"></div></div>'
      + '<span class="div-year-amount">' + formatCurrency(y.total) + '</span>'
      + '</div>';
  }).join('');

  // Per holding
  const holdingRows = ds.byHolding.map(h => {
    const inst = state.ledger.instruments.find(i => i.isin === h.isin);
    const isFund = inst?.instrumentType === 'FUND';
    const label = isFund ? h.name : h.ticker;
    const yoc = h.yieldOnCost !== null ? h.yieldOnCost.toFixed(1) + '%' : '—';
    return '<div class="div-holding-row">'
      + '<span class="div-holding-name">' + label + '</span>'
      + '<span class="div-holding-yoc">' + yoc + '</span>'
      + '<span class="div-holding-amount">' + formatCurrency(h.total) + '</span>'
      + '</div>';
  }).join('');

  // Individual transactions (collapsed by default)
  const dividends = state.ledger.events
    .filter(e => e.type === 'DIVIDEND')
    .sort((a, b) => b.date.localeCompare(a.date));

  const txnRows = dividends.map(e => {
    const de = e as unknown as { isin: string };
    const inst = state.ledger.instruments.find(i => i.isin === de.isin);
    const isFund = inst?.instrumentType === 'FUND';
    const name = isFund ? inst?.name || de.isin : inst?.ticker || de.isin;
    return '<div class="txn-row">'
      + '<span class="txn-date">' + formatDateShort(e.date) + '</span>'
      + '<span class="txn-type txn-type-dividend">' + name + '</span>'
      + '<span class="txn-amount">' + formatCurrency(e.amount) + '</span>'
      + '</div>';
  }).join('');

  return '<div class="dividend-list">'
    + '<div class="txn-header">Utbytter</div>'
    + '<div class="div-year-chart">' + yearBars + '</div>'
    + (ds.byHolding.length > 1
      ? '<div class="div-by-holding">'
        + '<div class="div-holding-header">'
        + '<span>Beholdning</span><span>YoC</span><span>Totalt</span>'
        + '</div>'
        + holdingRows
        + '</div>'
      : '')
    + '<div class="div-txn-toggle" id="div-txn-toggle">Vis transaksjoner</div>'
    + '<div class="div-txn-list" id="div-txn-list">' + txnRows + '</div>'
    + '</div>';
}

export function attachDividendToggle(): void {
  const toggle = document.getElementById('div-txn-toggle');
  const list = document.getElementById('div-txn-list');
  if (toggle && list) {
    toggle.addEventListener('click', () => {
      const isActive = list.classList.toggle('active');
      toggle.textContent = isActive ? 'Skjul transaksjoner' : 'Vis transaksjoner';
    });
  }
}
