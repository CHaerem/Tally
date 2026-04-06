import type { AppState } from '../state';
import { formatCurrency, formatDateShort, deriveGainsByYear } from '../calculations';

export function renderGainsView(state: AppState): string {
  const years = deriveGainsByYear(state.ledger.events, state.ledger.instruments);
  if (years.length === 0) return '';

  const rows = years.map(y => {
    const netClass = y.netGain >= 0 ? 'text-success' : 'text-danger';
    const netSign = y.netGain >= 0 ? '+' : '';
    const tradeRows = y.trades.map(t => {
      const tClass = t.realizedGain >= 0 ? 'text-success' : 'text-danger';
      const tSign = t.realizedGain >= 0 ? '+' : '';
      return '<div class="gains-trade">'
        + '<span class="gains-trade-name">' + t.name + '</span>'
        + '<span class="gains-trade-detail">' + formatDateShort(t.date) + ' · ' + t.quantitySold + ' stk</span>'
        + '<span class="gains-trade-amount ' + tClass + '">' + tSign + formatCurrency(t.realizedGain) + '</span>'
        + '</div>';
    }).join('');

    return '<div class="gains-year">'
      + '<div class="gains-year-header">'
      + '<span class="gains-year-label">' + y.year + '</span>'
      + '<span class="gains-year-net ' + netClass + '">' + netSign + formatCurrency(y.netGain) + '</span>'
      + '</div>'
      + '<div class="gains-year-breakdown">'
      + (y.totalGains > 0 ? '<div class="gains-row"><span>Gevinster</span><span class="text-success">+' + formatCurrency(y.totalGains) + '</span></div>' : '')
      + (y.totalLosses < 0 ? '<div class="gains-row"><span>Tap</span><span class="text-danger">' + formatCurrency(y.totalLosses) + '</span></div>' : '')
      + (y.dividends > 0 ? '<div class="gains-row"><span>Utbytte</span><span>+' + formatCurrency(y.dividends) + '</span></div>' : '')
      + '</div>'
      + '<div class="gains-trades">' + tradeRows + '</div>'
      + '</div>';
  }).join('');

  return '<div class="modal" id="gains-modal">'
    + '<div class="modal-sheet txn-log-sheet">'
    + '<div class="modal-handle"></div>'
    + '<div class="txnlog-header">'
    + '<h3>Realisert gevinst/tap</h3>'
    + '<button class="btn btn-small btn-ghost" id="gains-close">Lukk</button>'
    + '</div>'
    + '<div class="txnlog-list">' + rows + '</div>'
    + '</div></div>';
}
