import './style.css';
import { LedgerStorage } from './ledger';
import { parseCSV, validateCSV } from './import';
import { deriveHoldings, derivePortfolioMetrics, formatXIRRPercent, formatCurrency, formatPercent, formatDateShort } from './calculations';
import type { LedgerState, Holding, PortfolioMetrics } from './types';
import type { CSVParseResult } from './import';

class TallyApp {
  private ledger: LedgerState;
  private holdings: Holding[] = [];
  private metrics: PortfolioMetrics | null = null;
  private currentPrices: Map<string, number> = new Map();
  private pendingImport: CSVParseResult | null = null;

  constructor() {
    this.ledger = LedgerStorage.initializeLedger();
    this.updateDerivedData();
    this.render();
    this.attachEventListeners();
  }

  private updateDerivedData(): void {
    this.holdings = deriveHoldings(this.ledger.events, this.ledger.instruments, this.currentPrices);
    this.metrics = derivePortfolioMetrics(this.ledger.events, this.holdings);
  }

  private render(): void {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = '<header><div class="container"><h1>Tally</h1></div></header><main class="container">' 
      + this.renderSummary() + this.renderWarnings() + this.renderHoldings() + this.renderActions() 
      + '</main>' + this.renderImportModal();
  }

  private renderSummary(): string {
    if (!this.metrics || this.ledger.events.length === 0) {
      return '<div class="card"><div class="empty-state"><h3>Ingen transaksjoner ennå</h3><p>Importer transaksjonshistorikk fra megleren din for å komme i gang.</p></div></div>';
    }

    const xirrClass = (this.metrics.xirrPercent || 0) >= 0 ? 'text-success' : 'text-danger';
    const unrealizedGain = this.holdings.reduce((sum, h) => sum + h.unrealizedGain, 0);
    const unrealizedClass = unrealizedGain >= 0 ? 'text-success' : 'text-danger';

    return '<div class="card"><div class="card-header"><h2>Porteføljeoversikt</h2></div><div class="summary-grid">'
      + '<div class="summary-item"><div class="label">XIRR (Årlig avkastning)</div><div class="value ' + xirrClass + '">' + formatXIRRPercent(this.metrics.xirr) + '</div></div>'
      + '<div class="summary-item"><div class="label">Nåverdi</div><div class="value">' + formatCurrency(this.metrics.currentValue) + '</div></div>'
      + '<div class="summary-item"><div class="label">Urealisert gevinst</div><div class="value ' + unrealizedClass + '">' + formatCurrency(unrealizedGain) + '</div></div>'
      + '<div class="summary-item"><div class="label">Mottatt utbytte</div><div class="value">' + formatCurrency(this.metrics.totalDividends) + '</div></div>'
      + '</div></div>';
  }

  private renderWarnings(): string {
    const warnings = this.ledger.warnings.filter(w => w.severity !== 'INFO');
    if (warnings.length === 0) return '';
    return '<div class="card" style="background-color:#fff3cd;border:1px solid #ffc107"><h3 style="color:#856404">Datakvalitetsadvarsler</h3><ul>' 
      + warnings.map(w => '<li>' + w.message + '</li>').join('') + '</ul></div>';
  }

  private renderHoldings(): string {
    if (this.holdings.length === 0) return '';
    return '<div class="card"><div class="card-header"><h2>Beholdning</h2></div><table class="portfolio-table"><thead><tr><th>Ticker</th><th>Navn</th><th class="text-right">Antall</th><th class="text-right">Snittpris</th><th class="text-right">Kurs</th><th class="text-right">Verdi</th><th class="text-right">Gevinst</th></tr></thead><tbody>'
      + this.holdings.map(h => {
        const gainClass = h.unrealizedGain >= 0 ? 'text-success' : 'text-danger';
        return '<tr><td><strong>' + h.ticker + '</strong></td><td>' + h.name + '</td><td class="text-right">' + h.quantity + '</td><td class="text-right">' + formatCurrency(h.averageCostPerShare, 2) + '</td><td class="text-right">' + formatCurrency(h.currentPrice, 2) + '</td><td class="text-right">' + formatCurrency(h.marketValue) + '</td><td class="text-right ' + gainClass + '">' + formatCurrency(h.unrealizedGain) + ' (' + formatPercent(h.unrealizedGainPercent) + ')</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  private renderActions(): string {
    return '<div class="card"><div class="card-header"><h2>Handlinger</h2></div><div style="display:flex;gap:10px;flex-wrap:wrap">'
      + '<button class="btn btn-primary" id="import-csv">Importer CSV</button>'
      + '<button class="btn btn-success" id="export-json">Eksporter data</button>'
      + (this.ledger.events.length > 0 ? '<button class="btn btn-danger" id="clear-data">Slett alle data</button>' : '')
      + '</div><div style="margin-top:20px;font-size:12px;color:var(--text-muted)">'
      + '<p><strong>Antall transaksjoner:</strong> ' + this.ledger.events.length + '</p>'
      + '<p><strong>Sist oppdatert:</strong> ' + (this.ledger.lastModified ? formatDateShort(this.ledger.lastModified) : 'N/A') + '</p>'
      + '</div></div>';
  }

  private renderImportModal(): string {
    return '<div class="modal" id="import-modal"><div class="modal-content" style="max-width:600px"><div class="modal-header"><h3>Importer transaksjoner</h3></div>'
      + '<div class="form-group"><label for="csv-file">Velg CSV-fil fra megler</label><input type="file" id="csv-file" class="form-control" accept=".csv,.txt"></div>'
      + '<div id="import-preview" style="display:none"><h4>Forhåndsvisning</h4><div id="import-stats"></div><div id="import-warnings"></div></div>'
      + '<div class="modal-footer"><button class="btn" id="cancel-import">Avbryt</button><button class="btn btn-success" id="confirm-import" disabled>Importer</button></div></div></div>';
  }

  private attachEventListeners(): void {
    document.getElementById('import-csv')?.addEventListener('click', () => this.showModal());
    document.getElementById('cancel-import')?.addEventListener('click', () => this.hideModal());
    document.getElementById('confirm-import')?.addEventListener('click', () => this.confirmImport());
    document.getElementById('export-json')?.addEventListener('click', () => this.exportData());
    document.getElementById('clear-data')?.addEventListener('click', () => this.clearAllData());
    document.getElementById('csv-file')?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) this.handleFileSelect(file);
    });
  }

  private showModal(): void { document.getElementById('import-modal')?.classList.add('active'); }
  private hideModal(): void {
    document.getElementById('import-modal')?.classList.remove('active');
    (document.getElementById('csv-file') as HTMLInputElement).value = '';
    (document.getElementById('import-preview') as HTMLElement).style.display = 'none';
    (document.getElementById('confirm-import') as HTMLButtonElement).disabled = true;
  }

  private async handleFileSelect(file: File): Promise<void> {
    const content = await file.text();
    const errors = validateCSV(content);
    if (errors.length > 0) { alert('Feil: ' + errors.join('\n')); return; }

    const result = parseCSV(content, this.ledger.accounts[0]?.id || 'default');
    this.pendingImport = result;

    const preview = document.getElementById('import-preview') as HTMLElement;
    const stats = document.getElementById('import-stats') as HTMLElement;
    const confirmBtn = document.getElementById('confirm-import') as HTMLButtonElement;

    preview.style.display = 'block';
    stats.innerHTML = '<p>Parsed: ' + result.stats.parsedRows + ' rader | Handler: ' + result.stats.tradeEvents + ' | Utbytter: ' + result.stats.dividendEvents + ' | Innskudd/uttak: ' + result.stats.cashEvents + '</p>';
    confirmBtn.disabled = result.events.length === 0;
  }

  private confirmImport(): void {
    if (!this.pendingImport) return;
    LedgerStorage.addEvents(this.pendingImport.events);
    for (const inst of this.pendingImport.instruments) LedgerStorage.upsertInstrument(inst);
    for (const warn of this.pendingImport.warnings) LedgerStorage.addWarning(warn);
    this.ledger = LedgerStorage.loadLedger() || this.ledger;
    this.updateDerivedData();
    this.hideModal();
    this.render();
    this.attachEventListeners();
  }

  private exportData(): void {
    const json = LedgerStorage.exportAsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tally-backup-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
  }

  private clearAllData(): void {
    if (confirm('Er du sikker på at du vil slette alle data?')) {
      LedgerStorage.clearLedger();
      this.ledger = LedgerStorage.initializeLedger();
      this.holdings = [];
      this.metrics = null;
      this.render();
      this.attachEventListeners();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new TallyApp());
