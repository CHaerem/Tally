import type { AppState } from '../state';
import { formatCurrency, formatDateShort } from '../calculations';

export function renderTransactionLog(state: AppState): string {
  const events = [...state.ledger.events].sort((a, b) => b.date.localeCompare(a.date));
  const typeLabels: Record<string, string> = {
    'TRADE_BUY': 'Kjøp', 'TRADE_SELL': 'Salg', 'DIVIDEND': 'Utbytte',
    'CASH_IN': 'Innskudd', 'CASH_OUT': 'Uttak', 'FEE': 'Gebyr',
  };
  const typeIcons: Record<string, string> = {
    'TRADE_BUY': '↑', 'TRADE_SELL': '↓', 'DIVIDEND': '●',
    'CASH_IN': '+', 'CASH_OUT': '−', 'FEE': '−',
  };

  const rows = events.map(e => {
    const label = typeLabels[e.type] || e.type;
    void typeIcons; // kept for potential future use
    const te = e as unknown as { isin?: string; quantity?: number; pricePerShare?: number; perShare?: number };
    const inst = te.isin ? state.ledger.instruments.find(i => i.isin === te.isin) : null;
    const instName = inst ? (inst.instrumentType === 'FUND' ? inst.name : inst.ticker) : '';
    const detail = te.quantity && (te.pricePerShare || te.perShare)
      ? te.quantity + (Number.isInteger(te.quantity) ? '' : '') + ' stk × ' + formatCurrency((te.pricePerShare || te.perShare)!, 2)
      : '';
    const typeClass = e.type === 'TRADE_BUY' ? 'txnlog-buy'
      : e.type === 'TRADE_SELL' ? 'txnlog-sell'
      : e.type === 'DIVIDEND' ? 'txnlog-div' : '';
    const sourceTag = e.source === 'AUTO' ? ' <span class="txn-source-tag">auto</span>' : '';

    return '<div class="txnlog-card" data-event-id="' + e.id + '">'
      + '<div class="txnlog-body">'
      + '<div class="txnlog-line1">'
      + '<span class="txnlog-label ' + typeClass + '">' + label + '</span>'
      + '<span class="txnlog-name">' + instName + sourceTag + '</span>'
      + '</div>'
      + '<div class="txnlog-line2">'
      + '<span class="txnlog-date">' + formatDateShort(e.date) + '</span>'
      + (detail ? '<span class="txnlog-detail">' + detail + '</span>' : '')
      + '</div>'
      + '</div>'
      + '<div class="txnlog-amount">' + formatCurrency(e.amount) + '</div>'
      + '<div class="txnlog-expand" id="txnlog-expand-' + e.id + '">'
      + '<button class="btn btn-small btn-outline txnlog-edit-btn" data-event-id="' + e.id + '">Rediger</button>'
      + '<button class="btn btn-small btn-danger-outline txnlog-delete-btn" data-event-id="' + e.id + '">Slett</button>'
      + '</div>'
      + '</div>';
  }).join('');

  return '<div class="modal" id="txn-log-modal">'
    + '<div class="modal-sheet txn-log-sheet">'
    + '<div class="modal-handle"></div>'
    + '<div class="txnlog-header">'
    + '<h3>Transaksjoner</h3>'
    + '<button class="btn btn-small btn-ghost" id="txn-log-close">Lukk</button>'
    + '</div>'
    + '<div class="txnlog-list">' + (rows || '<div class="text-muted text-small" style="padding:40px;text-align:center">Ingen transaksjoner ennå</div>') + '</div>'
    + '</div></div>';
}
