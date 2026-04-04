import './style.css';
import { LedgerStorage } from './ledger';
import { parseCSV, validateCSV } from './import';
import { deriveHoldings, derivePortfolioMetrics, formatXIRRPercent, formatCurrency, formatPercent, formatDateShort } from './calculations';
import { fetchPricesForHoldings } from './api';
import type { LedgerState, Holding, PortfolioMetrics } from './types';
import type { CSVParseResult } from './import';

class TallyApp {
  private ledger: LedgerState;
  private holdings: Holding[] = [];
  private metrics: PortfolioMetrics | null = null;
  private currentPrices: Map<string, number> = new Map();
  private pendingImport: CSVParseResult | null = null;
  private isFetchingPrices = false;

  constructor() {
    this.ledger = LedgerStorage.initializeLedger();
    this.currentPrices = LedgerStorage.loadPrices();
    this.updateDerivedData();
    this.render();
    this.attachEventListeners();
    this.refreshPrices();
  }

  private async refreshPrices(): Promise<void> {
    if (this.isFetchingPrices) return;
    const tickers = this.ledger.instruments.map(i => ({ isin: i.isin, ticker: i.ticker }));
    if (tickers.length === 0) return;

    this.isFetchingPrices = true;
    this.render();
    this.attachEventListeners();

    const fetched = await fetchPricesForHoldings(tickers);
    for (const [isin, price] of fetched) {
      this.currentPrices.set(isin, price);
    }
    if (fetched.size > 0) {
      LedgerStorage.savePrices(this.currentPrices);
    }

    this.isFetchingPrices = false;
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

    const hasData = this.ledger.events.length > 0;

    app.innerHTML = this.renderHeader()
      + '<main class="container">'
      + (hasData ? this.renderSummary() + this.renderWarnings() + this.renderHoldings() + this.renderFooter() : this.renderEmptyState())
      + '</main>'
      + this.renderImportModal();
  }

  private renderHeader(): string {
    const hasData = this.ledger.events.length > 0;
    const actions = hasData
      ? '<div class="header-actions">'
        + '<button class="btn btn-header" id="import-csv">Importer</button>'
        + '<button class="btn btn-header" id="export-json">Eksporter</button>'
        + '</div>'
      : '';
    return '<header><div class="container header-inner"><div><h1>Tally</h1><p class="header-subtitle">Din porteføljeoversikt</p></div>' + actions + '</div></header>';
  }

  private renderEmptyState(): string {
    return '<div class="card empty-state">'
      + '<div class="empty-icon">&#x1F4CA;</div>'
      + '<h2>Velkommen til Tally</h2>'
      + '<p>Beregn din reelle investeringsavkastning basert på transaksjonshistorikk fra megleren din.</p>'
      + '<div class="empty-steps">'
      + '<div class="step"><span class="step-number">1</span><span>Eksporter transaksjonshistorikk som CSV fra nettbanken</span></div>'
      + '<div class="step"><span class="step-number">2</span><span>Importer filen her</span></div>'
      + '<div class="step"><span class="step-number">3</span><span>Se din faktiske avkastning (XIRR) med utbytte inkludert</span></div>'
      + '</div>'
      + '<button class="btn btn-primary btn-large" id="import-csv">Importer transaksjoner</button>'
      + '<p class="empty-hint">Støtter CSV fra Nordnet, DNB, Sbanken og andre norske meglere</p>'
      + '</div>';
  }

  private renderSummary(): string {
    if (!this.metrics) return '';

    const m = this.metrics;
    const xirrClass = (m.xirrPercent || 0) >= 0 ? 'text-success' : 'text-danger';
    const unrealizedGain = this.holdings.reduce((sum, h) => sum + h.unrealizedGain, 0);
    const unrealizedClass = unrealizedGain >= 0 ? 'text-success' : 'text-danger';
    const totalReturn = unrealizedGain + m.totalDividends;
    const totalReturnClass = totalReturn >= 0 ? 'text-success' : 'text-danger';

    return '<div class="card">'
      + '<div class="summary-grid">'
      + '<div class="summary-item summary-highlight"><div class="label">Årlig avkastning (XIRR)</div><div class="value ' + xirrClass + '">' + formatXIRRPercent(m.xirr) + '</div></div>'
      + '<div class="summary-item"><div class="label">Markedsverdi</div><div class="value">' + formatCurrency(m.currentValue) + '</div></div>'
      + '<div class="summary-item"><div class="label">Total avkastning</div><div class="value ' + totalReturnClass + '">' + formatCurrency(totalReturn) + '</div></div>'
      + '<div class="summary-item"><div class="label">Investert (netto)</div><div class="value">' + formatCurrency(m.netCashFlow) + '</div></div>'
      + '<div class="summary-item"><div class="label">Urealisert gevinst</div><div class="value ' + unrealizedClass + '">' + formatCurrency(unrealizedGain) + '</div></div>'
      + '<div class="summary-item"><div class="label">Mottatt utbytte</div><div class="value">' + formatCurrency(m.totalDividends) + '</div></div>'
      + '</div></div>';
  }

  private renderWarnings(): string {
    const warnings = this.ledger.warnings.filter(w => w.severity !== 'INFO');
    if (warnings.length === 0) return '';
    return '<div class="card warning-card"><h3>Datakvalitetsadvarsler</h3><ul>'
      + warnings.map(w => '<li>' + w.message + '</li>').join('') + '</ul></div>';
  }

  private renderHoldings(): string {
    if (this.holdings.length === 0) return '';
    const refreshLabel = this.isFetchingPrices
      ? '<span class="loading"></span> Henter kurser...'
      : 'Oppdater kurser';
    const refreshBtn = '<button class="btn btn-small btn-primary" id="refresh-prices"'
      + (this.isFetchingPrices ? ' disabled' : '') + '>' + refreshLabel + '</button>';
    const missingPrices = this.holdings.some(h => h.currentPrice === 0);
    const priceHint = missingPrices
      ? '<p class="price-hint">Kurser som ikke ble hentet automatisk kan fylles inn manuelt i kurs-kolonnen.</p>'
      : '';

    return '<div class="card"><div class="card-header"><h2>Beholdning</h2>' + refreshBtn + '</div>'
      + '<div class="table-responsive"><table class="portfolio-table"><thead><tr>'
      + '<th>Aksje</th>'
      + '<th class="text-right">Antall</th>'
      + '<th class="text-right">Snittpris</th>'
      + '<th class="text-right">Kurs</th>'
      + '<th class="text-right">Verdi</th>'
      + '<th class="text-right">Gevinst</th>'
      + '<th class="text-right">Utbytte</th>'
      + '</tr></thead><tbody>'
      + this.holdings.map(h => {
        const gainClass = h.unrealizedGain >= 0 ? 'text-success' : 'text-danger';
        const priceValue = h.currentPrice > 0 ? h.currentPrice.toFixed(2) : '';
        const priceInput = '<input type="number" class="price-input" data-isin="' + h.isin
          + '" value="' + priceValue + '" placeholder="—" step="0.01" min="0">';
        return '<tr>'
          + '<td><strong>' + h.ticker + '</strong><br><span class="text-muted text-small">' + h.name + '</span></td>'
          + '<td class="text-right">' + h.quantity + '</td>'
          + '<td class="text-right">' + formatCurrency(h.averageCostPerShare, 2) + '</td>'
          + '<td class="text-right">' + priceInput + '</td>'
          + '<td class="text-right">' + formatCurrency(h.marketValue) + '</td>'
          + '<td class="text-right ' + gainClass + '">' + formatCurrency(h.unrealizedGain) + '<br><span class="text-small">' + formatPercent(h.unrealizedGainPercent) + '</span></td>'
          + '<td class="text-right">' + formatCurrency(h.totalDividendsReceived) + '</td>'
          + '</tr>';
      }).join('')
      + '</tbody></table></div>' + priceHint + '</div>';
  }

  private renderFooter(): string {
    return '<div class="footer-actions">'
      + '<span class="text-muted text-small">'
      + this.ledger.events.length + ' transaksjoner'
      + (this.ledger.lastModified ? ' &middot; Sist oppdatert ' + formatDateShort(this.ledger.lastModified) : '')
      + '</span>'
      + '<button class="btn btn-small btn-danger-outline" id="clear-data">Slett alle data</button>'
      + '</div>';
  }

  private renderImportModal(): string {
    return '<div class="modal" id="import-modal"><div class="modal-content"><div class="modal-header"><h3>Importer transaksjoner</h3><p class="text-muted">Last opp CSV-fil fra megleren din (Nordnet, DNB, Sbanken m.fl.)</p></div>'
      + '<div class="form-group"><label class="file-upload" id="file-upload-label"><input type="file" id="csv-file" accept=".csv,.txt"><span class="file-upload-text">Velg fil eller dra den hit</span></label></div>'
      + '<div id="import-preview" style="display:none"><div id="import-stats" class="import-stats"></div><div id="import-warnings"></div></div>'
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
    document.getElementById('refresh-prices')?.addEventListener('click', () => this.refreshPrices());

    // Close modal on backdrop click
    document.getElementById('import-modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'import-modal') this.hideModal();
    });

    document.querySelectorAll('.price-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const el = e.target as HTMLInputElement;
        const isin = el.dataset.isin;
        const price = parseFloat(el.value);
        if (isin && !isNaN(price) && price >= 0) {
          this.currentPrices.set(isin, price);
        } else if (isin && el.value === '') {
          this.currentPrices.delete(isin);
        }
        LedgerStorage.savePrices(this.currentPrices);
        this.updateDerivedData();
        this.render();
        this.attachEventListeners();
      });
    });
  }

  private showModal(): void { document.getElementById('import-modal')?.classList.add('active'); }
  private hideModal(): void {
    document.getElementById('import-modal')?.classList.remove('active');
    const fileInput = document.getElementById('csv-file') as HTMLInputElement | null;
    const preview = document.getElementById('import-preview') as HTMLElement | null;
    const confirmBtn = document.getElementById('confirm-import') as HTMLButtonElement | null;
    if (fileInput) fileInput.value = '';
    if (preview) preview.style.display = 'none';
    if (confirmBtn) confirmBtn.disabled = true;
  }

  private async handleFileSelect(file: File): Promise<void> {
    const content = await file.text();
    const errors = validateCSV(content);
    if (errors.length > 0) { alert('Feil i filen:\n\n' + errors.join('\n')); return; }

    const result = parseCSV(content, this.ledger.accounts[0]?.id || 'default');
    this.pendingImport = result;

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
    this.refreshPrices();
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
    if (confirm('Er du sikker på at du vil slette alle data? Dette kan ikke angres.')) {
      LedgerStorage.clearLedger();
      this.currentPrices.clear();
      LedgerStorage.savePrices(this.currentPrices);
      this.ledger = LedgerStorage.initializeLedger();
      this.holdings = [];
      this.metrics = null;
      this.render();
      this.attachEventListeners();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new TallyApp());
