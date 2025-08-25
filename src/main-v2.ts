import './style.css';
import { Stock, Portfolio } from './types';
import { StorageService } from './storage';
import { StockAPIv2 } from './api-v2';
import { PortfolioCalculator } from './portfolio';

class App {
  private portfolio: Portfolio;
  private dataQualityMap: Map<string, string> = new Map();

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
              <div class="label">Net Profit</div>
              <div class="value ${summary.netProfit >= 0 ? 'text-success' : 'text-danger'}">
                ${PortfolioCalculator.formatCurrency(summary.netProfit)}
                <small>(${PortfolioCalculator.formatPercent(summary.netProfitPercent)})</small>
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
          <h2>Add Stock to Portfolio</h2>
          <form id="add-stock-form">
            <div class="form-group">
              <label for="stock-ticker">Stock Ticker</label>
              <input type="text" class="form-control" id="stock-ticker" 
                placeholder="Search Norwegian stocks..." autocomplete="off" required>
              <div id="search-results" class="search-results"></div>
              <div id="popular-stocks" class="popular-stocks">
                <small>Popular stocks:</small>
                <div class="popular-stocks-list">
                  <button type="button" class="popular-stock-btn" data-ticker="EQNR" data-name="Equinor ASA">EQNR</button>
                  <button type="button" class="popular-stock-btn" data-ticker="DNB" data-name="DNB Bank ASA">DNB</button>
                  <button type="button" class="popular-stock-btn" data-ticker="TEL" data-name="Telenor ASA">TEL</button>
                  <button type="button" class="popular-stock-btn" data-ticker="MOWI" data-name="Mowi ASA">MOWI</button>
                </div>
              </div>
            </div>
            <div class="form-row">
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
      const dataQuality = this.dataQualityMap.get(stock.ticker) || 'unknown';
      
      // Create data quality badge
      let qualityBadge = '';
      if (dataQuality === 'good') {
        qualityBadge = '<span class="badge badge-success" title="Data is fresh">✓</span>';
      } else if (dataQuality === 'stale') {
        qualityBadge = '<span class="badge badge-warning" title="Data is older than 24 hours">⚠</span>';
      } else if (dataQuality === 'error') {
        qualityBadge = '<span class="badge badge-danger" title="Failed to fetch data">✗</span>';
      }
      
      return `
        <tr>
          <td>
            <strong>${stock.ticker}</strong> ${qualityBadge}<br>
            <small class="text-muted">${stock.name}</small>
            ${stock.lastUpdated ? `<br><small class="text-muted" style="font-size: 10px;">Updated: ${new Date(stock.lastUpdated).toLocaleString('no-NO', { timeStyle: 'short', dateStyle: 'short' })}</small>` : ''}
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
      <style>
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: bold;
          margin-left: 4px;
        }
        .badge-success { background: #28a745; color: white; }
        .badge-warning { background: #ffc107; color: black; }
        .badge-danger { background: #dc3545; color: white; }
      </style>
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
        const stockId = target.getAttribute('data-id');
        if (stockId && confirm('Are you sure you want to delete this stock?')) {
          this.deleteStock(stockId);
        }
      } else if (parentButton) {
        this.selectStock(
          parentButton.getAttribute('data-ticker') || '',
          parentButton.getAttribute('data-name') || ''
        );
      } else if (resultItem) {
        this.selectStock(
          resultItem.getAttribute('data-ticker') || '',
          resultItem.getAttribute('data-name') || ''
        );
      }
    });

    const tickerInput = document.getElementById('stock-ticker') as HTMLInputElement;
    if (tickerInput) {
      let searchTimeout: ReturnType<typeof setTimeout>;
      tickerInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = (e.target as HTMLInputElement).value;
        
        if (query.length >= 2) {
          searchTimeout = setTimeout(() => this.searchStocks(query), 300);
        } else {
          this.clearSearchResults();
        }
      });
    }

    const form = document.getElementById('add-stock-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addStock();
      });
    }
  }

  private async searchStocks(query: string): Promise<void> {
    const results = await StockAPIv2.searchStocks(query);
    const resultsDiv = document.getElementById('search-results');
    
    if (!resultsDiv) return;
    
    if (results.length === 0) {
      resultsDiv.innerHTML = '<div class="no-results">No stocks found</div>';
      return;
    }
    
    resultsDiv.innerHTML = results.map(stock => `
      <div class="search-result-item" data-ticker="${stock.ticker}" data-name="${stock.name}">
        <strong>${stock.ticker}</strong> - ${stock.name}
        ${stock.sector ? `<small class="text-muted">${stock.sector}</small>` : ''}
      </div>
    `).join('');
  }

  private clearSearchResults(): void {
    const resultsDiv = document.getElementById('search-results');
    if (resultsDiv) {
      resultsDiv.innerHTML = '';
    }
  }

  private selectStock(ticker: string, name: string): void {
    const tickerInput = document.getElementById('stock-ticker') as HTMLInputElement;
    const nameInput = document.getElementById('stock-name') as HTMLInputElement;
    
    if (tickerInput) tickerInput.value = ticker;
    if (nameInput) nameInput.value = name;
    
    this.clearSearchResults();
  }

  private showAddStockModal(): void {
    const modal = document.getElementById('add-stock-modal');
    if (modal) {
      modal.style.display = 'block';
      // Set today as default date
      const dateInput = document.getElementById('stock-date') as HTMLInputElement;
      if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
      }
    }
  }

  private hideAddStockModal(): void {
    const modal = document.getElementById('add-stock-modal');
    if (modal) {
      modal.style.display = 'none';
      // Reset form
      const form = document.getElementById('add-stock-form') as HTMLFormElement;
      if (form) form.reset();
      this.clearSearchResults();
    }
  }

  private async addStock(): Promise<void> {
    const ticker = (document.getElementById('stock-ticker') as HTMLInputElement)?.value;
    const name = (document.getElementById('stock-name') as HTMLInputElement)?.value;
    const shares = parseInt((document.getElementById('stock-shares') as HTMLInputElement)?.value);
    const purchasePrice = parseFloat((document.getElementById('stock-price') as HTMLInputElement)?.value);
    const purchaseDate = (document.getElementById('stock-date') as HTMLInputElement)?.value;

    if (!ticker || !name || !shares || !purchasePrice || !purchaseDate) {
      alert('Please fill in all fields');
      return;
    }

    const newStock: Stock = {
      id: Date.now().toString(),
      ticker: ticker.toUpperCase(),
      name,
      shares,
      purchasePrice,
      purchaseDate,
      currentPrice: 0,
      dividends: []
    };

    this.portfolio.stocks.push(newStock);
    StorageService.savePortfolio(this.portfolio);
    
    // Immediately fetch data for the new stock
    await this.refreshStockData(newStock.id);
    
    this.hideAddStockModal();
    this.render();
    this.attachEventListeners();
  }

  private deleteStock(stockId: string): void {
    this.portfolio.stocks = this.portfolio.stocks.filter(s => s.id !== stockId);
    StorageService.savePortfolio(this.portfolio);
    this.render();
    this.attachEventListeners();
  }

  private async refreshPrices(): Promise<void> {
    const btn = document.getElementById('refresh-prices-btn');
    if (btn) {
      btn.innerHTML = '<span class="loading"></span>';
      btn.setAttribute('disabled', 'true');
    }

    // Lazy load only portfolio symbols
    const tickers = this.portfolio.stocks.map(s => s.ticker);
    
    if (tickers.length > 0) {
      // Batch fetch prices for better performance
      const quotes = await StockAPIv2.fetchBatchPrices(tickers);
      
      // Update stocks with fetched data
      for (const stock of this.portfolio.stocks) {
        const quote = quotes.get(stock.ticker);
        if (quote) {
          stock.currentPrice = quote.price;
          stock.lastUpdated = quote.timestamp;
        }
        
        // Fetch dividends
        const dividends = await StockAPIv2.fetchDividendHistory(stock.ticker);
        stock.dividends = dividends;
        
        // Get data quality
        const quality = await StockAPIv2.getSymbolDataQuality(stock.ticker);
        this.dataQualityMap.set(stock.ticker, quality);
      }
      
      this.portfolio.lastUpdated = new Date().toISOString();
      StorageService.savePortfolio(this.portfolio);
    }

    // Update UI
    this.render();
    this.attachEventListeners();
    
    // Show last update time
    const lastUpdateEl = document.getElementById('last-update-time');
    if (lastUpdateEl) {
      const date = new Date();
      lastUpdateEl.textContent = `Last refreshed: ${date.toLocaleString('no-NO')}`;
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
        StockAPIv2.fetchStockPrice(stock.ticker),
        StockAPIv2.fetchDividendHistory(stock.ticker)
      ]);

      if (quote) {
        stock.currentPrice = quote.price;
        stock.lastUpdated = quote.timestamp;
      }

      stock.dividends = dividends;
      
      // Get data quality
      const quality = await StockAPIv2.getSymbolDataQuality(stock.ticker);
      this.dataQualityMap.set(stock.ticker, quality);

      this.portfolio.lastUpdated = new Date().toISOString();
      StorageService.savePortfolio(this.portfolio);
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error(`Failed to refresh data for ${stock.ticker}:`, error);
    }
  }
}

// Initialize app
new App();