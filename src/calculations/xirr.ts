import type { CashFlow } from '../types';

const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-7;
const DAYS_IN_YEAR = 365.25;

export function calculateXIRR(cashFlows: CashFlow[], guess: number = 0.1): number | null {
  if (cashFlows.length < 2) return null;
  
  const hasNegative = cashFlows.some(cf => cf.amount < 0);
  const hasPositive = cashFlows.some(cf => cf.amount > 0);
  if (!hasNegative || !hasPositive) return null;

  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstDate = sorted[0].date;

  const yearFractions = sorted.map(cf => ({
    amount: cf.amount,
    years: (cf.date.getTime() - firstDate.getTime()) / (DAYS_IN_YEAR * 24 * 60 * 60 * 1000),
  }));

  let rate = guess;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let npv = 0;
    let derivative = 0;

    for (const cf of yearFractions) {
      const discountFactor = Math.pow(1 + rate, cf.years);
      npv += cf.amount / discountFactor;
      derivative -= (cf.years * cf.amount) / (discountFactor * (1 + rate));
    }

    if (Math.abs(npv) < TOLERANCE) return rate;
    if (Math.abs(derivative) < TOLERANCE) {
      rate = rate + 0.1;
      continue;
    }

    const newRate = rate - npv / derivative;
    if (Math.abs(newRate - rate) < TOLERANCE) return newRate;

    if (newRate < -0.99) rate = -0.99;
    else if (newRate > 10) rate = 10;
    else rate = newRate;
  }

  return null;
}

export function formatXIRRPercent(xirr: number | null): string {
  if (xirr === null) return 'N/A';
  const percent = xirr * 100;
  const sign = percent >= 0 ? '+' : '';
  return sign + percent.toFixed(2) + '%';
}
