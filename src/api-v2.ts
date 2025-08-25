import { StockQuote, Dividend } from './types';

interface IndexData {
  version: string;
  lastFullUpdate: string | null;
  lastIncrementalUpdate: string | null;
  symbols: {
    [ticker: string]: {
      name: string;
      type: string;
      currency: string;
      lastUpdate: string;
      hasQuote: boolean;
      hasDividends: boolean;
      dataQuality: 'good' | 'stale' | 'error';
      error?: string;
    };
  };
  metadata: {
    exchange: string;
    source: string;
    updateSchedule: string;
  };
}

interface SymbolData {
  symbol: string;
  name: string;
  type: string;
  currency: string;
  quote: {
    price: number;
    change: number;
    changePercent: number;
    high: number;
    low: number;
    open: number;
    previousClose: number;
    timestamp: string;
  } | null;
  dividends: Array<{
    exDate?: string;
    payDate?: string;
    date?: string;
    amount: number;
    currency?: string;
    source: string;
  }>;
  history: Array<{
    date: string;
    price: number;
    high: number;
    low: number;
    open: number;
  }>;
  metadata: {
    firstFetch: string;
    lastUpdate: string;
    dataQuality: string;
  };
}

export class StockAPIv2 {
  private static indexCache: IndexData | null = null;
  private static symbolCache: Map<string, { data: SymbolData; timestamp: number }> = new Map();
  private static lastIndexFetch: number = 0;
  private static INDEX_CACHE_DURATION = 1 * 60 * 1000; // 1 minute for index
  private static SYMBOL_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for symbol data
  private static loadingPromises: Map<string, Promise<SymbolData | null>> = new Map();

  /**
   * Load the index file to get available symbols
   */
  private static async loadIndex(): Promise<IndexData | null> {
    // Check cache
    if (this.indexCache && Date.now() - this.lastIndexFetch < this.INDEX_CACHE_DURATION) {
      return this.indexCache;
    }

    try {
      const response = await fetch('/data/index.json');
      
      if (!response.ok) {
        // Fallback to old single file if new structure doesn't exist yet
        return this.loadLegacyData();
      }
      
      this.indexCache = await response.json();
      this.lastIndexFetch = Date.now();
      return this.indexCache;
    } catch (error) {
      console.error('Failed to load index:', error);
      return this.loadLegacyData();
    }
  }

  /**
   * Fallback to legacy single JSON file
   */
  private static async loadLegacyData(): Promise<IndexData | null> {
    try {
      const response = await fetch('/stock-data.json');
      if (!response.ok) return null;
      
      const legacyData = await response.json();
      
      // Convert legacy format to new index format
      const index: IndexData = {
        version: '1.0.0',
        lastFullUpdate: legacyData.metadata?.lastUpdated || null,
        lastIncrementalUpdate: null,
        symbols: {},
        metadata: {
          exchange: 'Oslo Børs',
          source: legacyData.metadata?.source || 'Unknown',
          updateSchedule: 'Legacy'
        }
      };
      
      // Convert stocks to index entries
      if (legacyData.stocks) {
        for (const [symbol, data] of Object.entries(legacyData.stocks as any)) {
          index.symbols[symbol] = {
            name: symbol,
            type: 'EQS',
            currency: 'NOK',
            lastUpdate: data.timestamp || legacyData.metadata?.lastUpdated,
            hasQuote: !!data.price,
            hasDividends: !!data.dividends?.length,
            dataQuality: data.price ? 'good' : 'stale'
          };
        }
      }
      
      return index;
    } catch (error) {
      console.error('Failed to load legacy data:', error);
      return null;
    }
  }

  /**
   * Load data for a specific symbol (lazy loading)
   */
  private static async loadSymbolData(ticker: string): Promise<SymbolData | null> {
    const upperTicker = ticker.toUpperCase();
    
    // Check if we're already loading this symbol
    const existingPromise = this.loadingPromises.get(upperTicker);
    if (existingPromise) {
      return existingPromise;
    }

    // Check cache
    const cached = this.symbolCache.get(upperTicker);
    if (cached && Date.now() - cached.timestamp < this.SYMBOL_CACHE_DURATION) {
      return cached.data;
    }

    // Create loading promise
    const loadPromise = this.doLoadSymbolData(upperTicker);
    this.loadingPromises.set(upperTicker, loadPromise);

    try {
      const data = await loadPromise;
      if (data) {
        this.symbolCache.set(upperTicker, { data, timestamp: Date.now() });
      }
      return data;
    } finally {
      this.loadingPromises.delete(upperTicker);
    }
  }

  private static async doLoadSymbolData(ticker: string): Promise<SymbolData | null> {
    try {
      // Try loading from per-symbol file
      const response = await fetch(`/data/${ticker}.json`);
      
      if (!response.ok) {
        // Fallback to legacy data
        return this.loadLegacySymbolData(ticker);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Failed to load data for ${ticker}:`, error);
      return this.loadLegacySymbolData(ticker);
    }
  }

  /**
   * Fallback to extract symbol data from legacy single file
   */
  private static async loadLegacySymbolData(ticker: string): Promise<SymbolData | null> {
    try {
      const response = await fetch('/stock-data.json');
      if (!response.ok) return null;
      
      const legacyData = await response.json();
      const stockData = legacyData.stocks?.[ticker];
      
      if (!stockData) return null;
      
      // Convert to new format
      return {
        symbol: ticker,
        name: ticker,
        type: 'EQS',
        currency: 'NOK',
        quote: stockData.price ? {
          price: stockData.price,
          change: stockData.change || 0,
          changePercent: stockData.changePercent || 0,
          high: stockData.high || stockData.price,
          low: stockData.low || stockData.price,
          open: stockData.open || stockData.price,
          previousClose: stockData.previousClose || stockData.price,
          timestamp: stockData.timestamp || legacyData.metadata?.lastUpdated
        } : null,
        dividends: stockData.dividends || [],
        history: [],
        metadata: {
          firstFetch: legacyData.metadata?.lastUpdated,
          lastUpdate: stockData.timestamp || legacyData.metadata?.lastUpdated,
          dataQuality: stockData.price ? 'good' : 'stale'
        }
      };
    } catch (error) {
      console.error(`Failed to load legacy data for ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Public API: Fetch stock price
   */
  static async fetchStockPrice(ticker: string): Promise<StockQuote | null> {
    try {
      const data = await this.loadSymbolData(ticker);
      
      if (!data || !data.quote) {
        return null;
      }
      
      return {
        ticker: data.symbol,
        price: data.quote.price,
        change: data.quote.change,
        changePercent: data.quote.changePercent,
        timestamp: data.quote.timestamp
      };
    } catch (error) {
      console.error(`Failed to fetch price for ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Public API: Fetch dividend history
   */
  static async fetchDividendHistory(ticker: string): Promise<Dividend[]> {
    try {
      const data = await this.loadSymbolData(ticker);
      
      if (!data || !data.dividends) {
        return [];
      }
      
      // Convert to app format
      return data.dividends.map(div => ({
        date: div.exDate || div.payDate || div.date || '',
        amount: div.amount,
        perShare: div.amount
      }));
    } catch (error) {
      console.error(`Failed to fetch dividends for ${ticker}:`, error);
      return [];
    }
  }

  /**
   * Public API: Get last update time for a symbol
   */
  static async getSymbolUpdateTime(ticker: string): Promise<string | null> {
    try {
      const data = await this.loadSymbolData(ticker);
      return data?.metadata?.lastUpdate || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Public API: Get data quality for a symbol
   */
  static async getSymbolDataQuality(ticker: string): Promise<'good' | 'stale' | 'error' | 'unknown'> {
    try {
      const index = await this.loadIndex();
      const symbolInfo = index?.symbols[ticker.toUpperCase()];
      
      if (!symbolInfo) return 'unknown';
      
      // Check if data is fresh (less than 24 hours old)
      const lastUpdate = new Date(symbolInfo.lastUpdate);
      const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      
      if (symbolInfo.dataQuality === 'error') return 'error';
      if (hoursSinceUpdate > 24) return 'stale';
      
      return symbolInfo.dataQuality || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Public API: Search for stocks
   */
  static async searchStocks(query: string): Promise<Array<{ticker: string, name: string, sector?: string}>> {
    try {
      const index = await this.loadIndex();
      
      if (!index) {
        // Fallback to hardcoded list
        return this.getHardcodedStocks().filter(stock => 
          stock.ticker.toLowerCase().includes(query.toLowerCase()) ||
          stock.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 12);
      }
      
      const results: Array<{ticker: string, name: string, sector?: string}> = [];
      
      for (const [symbol, info] of Object.entries(index.symbols)) {
        if (
          symbol.toLowerCase().includes(query.toLowerCase()) ||
          info.name.toLowerCase().includes(query.toLowerCase())
        ) {
          results.push({
            ticker: symbol,
            name: info.name,
            sector: info.type
          });
        }
        
        if (results.length >= 12) break;
      }
      
      return results;
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  /**
   * Public API: Get all available symbols
   */
  static async getAllSymbols(): Promise<string[]> {
    try {
      const index = await this.loadIndex();
      return index ? Object.keys(index.symbols) : [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Public API: Batch fetch for multiple symbols (optimized for portfolio)
   */
  static async fetchBatchPrices(tickers: string[]): Promise<Map<string, StockQuote>> {
    const results = new Map<string, StockQuote>();
    
    // Load all symbols in parallel
    const promises = tickers.map(async ticker => {
      const quote = await this.fetchStockPrice(ticker);
      if (quote) {
        results.set(ticker, quote);
      }
    });
    
    await Promise.all(promises);
    return results;
  }

  /**
   * Hardcoded fallback stocks
   */
  private static getHardcodedStocks() {
    return [
      { ticker: 'EQNR', name: 'Equinor ASA', sector: 'Energy' },
      { ticker: 'DNB', name: 'DNB Bank ASA', sector: 'Banking' },
      { ticker: 'TEL', name: 'Telenor ASA', sector: 'Telecom' },
      { ticker: 'MOWI', name: 'Mowi ASA', sector: 'Seafood' },
      { ticker: 'YAR', name: 'Yara International ASA', sector: 'Chemicals' },
      { ticker: 'ORK', name: 'Orkla ASA', sector: 'Consumer Goods' },
      { ticker: 'SALM', name: 'SalMar ASA', sector: 'Seafood' },
      { ticker: 'NHY', name: 'Norsk Hydro ASA', sector: 'Materials' },
      { ticker: 'SNTIA', name: 'Sentia Group ASA', sector: 'Technology' },
      { ticker: 'NEL', name: 'Nel ASA', sector: 'Hydrogen' },
      { ticker: 'KAHOT', name: 'Kahoot! ASA', sector: 'EdTech' },
      { ticker: 'REC', name: 'REC Silicon ASA', sector: 'Materials' }
    ];
  }

  /**
   * Clear all caches (useful for testing or forcing refresh)
   */
  static clearCache(): void {
    this.indexCache = null;
    this.symbolCache.clear();
    this.loadingPromises.clear();
    this.lastIndexFetch = 0;
  }
}