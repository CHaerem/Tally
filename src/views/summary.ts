import type { AppState } from '../state';
import { formatCurrency, formatPercent, getPeriodStartDate } from '../calculations';
import type { ReturnPeriod } from '../calculations';

export function renderSummary(state: AppState): string {
  if (!state.metrics) return '';

  const m = state.metrics;
  const unrealizedGain = state.holdings.reduce((sum, h) => sum + h.unrealizedGain, 0);
  const totalReturn = unrealizedGain + m.totalDividends;
  // totalReturnClass/totalReturnPctSign removed — hero uses period-aware values

  // Invested (costBasis includes fees)
  const totalCostBasis = state.holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const invested = m.netCashFlow > 0 ? m.netCashFlow : totalCostBasis;
  const totalReturnPct = invested > 0 ? (totalReturn / invested * 100) : 0;

  // Period-specific return from portfolio history
  let heroReturnKr = totalReturn;
  let heroReturnPct = totalReturnPct;
  if (state.selectedPeriod !== 'total' && state.portfolioHistory) {
    const start = getPeriodStartDate(state.selectedPeriod as any);
    if (start) {
      const startDate = start.toISOString().split('T')[0];
      const series = state.portfolioHistory.series;
      const startPoint = series.find(s => s.date >= startDate);
      const endPoint = series[series.length - 1];
      if (startPoint && endPoint && startPoint.value > 0) {
        heroReturnKr = endPoint.value - startPoint.value;
        heroReturnPct = (heroReturnKr / startPoint.value) * 100;
      }
    }
  }
  const heroReturnClass = heroReturnKr >= 0 ? 'text-success' : 'text-danger';
  const heroReturnSign = heroReturnPct >= 0 ? '+' : '';

  // Best and worst performers (by unrealized gain %)
  const sorted = [...state.holdings].sort((a, b) => b.unrealizedGainPercent - a.unrealizedGainPercent);
  const performers = sorted.length >= 2 ? sorted.map(h => {
    const inst = state.ledger.instruments.find(i => i.isin === h.isin);
    const label = inst?.instrumentType === 'FUND' ? h.name : h.ticker;
    const cls = h.unrealizedGainPercent >= 0 ? 'text-success' : 'text-danger';
    return '<span class="performer"><span class="performer-name">' + label + '</span> <span class="' + cls + '">' + formatPercent(h.unrealizedGainPercent) + '</span></span>';
  }).join('') : '';

  // After-tax dividend (37.84% for 2025)
  const TAX_RATE = 0.3784;
  const dividendAfterTax = m.totalDividends > 0 ? m.totalDividends * (1 - TAX_RATE) : 0;

  // Allocation
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
    .map(a => '<div class="alloc-segment" style="width:' + a.pct.toFixed(1) + '%;background:' + a.color + '"></div>')
    .join('');

  // Period tabs
  const firstEventDate = state.ledger.events.length > 0
    ? state.ledger.events.reduce((min, e) => e.date < min ? e.date : min, state.ledger.events[0].date)
    : null;
  const periods: Array<{ key: ReturnPeriod; label: string }> = [
    { key: 'ytd', label: 'HiÅ' },
    { key: '1y', label: '1 år' },
    { key: '3y', label: '3 år' },
    { key: '5y', label: '5 år' },
    { key: 'total', label: 'Totalt' },
  ];
  const availablePeriods = periods.filter(p => {
    if (p.key === 'total') return true;
    if (!firstEventDate) return false;
    const start = getPeriodStartDate(p.key);
    return start !== null && firstEventDate <= start.toISOString().slice(0, 10);
  });
  const periodTabs = availablePeriods.length > 1
    ? '<div class="period-tabs">' + availablePeriods.map(p =>
        '<button class="period-tab' + (p.key === state.selectedPeriod ? ' active' : '') + '" data-period="' + p.key + '">' + p.label + '</button>'
      ).join('') + '</div>'
    : '';

  return '<div class="card">'
    + '<div class="summary-hero">'
    + '<div class="label">Markedsverdi</div>'
    + '<div class="value">' + formatCurrency(m.currentValue) + '</div>'
    + '<div class="hero-return ' + heroReturnClass + '">' + (heroReturnKr >= 0 ? '+' : '') + formatCurrency(heroReturnKr) + ' (' + heroReturnSign + heroReturnPct.toFixed(1) + '%)</div>'
    + '</div>'
    + '<div id="portfolio-chart-container" class="portfolio-chart-container"><div class="chart-placeholder">Laster graf...</div></div>'
    + periodTabs
    + '<div id="portfolio-dividend-list"></div>'
    // Breakdown — explicit labels for each type
    + '<div class="return-breakdown">'
    + '<div class="breakdown-row"><span class="breakdown-label">Investert</span><span class="breakdown-val">' + formatCurrency(invested) + '</span></div>'
    + '<div class="breakdown-row"><span class="breakdown-label">Kursgevinst</span><span class="breakdown-val ' + (unrealizedGain >= 0 ? 'text-success' : 'text-danger') + '">' + (unrealizedGain >= 0 ? '+' : '') + formatCurrency(unrealizedGain) + '</span></div>'
    + (m.totalDividends > 0
      ? '<div class="breakdown-row"><span class="breakdown-label">Utbytte mottatt</span><span class="breakdown-val text-success">+' + formatCurrency(m.totalDividends) + '</span></div>'
        + '<div class="breakdown-row"><span class="breakdown-label breakdown-sub">Etter skatt (~' + (TAX_RATE * 100).toFixed(0) + '%)</span><span class="breakdown-val breakdown-sub">+' + formatCurrency(dividendAfterTax) + '</span></div>'
        + '<div class="breakdown-row breakdown-total"><span class="breakdown-label">Totalavkastning</span><span class="breakdown-val ' + (totalReturn >= 0 ? 'text-success' : 'text-danger') + '">' + (totalReturn >= 0 ? '+' : '') + formatCurrency(totalReturn) + '</span></div>'
      : '')
    + '</div>'
    // Performers
    + (performers ? '<div class="performers-row">' + performers + '</div>' : '')
    // Allocation
    + (allocationItems.length >= 2
      ? '<div class="alloc-compact"><div class="alloc-bar">' + allocationBar + '</div>'
        + '<div class="alloc-inline-labels">' + allocationItems.map(a =>
          '<span><span class="alloc-dot" style="background:' + a.color + '"></span>' + a.label + ' ' + a.pct.toFixed(0) + '%</span>'
        ).join('') + '</div></div>'
      : '')
    + '</div>';
}
