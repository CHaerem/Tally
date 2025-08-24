import { Stock, Portfolio, PortfolioSummary } from './types';

export class PortfolioCalculator {
  static calculateSummary(portfolio: Portfolio): PortfolioSummary {
    let totalInvested = 0;
    let currentValue = 0;
    let totalDividends = 0;

    for (const stock of portfolio.stocks) {
      const invested = stock.shares * stock.purchasePrice;
      totalInvested += invested;

      if (stock.currentPrice) {
        currentValue += stock.shares * stock.currentPrice;
      } else {
        currentValue += invested;
      }

      if (stock.dividends && stock.dividends.length > 0) {
        const stockDividends = stock.dividends.reduce((sum, div) => sum + (div.perShare * stock.shares), 0);
        totalDividends += stockDividends;
      }
    }

    const unrealizedGain = currentValue - totalInvested;
    const unrealizedGainPercent = totalInvested > 0 ? (unrealizedGain / totalInvested) * 100 : 0;
    
    const totalReturn = unrealizedGain + totalDividends;
    const totalReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

    return {
      totalInvested,
      currentValue,
      totalDividends,
      totalReturn,
      totalReturnPercent,
      unrealizedGain,
      unrealizedGainPercent
    };
  }

  static calculateStockReturn(stock: Stock): {
    invested: number;
    currentValue: number;
    dividends: number;
    totalReturn: number;
    totalReturnPercent: number;
  } {
    const invested = stock.shares * stock.purchasePrice;
    const currentValue = stock.currentPrice ? stock.shares * stock.currentPrice : invested;
    const dividends = stock.dividends 
      ? stock.dividends.reduce((sum, div) => sum + (div.perShare * stock.shares), 0)
      : 0;
    
    const totalReturn = (currentValue - invested) + dividends;
    const totalReturnPercent = invested > 0 ? (totalReturn / invested) * 100 : 0;

    return {
      invested,
      currentValue,
      dividends,
      totalReturn,
      totalReturnPercent
    };
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  static formatPercent(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }
}