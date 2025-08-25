import './style.css';
import { Stock, Portfolio } from './types';
import { StorageService } from './storage';
import { StockAPI } from './api';
import { PortfolioCalculator } from './portfolio';

class App {
  private portfolio: Portfolio;

  constructor() {
    this.portfolio = StorageService.loadPortfolio() || { stocks: [], lastUpdated: new Date().toISOString() };
    this.init();
  }

  private init(): void {
    this.render();
    this.attachEventListeners();
    this.refreshPrices();
  }

  private render(): void {
    const app = document.getElementById('app');
    if (!app) return;

    const summary = PortfolioCalculator.calculateSummary(this.portfolio);

    app.innerHTML = `
      <header>
        <div class="container">
          <h1>📈 Norwegian Stock Portfolio Tracker</h1>
        </div>
      </header>

      <div class="container">
        <div class="card">
          <div class="card-header">
            <h2>Portfolio Summary</h2>
            <button class="btn btn-primary" id="add-stock-btn">Add Stock</button>
          </div>
          
          <div class="summary-grid">
            <div class="summary-item">
              <div class="label">Total Invested</div>
              <div class="value">${PortfolioCalculator.formatCurrency(summary.totalInvested)}</div>
            </div>
            <div class="summary-item">
              <div class="label">Current Value</div>
              <div class="value">${PortfolioCalculator.formatCurrency(summary.currentValue)}</div>
            </div>
            <div class="summary-item">
              <div class="label">Total Dividends</div>
              <div class="value">${PortfolioCalculator.formatCurrency(summary.totalDividends)}</div>
            </div>
            <div class="summary-item">
              <div class="label">Total Return</div>
              <div class="value ${summary.totalReturn >= 0 ? 'text-success' : 'text-danger'}">
                ${PortfolioCalculator.formatCurrency(summary.totalReturn)}
                <small>(${PortfolioCalculator.formatPercent(summary.totalReturnPercent)})</small>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>Holdings</h2>
            <div style="display: flex; align-items: center; gap: 1rem;">
              <button class="btn btn-primary btn-small" id="refresh-prices-btn">
                Refresh Prices
              </button>
              <small id="last-update-time" class="text-muted"></small>
            </div>
          </div>
          
          ${this.renderPortfolioTable()}
        </div>
      </div>

      <div class="modal" id="add-stock-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Add Stock to Portfolio</h3>
          </div>
          <form id="add-stock-form">
            <div class="search-container">
              <label for="stock-search">Search Norwegian Stocks</label>
              <input type="text" class="form-control" id="stock-search" placeholder="Type ticker or company name..." autocomplete="off">
              <div class="search-hint">Start typing to search Oslo Børs stocks</div>
              <div id="search-results" class="search-results" style="display: none;"></div>
            </div>
            
            <div class="popular-stocks" id="popular-stocks">
              <div class="popular-stocks-header">Popular Norwegian Stocks</div>
              <div class="popular-stocks-grid" id="popular-stocks-grid"></div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="stock-ticker">Ticker Symbol</label>
                <input type="text" class="form-control" id="stock-ticker" placeholder="e.g., EQNR" required readonly>
              </div>
              <div class="form-group">
                <label for="stock-name">Company Name</label>
                <input type="text" class="form-control" id="stock-name" placeholder="e.g., Equinor ASA" required readonly>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="stock-shares">Number of Shares</label>
                <input type="number" class="form-control" id="stock-shares" min="1" required>
              </div>
              <div class="form-group">
                <label for="stock-price">Purchase Price (NOK)</label>
                <input type="number" class="form-control" id="stock-price" min="0" step="0.01" required>
              </div>
            </div>
            <div class="form-group">
              <label for="stock-date">Purchase Date</label>
              <input type="date" class="form-control" id="stock-date" required>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-danger" id="cancel-add-btn">Cancel</button>
              <button type="submit" class="btn btn-success">Add Stock</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private renderPortfolioTable(): string {
    if (this.portfolio.stocks.length === 0) {
      return `
        <div class="empty-state">
          <p>No stocks in your portfolio yet.</p>
          <p class="text-muted">Click "Add Stock" to get started.</p>
        </div>
      `;
    }

    const rows = this.portfolio.stocks.map(stock => {
      const calc = PortfolioCalculator.calculateStockReturn(stock);
      const returnClass = calc.totalReturn >= 0 ? 'text-success' : 'text-danger';
      
      return `
        <tr>
          <td>
            <strong>${stock.ticker}</strong><br>
            <small class="text-muted">${stock.name}</small>
          </td>
          <td>${stock.shares}</td>
          <td>${PortfolioCalculator.formatCurrency(stock.purchasePrice)}</td>
          <td>${stock.currentPrice && stock.currentPrice > 0 ? PortfolioCalculator.formatCurrency(stock.currentPrice) : '<span class="text-muted" title="Price data not available">N/A</span>'}</td>
          <td>${PortfolioCalculator.formatCurrency(calc.invested)}</td>
          <td>${PortfolioCalculator.formatCurrency(calc.currentValue)}</td>
          <td>${PortfolioCalculator.formatCurrency(calc.dividends)}</td>
          <td class="${returnClass}">
            ${PortfolioCalculator.formatCurrency(calc.totalReturn)}<br>
            <small>${PortfolioCalculator.formatPercent(calc.totalReturnPercent)}</small>
          </td>
          <td>
            <button class="btn btn-danger btn-small delete-stock-btn" data-id="${stock.id}">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <table class="portfolio-table">
        <thead>
          <tr>
            <th>Stock</th>
            <th>Shares</th>
            <th>Buy Price</th>
            <th>Current Price</th>
            <th>Invested</th>
            <th>Market Value</th>
            <th>Dividends</th>
            <th>Total Return</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  private attachEventListeners(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const parentButton = target.closest('.popular-stock-btn');
      const resultItem = target.closest('.search-result-item');

      if (target.id === 'add-stock-btn') {
        this.showAddStockModal();
      } else if (target.id === 'cancel-add-btn') {
        this.hideAddStockModal();
      } else if (target.id === 'refresh-prices-btn') {
        this.refreshPrices();
      } else if (target.classList.contains('delete-stock-btn')) {
        const stockId = target.dataset.id;
        if (stockId && confirm('Are you sure you want to delete this stock?')) {
          this.deleteStock(stockId);
        }
      } else if (resultItem) {
        const ticker = (resultItem as HTMLElement).dataset.ticker;
        const name = (resultItem as HTMLElement).dataset.name;
        if (ticker && name) {
          this.selectSearchResult(ticker, name);
        }
      } else if (parentButton) {
        const ticker = (parentButton as HTMLElement).dataset.ticker;
        const name = (parentButton as HTMLElement).dataset.name;
        if (ticker && name) {
          this.selectSearchResult(ticker, name);
        }
      }
    });

    const form = document.getElementById('add-stock-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addStock();
      });
    }

    const searchInput = document.getElementById('stock-search');
    if (searchInput) {
      let searchTimeout: ReturnType<typeof setTimeout>;
      
      searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => this.searchStocks(query), 300);
      });

      searchInput.addEventListener('focus', () => {
        const query = (searchInput as HTMLInputElement).value;
        if (query.length >= 1) {
          this.searchStocks(query);
        }
      });

      // Hide search results when clicking outside
      document.addEventListener('click', (e) => {
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer && !searchContainer.contains(e.target as Node)) {
          const resultsDiv = document.getElementById('search-results');
          if (resultsDiv) {
            resultsDiv.style.display = 'none';
          }
        }
      });
    }
  }

  private async searchStocks(query: string): Promise<void> {
    const resultsDiv = document.getElementById('search-results');
    if (!resultsDiv) return;

    if (query.length < 1) {
      resultsDiv.style.display = 'none';
      return;
    }

    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = '<div style="padding: 10px; text-align: center;"><span class="loading"></span></div>';

    try {
      const results = await StockAPI.searchStocks(query);
      
      if (results.length === 0) {
        resultsDiv.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--text-muted);">No stocks found</div>';
        return;
      }

      resultsDiv.innerHTML = results.map(stock => `
        <div class="search-result-item" data-ticker="${stock.ticker}" data-name="${stock.name}">
          <div>
            <span class="search-result-ticker">${stock.ticker}</span>
            <span class="search-result-name">${stock.name}</span>
          </div>
          ${stock.sector ? `<span class="search-result-sector">${stock.sector}</span>` : ''}
        </div>
      `).join('');
    } catch (error) {
      resultsDiv.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--danger-color);">Failed to search stocks</div>';
    }
  }

  private selectSearchResult(ticker: string, name: string): void {
    const tickerInput = document.getElementById('stock-ticker') as HTMLInputElement;
    const nameInput = document.getElementById('stock-name') as HTMLInputElement;
    const searchInput = document.getElementById('stock-search') as HTMLInputElement;
    const resultsDiv = document.getElementById('search-results');
    const popularStocks = document.getElementById('popular-stocks');

    if (tickerInput) {
      tickerInput.value = ticker;
      tickerInput.removeAttribute('readonly');
    }
    if (nameInput) {
      nameInput.value = name;
      nameInput.removeAttribute('readonly');
    }
    if (searchInput) {
      searchInput.value = `${ticker} - ${name}`;
    }
    if (resultsDiv) {
      resultsDiv.style.display = 'none';
    }
    if (popularStocks) {
      popularStocks.style.display = 'none';
    }

    // Focus on shares input for quick entry
    const sharesInput = document.getElementById('stock-shares') as HTMLInputElement;
    if (sharesInput) {
      sharesInput.focus();
    }
  }

  private async showAddStockModal(): Promise<void> {
    const modal = document.getElementById('add-stock-modal');
    if (modal) {
      modal.classList.add('active');
      
      // Set default date
      const dateInput = document.getElementById('stock-date') as HTMLInputElement;
      if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
      }

      // Reset fields
      const tickerInput = document.getElementById('stock-ticker') as HTMLInputElement;
      const nameInput = document.getElementById('stock-name') as HTMLInputElement;
      if (tickerInput) {
        tickerInput.setAttribute('readonly', 'true');
      }
      if (nameInput) {
        nameInput.setAttribute('readonly', 'true');
      }

      // Show popular stocks
      const popularStocks = document.getElementById('popular-stocks');
      if (popularStocks) {
        popularStocks.style.display = 'block';
      }

      // Load popular stocks
      await this.loadPopularStocks();

      // Focus search input
      const searchInput = document.getElementById('stock-search') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    }
  }

  private async loadPopularStocks(): Promise<void> {
    const gridDiv = document.getElementById('popular-stocks-grid');
    if (!gridDiv) return;

    const popularTickers = ['EQNR', 'DNB', 'TEL', 'MOWI', 'YAR', 'NHY', 'SALM', 'KOG'];
    const stocks = await StockAPI.searchStocks('');
    
    const popularStocks = stocks.filter(s => popularTickers.includes(s.ticker));

    gridDiv.innerHTML = popularStocks.map(stock => `
      <button type="button" class="popular-stock-btn" data-ticker="${stock.ticker}" data-name="${stock.name}">
        <span class="popular-stock-ticker">${stock.ticker}</span>
        <span class="popular-stock-name">${stock.name}</span>
      </button>
    `).join('');
  }

  private hideAddStockModal(): void {
    const modal = document.getElementById('add-stock-modal');
    if (modal) {
      modal.classList.remove('active');
      const form = document.getElementById('add-stock-form') as HTMLFormElement;
      if (form) form.reset();
    }
  }

  private async addStock(): Promise<void> {
    const ticker = (document.getElementById('stock-ticker') as HTMLInputElement)?.value;
    const name = (document.getElementById('stock-name') as HTMLInputElement)?.value;
    const shares = parseInt((document.getElementById('stock-shares') as HTMLInputElement)?.value);
    const price = parseFloat((document.getElementById('stock-price') as HTMLInputElement)?.value);
    const date = (document.getElementById('stock-date') as HTMLInputElement)?.value;

    if (!ticker || !name || !shares || !price || !date) return;

    const stock: Stock = {
      id: Date.now().toString(),
      ticker: ticker.toUpperCase(),
      name,
      shares,
      purchasePrice: price,
      purchaseDate: date
    };

    StorageService.addStock(stock);
    this.portfolio = StorageService.loadPortfolio() || this.portfolio;
    
    this.hideAddStockModal();
    this.render();
    this.attachEventListeners();
    
    this.refreshStockData(stock.id);
  }

  private deleteStock(stockId: string): void {
    StorageService.removeStock(stockId);
    this.portfolio = StorageService.loadPortfolio() || this.portfolio;
    this.render();
    this.attachEventListeners();
  }

  private async refreshPrices(): Promise<void> {
    const btn = document.getElementById('refresh-prices-btn');
    if (btn) {
      btn.innerHTML = '<span class="loading"></span>';
      btn.setAttribute('disabled', 'true');
    }

    for (const stock of this.portfolio.stocks) {
      await this.refreshStockData(stock.id);
    }

    // Get the last update time from the data source
    const lastUpdateTime = await StockAPI.getLastUpdateTime();
    if (lastUpdateTime) {
      this.portfolio.lastUpdated = lastUpdateTime;
      StorageService.savePortfolio(this.portfolio);
      
      // Update the display
      const lastUpdateEl = document.getElementById('last-update-time');
      if (lastUpdateEl) {
        const date = new Date(lastUpdateTime);
        lastUpdateEl.textContent = `Data last updated: ${date.toLocaleString('no-NO')}`;
      }
    }

    if (btn) {
      btn.innerHTML = 'Refresh Prices';
      btn.removeAttribute('disabled');
    }
  }

  private async refreshStockData(stockId: string): Promise<void> {
    const stock = this.portfolio.stocks.find(s => s.id === stockId);
    if (!stock) return;

    try {
      const [quote, dividends] = await Promise.all([
        StockAPI.fetchStockPrice(stock.ticker),
        StockAPI.fetchDividendHistory(stock.ticker)
      ]);

      if (quote) {
        StorageService.updateStock(stockId, {
          currentPrice: quote.price,
          dividends: dividends
        });
        this.portfolio = StorageService.loadPortfolio() || this.portfolio;
        this.render();
        this.attachEventListeners();
      }
    } catch (error) {
      console.error(`Failed to refresh data for ${stock.ticker}:`, error);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});