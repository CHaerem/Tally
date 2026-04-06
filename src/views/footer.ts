import type { AppState } from '../state';

export function renderFooter(state: AppState): string {
  const hasSells = state.ledger.events.some(e => e.type === 'TRADE_SELL');
  return '<div class="footer-actions">'
    + '<div class="footer-links">'
    + '<button class="footer-txn-link" id="show-txn-log">'
    + state.ledger.events.length + ' transaksjoner'
    + '</button>'
    + (hasSells ? '<button class="footer-txn-link" id="show-gains">Gevinst/tap</button>' : '')
    + '</div>'
    + '<div class="footer-buttons">'
    + '<button class="btn btn-small btn-ghost" id="export-json">Eksporter</button>'
    + '<button class="btn btn-small btn-danger-outline" id="clear-data">Slett</button>'
    + '</div>'
    + '</div>';
}
