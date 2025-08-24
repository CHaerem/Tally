export interface Stock {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  purchasePrice: number;
  purchaseDate: string;
  currentPrice?: number;
  dividends?: Dividend[];
}

export interface Dividend {
  date: string;
  amount: number;
  perShare: number;
}

export interface Portfolio {
  stocks: Stock[];
  lastUpdated: string;
}

export interface StockQuote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface PortfolioSummary {
  totalInvested: number;
  currentValue: number;
  totalDividends: number;
  totalReturn: number;
  totalReturnPercent: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
}