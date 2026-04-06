import type { AppState } from '../state';
import { LedgerStorage } from '../ledger';
import type { LedgerState } from '../types';

export function checkShareUrl(state: AppState): void {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return;

  try {
    const encoded = hash.substring(7);
    const json = decodeURIComponent(atob(encoded));
    const shared = JSON.parse(json) as { events: LedgerState['events']; instruments: LedgerState['instruments'] };

    if (!shared.events?.length) return;

    const count = shared.events.length;
    const tickers = shared.instruments?.map(i => i.ticker).join(', ') || '';
    if (!confirm('Du har mottatt en portefølje med ' + count + ' transaksjoner' + (tickers ? ' (' + tickers + ')' : '') + '.\n\nVil du importere den?')) {
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    LedgerStorage.addEvents(shared.events);
    for (const inst of shared.instruments || []) {
      LedgerStorage.upsertInstrument(inst);
    }
    state.ledger = LedgerStorage.loadLedger() || state.ledger;

    // Clean URL
    window.history.replaceState(null, '', window.location.pathname);
  } catch {
    // Invalid share data
    window.history.replaceState(null, '', window.location.pathname);
  }
}

export async function shareData(state: AppState): Promise<void> {
  const payload = {
    events: state.ledger.events,
    instruments: state.ledger.instruments,
  };
  const json = JSON.stringify(payload);
  const encoded = btoa(encodeURIComponent(json));
  const url = window.location.origin + window.location.pathname + '#share=' + encoded;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Tally portefølje', url });
      return;
    } catch {
      // User cancelled or share failed
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    alert('Lenke kopiert! Åpne den på en annen enhet for å importere porteføljen.');
  } catch {
    prompt('Kopier denne lenken:', url);
  }
}

export function exportData(): void {
  const json = LedgerStorage.exportAsJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tally-backup-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
}

export function clearAllData(state: AppState, callbacks: {
  onRerender: () => void;
}): void {
  if (confirm('Er du sikker på at du vil slette alle data? Dette kan ikke angres.')) {
    LedgerStorage.clearLedger();
    state.currentPrices.clear();
    LedgerStorage.savePrices(state.currentPrices);
    state.ledger = LedgerStorage.initializeLedger();
    state.holdings = [];
    state.metrics = null;
    callbacks.onRerender();
  }
}
