import './style.css';
import { LedgerStorage } from './ledger';
import { parseCSV, validateCSV } from './import';
import { deriveHoldings, derivePortfolioMetrics, formatXIRRPercent, formatCurrency, formatPercent, formatDateShort } from './calculations';
import { fetchPricesForHoldings, fetchStockIndex, fetchPriceForDate } from './api';
import type { LedgerState, Holding, PortfolioMetrics } from './types';
import type { CSVParseResult } from './import';

interface StockSuggestion {
  ticker: string;
  name: string;
  currentPrice: number | null;
}

class TallyApp {
  private ledger: LedgerState;
  private holdings: Holding[] = [];
  private metrics: PortfolioMetrics | null = null;
  private currentPrices: Map<string, number> = new Map();
  private pendingImport: CSVParseResult | null = null;
  private isFetchingPrices = false;
  private stockList: StockSuggestion[] = [];
  private selectedSuggestionIndex = -1;

  constructor() {
    this.ledger = LedgerStorage.initializeLedger();
    this.currentPrices = LedgerStorage.loadPrices();
    this.checkShareUrl();
    this.updateDerivedData();
    this.render();
    this.attachEventListeners();
    this.refreshPrices();
    this.loadStockIndex();
  }

  private async loadStockIndex(): Promise<void> {
    const index = await fetchStockIndex();
    if (!index) return;
    this.stockList = Object.entries(index.symbols).map(([ticker, info]) => ({
      ticker,
      name: info.name,
      currentPrice: info.currentPrice,
    }));
  }

  private checkShareUrl(): void {
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
      this.ledger = LedgerStorage.loadLedger() || this.ledger;

      // Clean URL
      window.history.replaceState(null, '', window.location.pathname);
    } catch {
      // Invalid share data — ignore silently
      window.history.replaceState(null, '', window.location.pathname);
    }
  }

  private async shareData(): Promise<void> {
    const payload = {
      events: this.ledger.events,
      instruments: this.ledger.instruments,
    };
    const json = JSON.stringify(payload);
    const encoded = btoa(encodeURIComponent(json));
    const url = window.location.origin + window.location.pathname + '#share=' + encoded;

    // Use native share on mobile, clipboard on desktop
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tally portefølje', url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      alert('Lenke kopiert! Åpne den på en annen enhet for å importere porteføljen.');
    } catch {
      // Clipboard failed — show URL in prompt as fallback
      prompt('Kopier denne lenken:', url);
    }
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
      + this.renderTradeModal()
      + this.renderImportModal();
  }

  private renderHeader(): string {
    const hasData = this.ledger.events.length > 0;
    const actions = hasData
      ? '<div class="header-actions">'
        + '<button class="btn btn-header" id="add-trade">+ Legg til</button>'
        + '<button class="btn btn-header" id="share-data">Del</button>'
        + '<button class="btn btn-header" id="import-csv">Importer</button>'
        + '</div>'
      : '';
    return '<header><div class="container header-inner"><div><h1>Tally</h1><p class="header-subtitle">Din porteføljeoversikt</p></div>' + actions + '</div></header>';
  }

  private renderEmptyState(): string {
    return '<div class="card empty-state">'
      + '<div class="empty-icon">&#x1F4CA;</div>'
      + '<h2>Velkommen til Tally</h2>'
      + '<p>Beregn din reelle investeringsavkastning basert på transaksjonshistorikk.</p>'
      + '<div class="empty-steps">'
      + '<div class="step"><span class="step-number">1</span><span>Legg til aksjer manuelt eller importer CSV fra megleren</span></div>'
      + '<div class="step"><span class="step-number">2</span><span>Kurser hentes automatisk fra Yahoo Finance</span></div>'
      + '<div class="step"><span class="step-number">3</span><span>Se din faktiske avkastning (XIRR) med utbytte inkludert</span></div>'
      + '</div>'
      + '<div class="empty-buttons">'
      + '<button class="btn btn-primary btn-large" id="add-trade">Legg til aksje</button>'
      + '<button class="btn btn-large" id="import-csv" style="background:var(--background-color);color:var(--text-color)">Importer CSV</button>'
      + '</div>'
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
      + '<div class="footer-buttons">'
      + '<button class="btn btn-small" id="export-json" style="background:var(--background-color);color:var(--text-muted)">Eksporter JSON</button>'
      + '<button class="btn btn-small btn-danger-outline" id="clear-data">Slett data</button>'
      + '</div>'
      + '</div>';
  }

  private renderTradeModal(): string {
    const today = new Date().toISOString().split('T')[0];
    return '<div class="modal" id="trade-modal"><div class="modal-content"><div class="modal-header"><h3>Legg til transaksjon</h3></div>'
      + '<div class="trade-type-tabs">'
      + '<button class="trade-tab active" data-type="TRADE_BUY">Kjøp</button>'
      + '<button class="trade-tab" data-type="TRADE_SELL">Salg</button>'
      + '<button class="trade-tab" data-type="DIVIDEND">Utbytte</button>'
      + '</div>'
      + '<input type="hidden" id="trade-type" value="TRADE_BUY">'
      + '<div class="form-group"><label for="trade-ticker">Aksje</label><div class="search-wrapper"><input type="text" id="trade-ticker" class="form-control" placeholder="Søk etter aksje..." autocapitalize="characters" autocorrect="off" spellcheck="false" autocomplete="off"><div class="search-suggestions" id="search-suggestions"></div></div></div>'
      + '<div class="form-group"><label for="trade-name">Selskapsnavn</label><input type="text" id="trade-name" class="form-control" placeholder="Fylles inn automatisk" readonly></div>'
      + '<input type="hidden" id="trade-isin" value="">'
      + '<div class="form-group"><label for="trade-date">Dato</label><input type="date" id="trade-date" class="form-control" value="' + today + '"></div>'
      + '<div class="form-row"><div class="form-group"><label for="trade-qty">Antall aksjer</label><input type="number" id="trade-qty" class="form-control" placeholder="100" step="1" min="1" inputmode="numeric"></div>'
      + '<div class="form-group"><label for="trade-price" id="trade-price-label">Kurs per aksje</label><input type="number" id="trade-price" class="form-control" placeholder="280,50" step="0.01" min="0" inputmode="decimal"><span class="price-date-hint" id="price-date-hint"></span></div></div>'
      + '<div class="form-group"><label for="trade-fee">Kurtasje (valgfritt)</label><input type="number" id="trade-fee" class="form-control" placeholder="29" step="0.01" min="0" inputmode="decimal"></div>'
      + '<div id="trade-total" class="trade-total"></div>'
      + '<div class="modal-footer"><button class="btn" id="cancel-trade">Avbryt</button><button class="btn btn-success" id="submit-trade">Legg til</button></div></div></div>';
  }

  private submitTrade(): void {
    const type = (document.getElementById('trade-type') as HTMLSelectElement).value;
    const ticker = (document.getElementById('trade-ticker') as HTMLInputElement).value.trim().toUpperCase();
    const name = (document.getElementById('trade-name') as HTMLInputElement).value.trim();
    const isinInput = (document.getElementById('trade-isin') as HTMLInputElement).value.trim();
    const date = (document.getElementById('trade-date') as HTMLInputElement).value;
    const qty = parseFloat((document.getElementById('trade-qty') as HTMLInputElement).value);
    const price = parseFloat((document.getElementById('trade-price') as HTMLInputElement).value);
    const fee = parseFloat((document.getElementById('trade-fee') as HTMLInputElement).value) || 0;

    if (!ticker || !date || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
      alert('Fyll inn ticker, dato, antall og kurs.');
      return;
    }

    const isin = isinInput || ('MANUAL_' + ticker);
    const amount = qty * price;
    const accountId = this.ledger.accounts[0]?.id || 'default';
    const now = new Date().toISOString();

    // Upsert instrument
    LedgerStorage.upsertInstrument({ isin, ticker, name: name || ticker, currency: 'NOK' });

    if (type === 'DIVIDEND') {
      const event = {
        id: 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8),
        accountId, date, type: 'DIVIDEND' as const, amount, currency: 'NOK' as const,
        createdAt: now, source: 'MANUAL' as const,
        isin, quantity: qty, perShare: price,
      };
      LedgerStorage.addEvents([event]);
    } else {
      const event = {
        id: 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8),
        accountId, date, type: type as 'TRADE_BUY' | 'TRADE_SELL', amount, currency: 'NOK' as const,
        createdAt: now, source: 'MANUAL' as const,
        isin, quantity: qty, pricePerShare: price, fee: fee > 0 ? fee : undefined,
      };
      LedgerStorage.addEvents([event]);
    }

    this.ledger = LedgerStorage.loadLedger() || this.ledger;
    this.updateDerivedData();
    this.hideTradeModal();
    this.render();
    this.attachEventListeners();
    this.refreshPrices();
  }

  private selectStock(stock: StockSuggestion): void {
    const tickerInput = document.getElementById('trade-ticker') as HTMLInputElement;
    const nameInput = document.getElementById('trade-name') as HTMLInputElement;
    const suggestionsEl = document.getElementById('search-suggestions') as HTMLElement;

    tickerInput.value = stock.ticker;
    nameInput.value = stock.name;
    nameInput.readOnly = false;

    suggestionsEl.innerHTML = '';
    suggestionsEl.classList.remove('active');

    // Fetch price for the selected date (historical or current)
    this.updatePriceForSelectedStock();

    // Focus quantity field so user can continue quickly
    document.getElementById('trade-qty')?.focus();
  }

  private async updatePriceForSelectedStock(): Promise<void> {
    const ticker = (document.getElementById('trade-ticker') as HTMLInputElement)?.value.trim().toUpperCase();
    const date = (document.getElementById('trade-date') as HTMLInputElement)?.value;
    const priceInput = document.getElementById('trade-price') as HTMLInputElement | null;
    const tradeType = (document.getElementById('trade-type') as HTMLInputElement)?.value;
    if (!ticker || !date || !priceInput || tradeType === 'DIVIDEND') return;

    const today = new Date().toISOString().split('T')[0];
    const isToday = date === today;

    // For today's date, use the current price from stock list (already loaded)
    if (isToday) {
      const stock = this.stockList.find(s => s.ticker === ticker);
      if (stock?.currentPrice) {
        priceInput.value = stock.currentPrice.toFixed(2);
        priceInput.dispatchEvent(new Event('input'));
      }
      return;
    }

    // For historical dates, fetch from per-ticker data file
    const priceHint = document.getElementById('price-date-hint');
    if (priceHint) priceHint.textContent = 'Henter kurs...';

    const price = await fetchPriceForDate(ticker, date);
    if (price !== null) {
      priceInput.value = price.toFixed(2);
      priceInput.dispatchEvent(new Event('input'));
      if (priceHint) priceHint.textContent = 'Kurs fra ' + date;
    } else {
      if (priceHint) priceHint.textContent = 'Ingen historisk kurs funnet';
    }

    // Clear hint after a few seconds
    if (priceHint) {
      setTimeout(() => { priceHint.textContent = ''; }, 3000);
    }
  }

  private updateSuggestionHighlight(items: NodeListOf<Element>): void {
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === this.selectedSuggestionIndex);
      if (i === this.selectedSuggestionIndex) {
        (item as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    });
  }

  private showTradeModal(): void { document.getElementById('trade-modal')?.classList.add('active'); }
  private hideTradeModal(): void {
    document.getElementById('trade-modal')?.classList.remove('active');
    // Reset form
    const fields = ['trade-ticker', 'trade-name', 'trade-isin', 'trade-qty', 'trade-price', 'trade-fee'];
    for (const id of fields) {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = '';
    }
    const nameInput = document.getElementById('trade-name') as HTMLInputElement | null;
    if (nameInput) nameInput.readOnly = true;
    const suggestions = document.getElementById('search-suggestions') as HTMLElement | null;
    if (suggestions) { suggestions.innerHTML = ''; suggestions.classList.remove('active'); }
    this.selectedSuggestionIndex = -1;
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
    document.getElementById('share-data')?.addEventListener('click', () => this.shareData());
    document.getElementById('csv-file')?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) this.handleFileSelect(file);
    });
    document.getElementById('refresh-prices')?.addEventListener('click', () => this.refreshPrices());

    // Trade modal
    document.getElementById('add-trade')?.addEventListener('click', () => this.showTradeModal());
    document.getElementById('cancel-trade')?.addEventListener('click', () => this.hideTradeModal());
    document.getElementById('submit-trade')?.addEventListener('click', () => this.submitTrade());

    // Date change → fetch historical price
    document.getElementById('trade-date')?.addEventListener('change', () => {
      this.updatePriceForSelectedStock();
    });

    // Trade type tabs
    document.querySelectorAll('.trade-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.trade-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const type = (tab as HTMLElement).dataset.type || 'TRADE_BUY';
        (document.getElementById('trade-type') as HTMLInputElement).value = type;
        const priceLabel = document.getElementById('trade-price-label');
        if (priceLabel) {
          priceLabel.textContent = type === 'DIVIDEND' ? 'Utbytte per aksje' : 'Kurs per aksje';
        }
      });
    });

    // Live total calculation
    const qtyInput = document.getElementById('trade-qty') as HTMLInputElement | null;
    const priceInput = document.getElementById('trade-price') as HTMLInputElement | null;
    const feeInput = document.getElementById('trade-fee') as HTMLInputElement | null;
    const updateTotal = () => {
      const q = parseFloat(qtyInput?.value || '0');
      const p = parseFloat(priceInput?.value || '0');
      const f = parseFloat(feeInput?.value || '0');
      const total = document.getElementById('trade-total');
      if (total && q > 0 && p > 0) {
        total.textContent = 'Total: ' + formatCurrency(q * p + f);
      } else if (total) {
        total.textContent = '';
      }
    };
    qtyInput?.addEventListener('input', updateTotal);
    priceInput?.addEventListener('input', updateTotal);
    feeInput?.addEventListener('input', updateTotal);

    // Stock search autocomplete
    const tickerInput = document.getElementById('trade-ticker') as HTMLInputElement | null;
    const suggestionsEl = document.getElementById('search-suggestions') as HTMLElement | null;
    if (tickerInput && suggestionsEl) {
      tickerInput.addEventListener('input', () => {
        const query = tickerInput.value.trim().toUpperCase();
        this.selectedSuggestionIndex = -1;
        if (query.length === 0) {
          suggestionsEl.innerHTML = '';
          suggestionsEl.classList.remove('active');
          return;
        }
        const matches = this.stockList
          .filter(s => s.ticker.includes(query) || s.name.toUpperCase().includes(query))
          .sort((a, b) => {
            // Exact ticker start first, then name match
            const aStartsTicker = a.ticker.startsWith(query) ? 0 : 1;
            const bStartsTicker = b.ticker.startsWith(query) ? 0 : 1;
            if (aStartsTicker !== bStartsTicker) return aStartsTicker - bStartsTicker;
            return a.ticker.localeCompare(b.ticker);
          })
          .slice(0, 8);

        if (matches.length === 0) {
          suggestionsEl.innerHTML = '<div class="suggestion-empty">Ingen treff. Du kan skrive inn ticker manuelt.</div>';
          suggestionsEl.classList.add('active');
          return;
        }

        suggestionsEl.innerHTML = matches.map((s, i) =>
          '<button class="suggestion-item' + (i === this.selectedSuggestionIndex ? ' selected' : '') + '" data-index="' + i + '" type="button">'
          + '<span class="suggestion-ticker">' + s.ticker + '</span>'
          + '<span class="suggestion-name">' + s.name + '</span>'
          + (s.currentPrice ? '<span class="suggestion-price">' + s.currentPrice.toFixed(2) + '</span>' : '')
          + '</button>'
        ).join('');
        suggestionsEl.classList.add('active');

        suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
          item.addEventListener('click', () => {
            const idx = parseInt((item as HTMLElement).dataset.index || '0');
            this.selectStock(matches[idx]);
          });
        });
      });

      tickerInput.addEventListener('keydown', (e) => {
        const items = suggestionsEl.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.selectedSuggestionIndex = Math.min(this.selectedSuggestionIndex + 1, items.length - 1);
          this.updateSuggestionHighlight(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.selectedSuggestionIndex = Math.max(this.selectedSuggestionIndex - 1, 0);
          this.updateSuggestionHighlight(items);
        } else if (e.key === 'Enter' && this.selectedSuggestionIndex >= 0) {
          e.preventDefault();
          (items[this.selectedSuggestionIndex] as HTMLElement).click();
        }
      });

      // Close suggestions when clicking outside
      document.addEventListener('click', (e) => {
        if (!(e.target as HTMLElement).closest('.search-wrapper')) {
          suggestionsEl.innerHTML = '';
          suggestionsEl.classList.remove('active');
        }
      });
    }

    // Close modals on backdrop click
    document.getElementById('import-modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'import-modal') this.hideModal();
    });
    document.getElementById('trade-modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'trade-modal') this.hideTradeModal();
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
