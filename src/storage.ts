import { Portfolio, Stock } from './types';

const STORAGE_KEY = 'norwegian_stock_portfolio';

export class StorageService {
  static savePortfolio(portfolio: Portfolio): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
    } catch (error) {
      console.error('Failed to save portfolio:', error);
    }
  }

  static loadPortfolio(): Portfolio | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load portfolio:', error);
    }
    return null;
  }

  static addStock(stock: Stock): void {
    const portfolio = this.loadPortfolio() || { stocks: [], lastUpdated: new Date().toISOString() };
    portfolio.stocks.push(stock);
    portfolio.lastUpdated = new Date().toISOString();
    this.savePortfolio(portfolio);
  }

  static updateStock(stockId: string, updates: Partial<Stock>): void {
    const portfolio = this.loadPortfolio();
    if (portfolio) {
      const index = portfolio.stocks.findIndex(s => s.id === stockId);
      if (index !== -1) {
        portfolio.stocks[index] = { ...portfolio.stocks[index], ...updates };
        portfolio.lastUpdated = new Date().toISOString();
        this.savePortfolio(portfolio);
      }
    }
  }

  static removeStock(stockId: string): void {
    const portfolio = this.loadPortfolio();
    if (portfolio) {
      portfolio.stocks = portfolio.stocks.filter(s => s.id !== stockId);
      portfolio.lastUpdated = new Date().toISOString();
      this.savePortfolio(portfolio);
    }
  }

  static clearPortfolio(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}