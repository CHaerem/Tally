export interface CashFlow {
  date: Date;
  amount: number;
}

export interface Holding {
  isin: string;
  ticker: string;
  name: string;
  quantity: number;
  costBasis: number;
  averageCostPerShare: number;
  currentPrice: number;
  marketValue: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  totalDividendsReceived: number;
}

export interface PortfolioMetrics {
  totalInvested: number;
  totalWithdrawn: number;
  netCashFlow: number;
  currentValue: number;
  totalDividends: number;
  totalFees: number;
  xirr: number | null;
  xirrPercent: number | null;
}
