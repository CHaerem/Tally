import type { AppState } from '../state';

export function renderHeader(state: AppState): string {
  const hasData = state.ledger.events.length > 0;
  const actions = hasData
    ? '<div class="header-actions">'
      + '<button class="btn-icon" id="share-data" aria-label="Del"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></button>'
      + '<button class="btn-icon" id="import-csv" aria-label="Importer"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="12"/><line x1="15" y1="15" x2="12" y2="12"/></svg></button>'
      + '</div>'
    : '';
  const fab = hasData
    ? '<button class="fab" id="add-trade" aria-label="Legg til"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>'
    : '';
  return '<header><div class="container header-inner"><h1>Tally</h1>' + actions + '</div></header>' + fab;
}

export function renderEmptyState(): string {
  return '<div class="card empty-state">'
    + '<div class="onboard-brand">T</div>'
    + '<h2>Se din faktiske avkastning</h2>'
    + '<p>Legg inn investeringene dine og se hva de virkelig har gitt i avkastning.</p>'
    + '<div class="onboard-features">'
    + '<div class="onboard-feature">'
    + '<svg class="onboard-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'
    + '<div><div class="onboard-feature-title">Faktisk avkastning</div><div class="onboard-feature-desc">Beregner din reelle avkastning basert på kjøpstidspunkt og pris</div></div>'
    + '</div>'
    + '<div class="onboard-feature">'
    + '<svg class="onboard-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
    + '<div><div class="onboard-feature-title">Privat og trygt</div><div class="onboard-feature-desc">Alt lagres lokalt på din enhet. Ingen konto, ingen sky.</div></div>'
    + '</div>'
    + '<div class="onboard-feature">'
    + '<svg class="onboard-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'
    + '<div><div class="onboard-feature-title">Helt gratis</div><div class="onboard-feature-desc">Ingen abonnement, ingen annonser, ingen skjulte kostnader.</div></div>'
    + '</div>'
    + '</div>'
    + '<div class="empty-buttons">'
    + '<button class="btn btn-primary btn-large" id="add-trade">Legg til beholdning</button>'
    + '<button class="btn btn-large btn-secondary" id="import-csv">Importer fra megler</button>'
    + '</div>'
    + '</div>';
}

export function renderOnboardingHint(state: AppState): string {
  if (localStorage.getItem('tally_hint_shown')) return '';
  if (state.ledger.events.length === 0) return '';
  return '<div class="onboard-hint" id="onboard-hint">'
    + '<span>Trykk på en beholdning for å se graf og detaljer</span>'
    + '<button class="onboard-hint-dismiss" id="dismiss-hint">OK</button>'
    + '</div>';
}
