import type { AppState } from '../state';
import { formatCurrency, formatPercent, formatDateShort, getPeriodStartDate } from '../calculations';

export function renderHoldings(state: AppState): string {
  if (state.holdings.length === 0) return '';

  const allocationColors = ['#5a9a6e', '#da7756', '#4a90d9', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c', '#34495e'];
  const totalMVH = state.holdings.reduce((s, x) => s + x.marketValue, 0) || 1;

  const sortLabels: Record<string, string> = { value: 'Verdi', gain: 'Avkastning', name: 'Navn' };
  const sortedHoldings = [...state.holdings].sort((a, b) => {
    if (state.holdingSort === 'gain') return b.unrealizedGainPercent - a.unrealizedGainPercent;
    if (state.holdingSort === 'name') return a.name.localeCompare(b.name);
    return b.marketValue - a.marketValue;
  });

  return '<div class="card-header"><h2>Beholdning</h2><button class="btn btn-small btn-ghost" id="sort-holdings">' + sortLabels[state.holdingSort] + ' ↓</button></div>'
    + '<div class="holdings-list">'
    // Period label for display
    const periodLabels: Record<string, string> = { ytd: 'HiÅ', '1y': '1 år', '3y': '3 år', '5y': '5 år', total: '' };
    const periodLabel = periodLabels[state.selectedPeriod] || '';
    const periodStartRaw = state.selectedPeriod !== 'total' ? getPeriodStartDate(state.selectedPeriod as any) : null;
    const periodStartDate = periodStartRaw?.toISOString().split('T')[0] ?? null;

    return '<div class="card-header"><h2>Beholdning</h2><button class="btn btn-small btn-ghost" id="sort-holdings">' + sortLabels[state.holdingSort] + ' ↓</button></div>'
    + '<div class="holdings-list">'
    + sortedHoldings.map((h, hIdx) => {
      const inst = state.ledger.instruments.find(i => i.isin === h.isin);
      const isFund = inst?.instrumentType === 'FUND';
      const label = isFund ? h.name : h.ticker;
      const sublabel = isFund ? 'Fond' : h.name;
      const qty = Number.isInteger(h.quantity) ? h.quantity.toString() : h.quantity.toFixed(4);
      const priceValue = h.currentPrice > 0 ? h.currentPrice.toFixed(2) : '';
      const allocColor = allocationColors[hIdx % allocationColors.length];

      // Portfolio share
      const sharePct = (h.marketValue / totalMVH * 100).toFixed(1);

      // Period-aware gain: use portfolio history to find value at period start
      let displayGainPct = h.unrealizedGainPercent;
      let displayGainKr = h.unrealizedGain;
      if (periodStartDate && state.portfolioHistory) {
        // Find the position value at period start from portfolio history events
        // Approximate: use costBasis as reference for total, or price change for period
        const firstBuy = state.ledger.events
          .filter(e => 'isin' in e && (e as unknown as { isin: string }).isin === h.isin && e.type === 'TRADE_BUY')
          .sort((a, b) => a.date.localeCompare(b.date))[0];
        if (firstBuy && firstBuy.date <= periodStartDate) {
          // Position existed at period start — show period return (placeholder, filled async)
          // We'll use the daily change element to show period return
        }
      }

      const gainClass = displayGainKr >= 0 ? 'text-success' : 'text-danger';
      const gainLabel = periodLabel ? '<span class="holding-period-label">' + periodLabel + '</span> ' : '';

      return '<div class="holding-card" data-isin="' + h.isin + '">'
        + '<div class="holding-color" style="background:' + allocColor + '"></div>'
        + '<div class="holding-info">'
        + '<div class="holding-ticker">' + label + '</div>'
        + '<div class="holding-name">' + sublabel + '</div>'
        + '</div>'
        + '<div class="holding-values">'
        + '<div class="holding-market-value">' + formatCurrency(h.marketValue) + '</div>'
        + '<div class="holding-gain ' + gainClass + '">' + gainLabel + formatPercent(displayGainPct) + '</div>'
        + '<div class="holding-daily" id="daily-' + h.isin + '"></div>'
        + '</div></div>'
        + '<div class="holding-details" id="details-' + h.isin + '">'
        + '<div class="holding-chart-wrap" data-ticker="' + (inst?.ticker || h.ticker) + '" data-isin="' + h.isin + '" data-cost="' + h.averageCostPerShare.toFixed(2) + '">'
        + '<div class="holding-chart-info" id="hcinfo-' + h.isin + '"></div>'
        + '<div class="holding-chart-area" id="hcarea-' + h.isin + '"><div class="sparkline-placeholder">Laster graf...</div></div>'
        + '</div>'
        // Key stats — compact list layout
        + '<div class="holding-stats">'
        + '<div class="hstat"><span class="hstat-label">Kursgevinst</span><span class="hstat-val ' + gainClass + '">' + (h.unrealizedGain >= 0 ? '+' : '') + formatCurrency(h.unrealizedGain) + '</span></div>'
        + '<div class="hstat"><span class="hstat-label">Kurs</span><span class="hstat-val">' + (priceValue ? formatCurrency(h.currentPrice, 2) : '—') + ' <span class="hstat-sub">kjøpt @ ' + formatCurrency(h.averageCostPerShare, 2) + '</span></span></div>'
        + '<div class="hstat"><span class="hstat-label">Antall</span><span class="hstat-val">' + qty + '</span></div>'
        + (h.totalDividendsReceived > 0 ? '<div class="hstat"><span class="hstat-label">Utbytte mottatt</span><span class="hstat-val">+' + formatCurrency(h.totalDividendsReceived) + '</span></div>' : '')
        + '<div class="hstat"><span class="hstat-label">Andel</span><span class="hstat-val">' + sharePct + '%</span></div>'
        + '</div>'
        // Market data — collapsible
        + '<div class="detail-section">'
        + '<button class="detail-section-toggle" data-target="mdata-' + h.isin + '">Markedsdata ›</button>'
        + '<div class="detail-section-body" id="mdata-' + h.isin + '">'
        + renderMarketStats(inst?.ticker || h.ticker)
        + '</div></div>'
        // Section: Transaksjoner (collapsible)
        + '<div class="detail-section">'
        + '<button class="detail-section-toggle" data-target="txns-' + h.isin + '">Transaksjoner ›</button>'
        + '<div class="detail-section-body" id="txns-' + h.isin + '">'
        + renderHoldingTransactions(state, h.isin)
        + '</div></div>'
        + '<div class="holding-actions"><button class="btn btn-small holding-add-trade" data-isin="' + h.isin + '">+ Legg til transaksjon</button></div>'
        + '</div>';
    }).join('')
    + '</div>';
}

export function renderMarketStats(ticker: string): string {
  const safeTicker = ticker.replace(/\./g, '_');
  const isFund = ticker.includes('.IR');
  const newswebTicker = ticker.replace('.OL', '');

  if (isFund) {
    // Fund-specific stats: period returns + 52-week range
    return '<div class="market-stats" id="mstats-' + safeTicker + '">'
      + '<div class="holding-detail"><div class="label">Avkastning 1 år</div><div class="value text-muted" id="mstat-ret1y-' + safeTicker + '">...</div></div>'
      + '<div class="holding-detail"><div class="label">Avkastning 3 år</div><div class="value text-muted" id="mstat-ret3y-' + safeTicker + '">...</div></div>'
      + '<div class="holding-detail"><div class="label">Avkastning 5 år</div><div class="value text-muted" id="mstat-ret5y-' + safeTicker + '">...</div></div>'
      + '<div class="holding-detail"><div class="label">52 uker</div><div class="value text-muted" id="mstat-52w-' + safeTicker + '">...</div></div>'
      + '</div>';
  }

  // Stock stats: fundamentals + market data
  return '<div class="market-stats" id="mstats-' + safeTicker + '">'
    + '<div class="holding-detail"><div class="label">I dag</div><div class="value text-muted" id="mstat-day-' + safeTicker + '">...</div></div>'
    + '<div class="holding-detail"><div class="label">52 uker</div><div class="value text-muted" id="mstat-52w-' + safeTicker + '">...</div></div>'
    + '<div class="holding-detail"><div class="label">Volum</div><div class="value text-muted" id="mstat-vol-' + safeTicker + '">...</div></div>'
    + '<div class="holding-detail"><div class="label">P/E</div><div class="value text-muted" id="mstat-pe-' + safeTicker + '">...</div></div>'
    + '<div class="holding-detail"><div class="label">P/B</div><div class="value text-muted" id="mstat-pb-' + safeTicker + '">...</div></div>'
    + '<div class="holding-detail"><div class="label">Markedsverdi</div><div class="value text-muted" id="mstat-mcap-' + safeTicker + '">...</div></div>'
    + '<div class="holding-detail"><div class="label">Utbytterate</div><div class="value text-muted" id="mstat-divy-' + safeTicker + '">...</div></div>'
    + '<div class="holding-detail"><div class="label">Margin</div><div class="value text-muted" id="mstat-margin-' + safeTicker + '">...</div></div>'
    + '<div class="market-stats-link"><a href="https://newsweb.oslobors.no/search?issuer=' + newswebTicker + '" target="_blank" rel="noopener">Se børsmeldinger ›</a></div>'
    + '</div>';
}

export function renderHoldingTransactions(state: AppState, isin: string): string {
  const events = state.ledger.events
    .filter(e => 'isin' in e && (e as unknown as { isin: string }).isin === isin)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (events.length === 0) return '';
  const typeLabels: Record<string, string> = {
    'TRADE_BUY': 'Kjøp', 'TRADE_SELL': 'Salg', 'DIVIDEND': 'Utbytte'
  };
  const rows = events.map(e => {
    const label = typeLabels[e.type] || e.type;
    const te = e as unknown as { quantity?: number; pricePerShare?: number };
    const detail = te.quantity && te.pricePerShare
      ? ' · ' + te.quantity + ' × ' + te.pricePerShare.toFixed(2)
      : '';
    return '<div class="txn-row">'
      + '<div class="txn-main">'
      + '<span class="txn-date">' + formatDateShort(e.date) + '</span>'
      + '<span class="txn-type txn-type-' + e.type.toLowerCase() + '">' + label + '</span>'
      + '<span class="txn-detail">' + detail + '</span>'
      + '</div>'
      + '<div class="txn-right">'
      + '<span class="txn-amount">' + formatCurrency(e.amount) + '</span>'
      + '<button class="txn-edit" data-event-id="' + e.id + '" title="Rediger">✎</button>'
      + '<button class="txn-delete" data-event-id="' + e.id + '" title="Slett">×</button>'
      + '</div>'
      + '</div>';
  }).join('');
  return '<div class="holding-transactions">'
    + '<div class="txn-header">Transaksjoner</div>'
    + rows + '</div>';
}

export function renderWarnings(state: AppState): string {
  const warnings = state.ledger.warnings.filter(w => w.severity !== 'INFO');
  if (warnings.length === 0) return '';
  return '<div class="card warning-card"><h3>Datakvalitetsadvarsler</h3><ul>'
    + warnings.map(w => '<li>' + w.message + '</li>').join('') + '</ul></div>';
}
