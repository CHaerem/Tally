import type { AppState } from '../state';
import { LedgerStorage } from '../ledger';
import { parseCSV, validateCSV, parseVPSExport, isVPSFile } from '../import';

export function renderImportModal(): string {
  const today = new Date().toISOString().split('T')[0];
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];
  const vpsUrl = 'https://investor.vps.no/vip/#/transactions?size=200&page=0&settledDateFrom=' + yearAgo + '&settledDateTo=' + today + '&settled=false';

  return '<div class="modal" id="import-modal"><div class="modal-content"><div class="modal-header"><h3>Importer transaksjoner</h3></div>'
    + '<div class="import-vps"><a href="' + vpsUrl + '" target="_blank" rel="noopener" class="btn btn-outline btn-large import-vps-btn">Åpne VPS Investortjenester</a>'
    + '<p class="text-muted text-small">Logg inn med BankID → Trykk Export → Last opp filen under</p></div>'
    + '<div class="form-group"><label class="file-upload" id="file-upload-label"><input type="file" id="csv-file" accept=".csv,.txt,.xlsx,.xls"><span class="file-upload-text">Last opp VPS-eksport (.xlsx) eller CSV</span></label></div>'
    + '<div id="import-preview" style="display:none"><div id="import-stats" class="import-stats"></div><div id="import-warnings"></div></div>'
    + '<div class="modal-footer"><button class="btn" id="cancel-import">Avbryt</button><button class="btn btn-success" id="confirm-import" disabled>Importer</button></div></div></div>';
}

export function showImportModal(): void {
  document.getElementById('import-modal')?.classList.add('active');
}

export function hideImportModal(): void {
  document.getElementById('import-modal')?.classList.remove('active');
  const fileInput = document.getElementById('csv-file') as HTMLInputElement | null;
  const preview = document.getElementById('import-preview') as HTMLElement | null;
  const confirmBtn = document.getElementById('confirm-import') as HTMLButtonElement | null;
  if (fileInput) fileInput.value = '';
  if (preview) preview.style.display = 'none';
  if (confirmBtn) confirmBtn.disabled = true;
}

export async function handleFileSelect(state: AppState, file: File): Promise<void> {
  let result;
  if (isVPSFile(file)) {
    const buffer = await file.arrayBuffer();
    const tickerLookup = (name: string) => {
      const upper = name.toUpperCase();
      const match = state.stockList.find(s =>
        s.name.toUpperCase() === upper
        || s.name.toUpperCase().includes(upper)
        || upper.includes(s.name.toUpperCase())
        || upper.includes(s.ticker)
      );
      return match ? { ticker: match.ticker, type: match.type } : null;
    };
    result = parseVPSExport(buffer, state.ledger.accounts[0]?.id || 'default', tickerLookup);
    if (result.errors.length > 0 && result.events.length === 0) {
      alert('Feil i filen:\n\n' + result.errors.map(e => e.message).join('\n'));
      return;
    }
  } else {
    const content = await file.text();
    const errors = validateCSV(content);
    if (errors.length > 0) { alert('Feil i filen:\n\n' + errors.join('\n')); return; }
    result = parseCSV(content, state.ledger.accounts[0]?.id || 'default');
  }
  state.pendingImport = result;

  const preview = document.getElementById('import-preview') as HTMLElement;
  const stats = document.getElementById('import-stats') as HTMLElement;
  const warnings = document.getElementById('import-warnings') as HTMLElement;
  const confirmBtn = document.getElementById('confirm-import') as HTMLButtonElement;

  preview.style.display = 'block';
  stats.innerHTML = '<div class="stat-grid">'
    + '<div class="stat"><span class="stat-value">' + result.stats.parsedRows + '</span><span class="stat-label">rader</span></div>'
    + '<div class="stat"><span class="stat-value">' + result.stats.tradeEvents + '</span><span class="stat-label">handler</span></div>'
    + '<div class="stat"><span class="stat-value">' + result.stats.dividendEvents + '</span><span class="stat-label">utbytter</span></div>'
    + '<div class="stat"><span class="stat-value">' + result.stats.cashEvents + '</span><span class="stat-label">inn/utbetalinger</span></div>'
    + '</div>';

  if (result.warnings.length > 0) {
    warnings.innerHTML = '<div class="import-warnings">' + result.warnings.map(w => '<p>' + w.message + '</p>').join('') + '</div>';
  }

  confirmBtn.disabled = result.events.length === 0;
}

export function confirmImport(state: AppState, callbacks: {
  onRerender: () => void;
  onRefreshPrices: () => void;
}): void {
  if (!state.pendingImport) return;
  LedgerStorage.addEvents(state.pendingImport.events);
  for (const inst of state.pendingImport.instruments) LedgerStorage.upsertInstrument(inst);
  for (const warn of state.pendingImport.warnings) LedgerStorage.addWarning(warn);
  state.ledger = LedgerStorage.loadLedger() || state.ledger;
  hideImportModal();
  callbacks.onRerender();
  callbacks.onRefreshPrices();
}
