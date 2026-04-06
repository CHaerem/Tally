import './style.css';
import { LedgerStorage } from './ledger';
import { fetchStockIndex, fetchPriceHistory } from './api';
import type { AppState } from './state';
import { createInitialState, updateDerivedData, saveWatchlist } from './state';
import { NORWEGIAN_FUNDS } from './data/funds';
import type { StockSuggestion } from './data/funds';

// Views
import { renderHeader, renderEmptyState, renderOnboardingHint } from './views/header';
import { renderSummary } from './views/summary';
import { renderHoldings, renderWarnings } from './views/holdings';
import { renderFooter } from './views/footer';
import { renderTransactionLog } from './views/transaction-log';
import { renderGainsView } from './views/gains';

// Modals
import { renderTradeModal, attachTradeModalListeners, showTradeModal, hideTradeModal, autoRegisterDividends } from './modals/trade';
import { renderImportModal, showImportModal, hideImportModal, handleFileSelect, confirmImport } from './modals/import';

// Charts
import { renderHoldingChart } from './charts/holding-chart';
import { loadStockDetailChart } from './charts/holding-chart';

// Data
import { refreshPrices, fetchOBXPrice, loadDailyChanges, loadMarketStats } from './data/prices';
import { computePortfolioHistory, reattachChartIfNeeded } from './data/portfolio-history';
import { syncDividends } from './data/dividends';

// Utils
import { checkShareUrl, shareData, exportData, clearAllData } from './utils/share';

import type { ReturnPeriod } from './calculations';

export class TallyApp {
  private state: AppState;

  constructor() {
    this.state = createInitialState();
    checkShareUrl(this.state);
    updateDerivedData(this.state);
    this.render();
    this.attachEventListeners();
    this.doRefreshPrices();
    this.loadStockIndex();
    this.doComputePortfolioHistory();

    this.setupPullToRefresh();
    loadDailyChanges(this.state);

    // Offline indicator
    window.addEventListener('online', () => {
      document.getElementById('offline-banner')?.remove();
      this.doRefreshPrices();
    });
    window.addEventListener('offline', () => {
      const header = document.querySelector('header');
      if (header && !document.getElementById('offline-banner')) {
        header.insertAdjacentHTML('afterend', '<div id="offline-banner" class="offline-banner">Frakoblet — viser siste data</div>');
      }
    });
    fetchOBXPrice(this.state);
  }

  private setupPullToRefresh(): void {
    let startY = 0;
    let pulling = false;
    document.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) { startY = e.touches[0].clientY; pulling = true; }
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 80 && window.scrollY === 0) {
        pulling = false;
        this.doRefreshPrices();
      }
    }, { passive: true });
    document.addEventListener('touchend', () => { pulling = false; });
  }

  private async loadStockIndex(): Promise<void> {
    const index = await fetchStockIndex();
    const stocks: StockSuggestion[] = index
      ? Object.entries(index.symbols).map(([ticker, info]) => ({
          ticker,
          name: info.name,
          currentPrice: info.currentPrice,
          type: 'STOCK' as const,
        }))
      : [];
    this.state.stockList = [...stocks, ...NORWEGIAN_FUNDS];
    if (this.state.stockList.length > NORWEGIAN_FUNDS.length) {
      this.render();
      this.attachEventListeners();
      this.doComputePortfolioHistory();
    }
  }

  private addToWatchlist(stock: StockSuggestion): void {
    if (this.state.watchlist.some(w => w.ticker === stock.ticker)) return;
    this.state.watchlist.push({ ticker: stock.ticker, name: stock.name, type: stock.type });
    saveWatchlist(this.state.watchlist);
    this.render();
    this.attachEventListeners();
  }

  private removeFromWatchlist(ticker: string): void {
    this.state.watchlist = this.state.watchlist.filter(w => w.ticker !== ticker);
    saveWatchlist(this.state.watchlist);
    this.render();
    this.attachEventListeners();
  }

  // Convenience wrappers for async operations that need callbacks
  private doRefreshPrices(): void {
    refreshPrices(this.state, {
      onRerender: () => { this.render(); this.attachEventListeners(); },
      onComputePortfolioHistory: () => this.doComputePortfolioHistory(),
      onSyncDividends: () => this.doSyncDividends(),
    });
  }

  private doComputePortfolioHistory(): void {
    computePortfolioHistory(this.state);
  }

  private doSyncDividends(): void {
    syncDividends(this.state, {
      onRerender: () => { this.render(); this.attachEventListeners(); },
      onReattachChart: () => reattachChartIfNeeded(this.state),
    });
  }

  private doShowTradeModal(mode: 'simple' | 'full' = 'simple', prefill?: { ticker: string; name: string; isin: string; instrumentType: 'STOCK' | 'FUND' }): void {
    showTradeModal(this.state, mode, prefill, () => this.attachTradeModalListenersHelper());
  }

  private doHideTradeModal(): void {
    hideTradeModal(this.state);
  }

  private attachTradeModalListenersHelper(): void {
    attachTradeModalListeners(this.state, {
      onRerender: () => { updateDerivedData(this.state); this.render(); this.attachEventListeners(); },
      onRefreshPrices: () => this.doRefreshPrices(),
      onShowTradeModal: (mode, prefill) => this.doShowTradeModal(mode, prefill),
      onHideTradeModal: () => this.doHideTradeModal(),
      onAutoRegisterDividends: (ticker, isin, date) => {
        autoRegisterDividends(this.state, ticker, isin, date, {
          onRerender: () => { updateDerivedData(this.state); this.render(); this.attachEventListeners(); },
          onComputePortfolioHistory: () => this.doComputePortfolioHistory(),
        });
      },
    });
  }

  private rerender(): void {
    updateDerivedData(this.state);
    this.render();
    this.attachEventListeners();
  }

  private render(): void {
    const app = document.getElementById('app');
    if (!app) return;

    const hasData = this.state.ledger.events.length > 0;

    app.innerHTML = renderHeader(this.state)
      + '<main class="container">'
      + (hasData
        ? renderSummary(this.state)
          + renderWarnings(this.state)
          + '<section class="section-group">' + renderHoldings(this.state) + '</section>'
          + renderOnboardingHint(this.state)
          + renderFooter(this.state)
        : renderEmptyState())
      + '</main>'
      + renderTradeModal(this.state)
      + renderImportModal()
      + renderTransactionLog(this.state)
      + renderGainsView(this.state);

    // Prevent body scroll when modal is open
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('touchmove', (e) => {
        if ((e.target as HTMLElement).closest('.modal-content')) return;
        e.preventDefault();
      }, { passive: false });
    });
  }

  private attachEventListeners(): void {
    document.getElementById('import-csv')?.addEventListener('click', () => showImportModal());
    document.getElementById('cancel-import')?.addEventListener('click', () => hideImportModal());
    document.getElementById('confirm-import')?.addEventListener('click', () => confirmImport(this.state, {
      onRerender: () => this.rerender(),
      onRefreshPrices: () => this.doRefreshPrices(),
    }));
    document.getElementById('dismiss-hint')?.addEventListener('click', () => {
      localStorage.setItem('tally_hint_shown', '1');
      document.getElementById('onboard-hint')?.remove();
    });
    // Gains view modal
    document.getElementById('show-gains')?.addEventListener('click', () => {
      document.getElementById('gains-modal')?.classList.add('active');
    });
    document.getElementById('gains-close')?.addEventListener('click', () => {
      document.getElementById('gains-modal')?.classList.remove('active');
    });
    document.getElementById('gains-modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'gains-modal') document.getElementById('gains-modal')?.classList.remove('active');
    });

    document.getElementById('export-json')?.addEventListener('click', () => exportData());
    document.getElementById('clear-data')?.addEventListener('click', () => clearAllData(this.state, {
      onRerender: () => { this.render(); this.attachEventListeners(); },
    }));
    document.getElementById('share-data')?.addEventListener('click', () => shareData(this.state));

    // Transaction log modal
    const txnModal = document.getElementById('txn-log-modal');
    const txnSheet = txnModal?.querySelector('.txn-log-sheet') as HTMLElement | null;
    document.getElementById('show-txn-log')?.addEventListener('click', () => {
      txnSheet?.classList.remove('fullscreen');
      txnModal?.classList.add('active');
    });
    document.getElementById('txn-log-close')?.addEventListener('click', () => {
      txnModal?.classList.remove('active');
    });
    txnModal?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'txn-log-modal') txnModal.classList.remove('active');
    });
    // Drag header area to expand/collapse
    const txnHandle = txnSheet?.querySelector('.txnlog-header') as HTMLElement | null;
    if (txnHandle && txnSheet) {
      let startY = 0;
      const onStart = (y: number) => { startY = y; txnSheet.style.transition = 'none'; };
      const onEnd = (y: number) => {
        txnSheet.style.transition = '';
        const dy = startY - y;
        if (dy > 50) txnSheet.classList.add('fullscreen');
        else if (dy < -50) {
          if (txnSheet.classList.contains('fullscreen')) txnSheet.classList.remove('fullscreen');
          else txnModal?.classList.remove('active');
        }
      };
      txnHandle.addEventListener('touchstart', (e) => { onStart(e.touches[0].clientY); }, { passive: true });
      txnHandle.addEventListener('touchend', (e) => { onEnd(e.changedTouches[0].clientY); });
      txnHandle.addEventListener('mousedown', (e) => { onStart(e.clientY);
        const up = (ev: MouseEvent) => { onEnd(ev.clientY); window.removeEventListener('mouseup', up); };
        window.addEventListener('mouseup', up);
      });
    }
    // Tap card to expand action buttons
    document.querySelectorAll('.txnlog-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.txnlog-expand')) return;
        const eventId = (card as HTMLElement).dataset.eventId;
        if (!eventId) return;
        const expand = document.getElementById('txnlog-expand-' + eventId);
        document.querySelectorAll('.txnlog-expand.active').forEach(el => {
          if (el !== expand) el.classList.remove('active');
        });
        expand?.classList.toggle('active');
      });
    });

    // Edit button in expanded card
    document.querySelectorAll('.txnlog-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const eventId = (btn as HTMLElement).dataset.eventId;
        if (!eventId) return;
        const event = this.state.ledger.events.find(ev => ev.id === eventId);
        if (!event) return;

        document.getElementById('txn-log-modal')?.classList.remove('active');
        const te = event as unknown as { isin?: string; quantity?: number; pricePerShare?: number; fee?: number };
        const inst = te.isin ? this.state.ledger.instruments.find(i => i.isin === te.isin) : null;
        this.doShowTradeModal('full', inst ? {
          ticker: inst.ticker, name: inst.name, isin: inst.isin,
          instrumentType: inst.instrumentType || 'STOCK',
        } : undefined);
        setTimeout(() => {
          const dateInput = document.getElementById('trade-date') as HTMLInputElement;
          const priceInput = document.getElementById('trade-price') as HTMLInputElement;
          const qtyInput = document.getElementById('trade-qty') as HTMLInputElement;
          const feeInput = document.getElementById('trade-fee') as HTMLInputElement;
          if (dateInput) dateInput.value = event.date;
          if (priceInput && te.pricePerShare) { priceInput.value = te.pricePerShare.toString(); priceInput.dispatchEvent(new Event('input')); }
          if (qtyInput && te.quantity) { qtyInput.value = te.quantity.toString(); qtyInput.dispatchEvent(new Event('input')); }
          if (feeInput && te.fee) feeInput.value = te.fee.toString();
          const submitBtn = document.getElementById('submit-trade');
          if (submitBtn) submitBtn.dataset.replaceEventId = eventId;
        }, 100);
      });
    });

    // Delete button in expanded card
    document.querySelectorAll('.txnlog-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const eventId = (btn as HTMLElement).dataset.eventId;
        if (!eventId) return;
        if (!confirm('Er du sikker på at du vil slette denne transaksjonen?')) return;
        LedgerStorage.deleteEvent(eventId);
        this.state.ledger = LedgerStorage.loadLedger() || this.state.ledger;
        this.rerender();
        this.doComputePortfolioHistory();
      });
    });
    document.getElementById('csv-file')?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFileSelect(this.state, file);
    });
    // Sort holdings
    document.getElementById('sort-holdings')?.addEventListener('click', () => {
      const order: Array<'value' | 'gain' | 'name'> = ['value', 'gain', 'name'];
      const idx = order.indexOf(this.state.holdingSort);
      this.state.holdingSort = order[(idx + 1) % order.length];
      this.render();
      this.attachEventListeners();
      this.doComputePortfolioHistory();
    });

    // Trade modal
    const hasData = this.state.ledger.events.length > 0;
    document.getElementById('add-trade')?.addEventListener('click', () => this.doShowTradeModal(hasData ? 'full' : 'simple'));
    this.attachTradeModalListenersHelper();

    // Close import modal on backdrop click
    document.getElementById('import-modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'import-modal') hideImportModal();
    });

    // Period selector pills
    document.querySelectorAll('.period-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const period = (pill as HTMLElement).dataset.period as ReturnPeriod;
        if (period && period !== this.state.selectedPeriod) {
          this.state.selectedPeriod = period;
          const summaryCard = document.querySelector('.summary-hero');
          if (summaryCard) {
            this.render();
            this.attachEventListeners();
            reattachChartIfNeeded(this.state);
          }
        }
      });
    });

    // Holding cards — click to expand details
    document.querySelectorAll('.holding-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('price-input')) return;
        const isin = (card as HTMLElement).dataset.isin;
        const details = document.getElementById('details-' + isin);
        if (details) {
          details.classList.toggle('active');
          if (details.classList.contains('active')) {
            const chartWrap = details.querySelector('.holding-chart-wrap') as HTMLElement | null;
            if (chartWrap && !chartWrap.querySelector('canvas')) {
              const ticker = chartWrap.dataset.ticker;
              const hIsin = chartWrap.dataset.isin || '';
              const avgCost = parseFloat(chartWrap.dataset.cost || '0');
              if (ticker) {
                fetchPriceHistory(ticker).then(prices => {
                  if (!details.classList.contains('active')) return;
                  if (prices.length >= 2) {
                    renderHoldingChart(this.state, hIsin, ticker, prices, avgCost);
                  } else {
                    const area = chartWrap.querySelector('.holding-chart-area');
                    if (area) area.innerHTML = '<span class="text-muted text-small">Ingen prishistorikk</span>';
                  }
                });
              }
            }
            // Load market stats
            const mstats = details.querySelector('.market-stats') as HTMLElement | null;
            if (mstats && mstats.querySelector('.text-muted')) {
              const chartWrap2 = details.querySelector('.holding-chart-wrap') as HTMLElement | null;
              const t = chartWrap2?.dataset.ticker;
              if (t) loadMarketStats(this.state, t);
            }
          }
        }
      });
    });

    // Collapsible detail sections
    document.querySelectorAll('.detail-section-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = (btn as HTMLElement).dataset.target;
        if (!targetId) return;
        const body = document.getElementById(targetId);
        if (body) {
          body.classList.toggle('active');
          (btn as HTMLElement).classList.toggle('open');
        }
      });
    });

    // Quick-add transaction from holding detail
    document.querySelectorAll('.holding-add-trade').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isin = (btn as HTMLElement).dataset.isin;
        const inst = this.state.ledger.instruments.find(i => i.isin === isin);
        if (inst) {
          this.doShowTradeModal('full', {
            ticker: inst.ticker,
            name: inst.name,
            isin: inst.isin,
            instrumentType: inst.instrumentType || 'STOCK',
          });
        }
      });
    });

    // Delete transaction
    document.querySelectorAll('.txn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const eventId = (btn as HTMLElement).dataset.eventId;
        if (!eventId) return;
        if (!confirm('Er du sikker på at du vil slette denne transaksjonen?')) return;
        LedgerStorage.deleteEvent(eventId);
        this.state.ledger = LedgerStorage.loadLedger() || this.state.ledger;
        this.rerender();
        this.doComputePortfolioHistory();
      });
    });

    // Edit transaction
    document.querySelectorAll('.txn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const eventId = (btn as HTMLElement).dataset.eventId;
        if (!eventId) return;
        const event = this.state.ledger.events.find(ev => ev.id === eventId);
        if (!event) return;
        const te = event as unknown as { isin?: string; quantity?: number; pricePerShare?: number; fee?: number };
        const inst = te.isin ? this.state.ledger.instruments.find(i => i.isin === te.isin) : null;

        this.doShowTradeModal('full', inst ? {
          ticker: inst.ticker,
          name: inst.name,
          isin: inst.isin,
          instrumentType: inst.instrumentType || 'STOCK',
        } : undefined);

        setTimeout(() => {
          const dateInput = document.getElementById('trade-date') as HTMLInputElement;
          const priceInput = document.getElementById('trade-price') as HTMLInputElement;
          const qtyInput = document.getElementById('trade-qty') as HTMLInputElement;
          const feeInput = document.getElementById('trade-fee') as HTMLInputElement;
          const typeInput = document.getElementById('trade-type') as HTMLInputElement;

          if (dateInput) dateInput.value = event.date;
          if (priceInput && te.pricePerShare) { priceInput.value = te.pricePerShare.toString(); priceInput.dispatchEvent(new Event('input')); }
          if (qtyInput && te.quantity) { qtyInput.value = te.quantity.toString(); qtyInput.dispatchEvent(new Event('input')); }
          if (feeInput && te.fee) feeInput.value = te.fee.toString();

          if (typeInput) typeInput.value = event.type;
          document.querySelectorAll('.trade-tab').forEach(tab => {
            tab.classList.toggle('active', (tab as HTMLElement).dataset.type === event.type);
          });

          const submitBtn = document.getElementById('submit-trade');
          if (submitBtn) submitBtn.dataset.replaceEventId = eventId;
        }, 100);
      });
    });

    // Watchlist listeners
    document.getElementById('add-watchlist')?.addEventListener('click', () => {
      const searchEl = document.getElementById('watchlist-search');
      if (searchEl) {
        searchEl.style.display = searchEl.style.display === 'none' ? 'block' : 'none';
        if (searchEl.style.display === 'block') {
          document.getElementById('watchlist-ticker')?.focus();
        }
      }
    });

    document.querySelectorAll('.watchlist-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticker = (btn as HTMLElement).dataset.ticker;
        if (ticker) this.removeFromWatchlist(ticker);
      });
    });

    // Watchlist cards
    document.querySelectorAll('.watchlist-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('watchlist-remove-link') || target.classList.contains('stock-buy')) return;
        const ticker = (card as HTMLElement).dataset.ticker || '';
        const safeTicker = ticker.replace(/\./g, '_');
        const detail = document.getElementById('sdetail-' + safeTicker);
        if (!detail) return;
        detail.classList.toggle('active');
        if (detail.classList.contains('active')) {
          if (!detail.querySelector('canvas')) loadStockDetailChart(ticker, safeTicker);
          loadMarketStats(this.state, ticker);
        }
      });
    });

    // Buy buttons in watchlist detail
    document.querySelectorAll('.stock-buy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticker = (btn as HTMLElement).dataset.ticker;
        const stock = this.state.stockList.find(s => s.ticker === ticker);
        if (stock) {
          const inst = this.state.ledger.instruments.find(i => i.ticker === ticker);
          this.doShowTradeModal('full', { ticker: stock.ticker, name: stock.name, isin: inst?.isin || '', instrumentType: stock.type });
        }
      });
    });

    // Remove from watchlist (text link inside detail)
    document.querySelectorAll('.watchlist-remove-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticker = (btn as HTMLElement).dataset.ticker;
        if (ticker) this.removeFromWatchlist(ticker);
      });
    });

    // Popular suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const ticker = (chip as HTMLElement).dataset.ticker;
        const stock = this.state.stockList.find(s => s.ticker === ticker);
        if (stock) this.addToWatchlist(stock);
      });
    });

    // Watchlist search
    const wInput = document.getElementById('watchlist-ticker') as HTMLInputElement | null;
    const wSuggestions = document.getElementById('watchlist-suggestions') as HTMLElement | null;
    if (wInput && wSuggestions) {
      wInput.addEventListener('input', () => {
        const query = wInput.value.trim().toUpperCase();
        if (query.length === 0) { wSuggestions.innerHTML = ''; wSuggestions.classList.remove('active'); return; }
        const queryWords = query.split(/\s+/).filter(w => w.length > 0);
        const matches = this.state.stockList
          .filter(s => {
            if (this.state.watchlist.some(w => w.ticker === s.ticker)) return false;
            const held = this.state.ledger.instruments.find(i => i.ticker === s.ticker);
            if (held && this.state.holdings.some(h => h.isin === held.isin)) return false;
            const combined = (s.ticker + ' ' + s.name).toUpperCase();
            return queryWords.every(w => combined.includes(w));
          })
          .slice(0, 6);
        if (matches.length === 0) {
          wSuggestions.innerHTML = '<div class="suggestion-empty">Ingen treff</div>';
          wSuggestions.classList.add('active');
          return;
        }
        wSuggestions.innerHTML = matches.map(s => {
          const isFund = s.type === 'FUND';
          const badge = isFund ? '<span class="suggestion-badge">Fond</span>' : '';
          const label = isFund ? s.name : s.ticker;
          const sublabel = isFund ? '' : '<span class="suggestion-name">' + s.name + '</span>';
          return '<button class="suggestion-item" type="button">'
            + '<span class="suggestion-ticker">' + label + '</span>'
            + badge + sublabel
            + (s.currentPrice ? '<span class="suggestion-price">' + s.currentPrice.toFixed(2) + '</span>' : '')
            + '</button>';
        }).join('');
        wSuggestions.classList.add('active');
        wSuggestions.querySelectorAll('.suggestion-item').forEach((item, i) => {
          item.addEventListener('click', () => {
            this.addToWatchlist(matches[i]);
            wInput.value = '';
            wSuggestions.innerHTML = '';
            wSuggestions.classList.remove('active');
            document.getElementById('watchlist-search')!.style.display = 'none';
          });
        });
      });
    }
  }
}
