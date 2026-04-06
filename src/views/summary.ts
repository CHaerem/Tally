import type { AppState } from '../state';
import { formatCurrency, getPeriodStartDate } from '../calculations';
import type { ReturnPeriod } from '../calculations';

export function renderSummary(state: AppState): string {
  if (!state.metrics) return '';

  const m = state.metrics;
  const unrealizedGain = state.holdings.reduce((sum, h) => sum + h.unrealizedGain, 0);
  const totalReturn = unrealizedGain + m.totalDividends;
  const totalReturnClass = totalReturn >= 0 ? 'text-success' : 'text-danger';

  // Period selector for chart
  const firstEventDate = state.ledger.events.length > 0
    ? state.ledger.events.reduce((min, e) => e.date < min ? e.date : min, state.ledger.events[0].date)
    : null;

  const periods: Array<{ key: ReturnPeriod; label: string }> = [
    { key: 'ytd', label: 'HiÅ' },
    { key: '1y', label: '1 år' },
    { key: '3y', label: '3 år' },
    { key: '5y', label: '5 år' },
    { key: 'total', label: 'Total' },
  ];

  const availablePeriods = periods.filter(p => {
    if (p.key === 'total') return true;
    if (!firstEventDate) return false;
    const start = getPeriodStartDate(p.key);
    return start !== null && firstEventDate <= start.toISOString().slice(0, 10);
  });

  const periodPills = availablePeriods.length > 1
    ? '<div class="period-selector">' + availablePeriods.map(p =>
        '<button class="period-pill' + (p.key === state.selectedPeriod ? ' active' : '') + '" data-period="' + p.key + '">' + p.label + '</button>'
      ).join('') + '</div>'
    : '';

  // Calculate invested from trades (buy - sell) if no CASH_IN events
  const totalCostBasis = state.holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const invested = m.netCashFlow > 0 ? m.netCashFlow : totalCostBasis;

  // Allocation bar
  const totalMV = m.currentValue || 1;
  const allocationColors = ['#5a9a6e', '#da7756', '#4a90d9', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c', '#34495e'];
  const allocationItems = state.holdings
    .map((h, i) => {
      const inst = state.ledger.instruments.find(ii => ii.isin === h.isin);
      const label = inst?.instrumentType === 'FUND' ? h.name : h.ticker;
      const pct = (h.marketValue / totalMV) * 100;
      return { label, pct, color: allocationColors[i % allocationColors.length] };
    })
    .sort((a, b) => b.pct - a.pct);

  const allocationBar = allocationItems
    .map(a => '<div class="alloc-segment" style="width:' + a.pct.toFixed(1) + '%;background:' + a.color + '" title="' + a.label + ' ' + a.pct.toFixed(1) + '%"></div>')
    .join('');

  const totalReturnPct = invested > 0 ? (totalReturn / invested * 100) : 0;
  const totalReturnPctSign = totalReturnPct >= 0 ? '+' : '';

  return '<div class="card">'
    + '<div class="summary-hero">'
    + '<div class="label">Markedsverdi</div>'
    + '<div class="value">' + formatCurrency(m.currentValue) + '</div>'
    + periodPills
    + '</div>'
    + '<div id="portfolio-chart-container" class="portfolio-chart-container"><div class="chart-placeholder">Laster graf...</div></div>'
    + '<div id="portfolio-dividend-list"></div>'
    // Compact breakdown
    + '<div class="return-breakdown">'
    + '<div class="breakdown-row"><span class="breakdown-label">Investert</span><span class="breakdown-val">' + formatCurrency(invested) + '</span></div>'
    + '<div class="breakdown-row breakdown-total"><span class="breakdown-label">Avkastning' + (m.totalDividends > 0 ? ' (inkl. utbytte)' : '') + '</span><span class="breakdown-val ' + totalReturnClass + '">' + (totalReturn >= 0 ? '+' : '') + formatCurrency(totalReturn) + ' (' + totalReturnPctSign + totalReturnPct.toFixed(1) + '%)</span></div>'
    + '</div>'
    // Allocation bar with inline labels
    + (allocationItems.length >= 2
      ? '<div class="alloc-compact"><div class="alloc-bar">' + allocationBar + '</div>'
        + '<div class="alloc-inline-labels">' + allocationItems.map(a =>
          '<span><span class="alloc-dot" style="background:' + a.color + '"></span>' + a.label + ' ' + a.pct.toFixed(0) + '%</span>'
        ).join('') + '</div></div>'
      : '')
    + '</div>';
}
