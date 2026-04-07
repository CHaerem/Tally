import type { AppState } from '../state';
import { formatCurrency, formatDateShort, getPeriodStartDate } from '../calculations';

function filterByPeriod(series: Array<{ date: string; value: number; costBasis: number }>, period: string): Array<{ date: string; value: number; costBasis: number }> {
  if (period === 'total') return series;
  const start = getPeriodStartDate(period as any);
  if (!start) return series;
  const startDate = start.toISOString().split('T')[0];
  const filtered = series.filter(s => s.date >= startDate);
  return filtered.length >= 2 ? filtered : series;
}

export function renderPortfolioChartSVG(state: AppState): string {
  if (!state.portfolioHistory || state.portfolioHistory.series.length < 2) return '';
  const data = filterByPeriod(state.portfolioHistory.series, state.selectedPeriod);

  const firstVal = data[0].value;
  const lastVal = data[data.length - 1].value;
  const isPositive = lastVal >= firstVal;
  const color = isPositive ? '#3d8b37' : '#c0392b';
  const returnPct = firstVal > 0 ? ((lastVal - firstVal) / firstVal * 100) : 0;
  const returnSign = returnPct >= 0 ? '+' : '';

  // Build legend from actual events
  const events = state.portfolioHistory.events;
  const hasBuy = events.some(e => e.type === 'TRADE_BUY');
  const hasSell = events.some(e => e.type === 'TRADE_SELL');
  const hasDiv = events.some(e => e.type === 'DIVIDEND');
  const legendParts: string[] = [];
  if (hasBuy) legendParts.push('<span class="legend-dot legend-buy"></span>Kjøp');
  if (hasSell) legendParts.push('<span class="legend-dot legend-sell"></span>Salg');
  if (hasDiv) legendParts.push('<span class="legend-dot legend-div"></span>Utbytte');
  const legend = legendParts.length > 0 ? '<span class="chart-legend-inline">' + legendParts.join(' ') + '</span>' : '';

  return '<div class="portfolio-chart-wrap">'
    + '<div class="chart-area" id="chart-area" data-color="' + color + '">'
    + '<canvas id="portfolio-canvas" width="600" height="200"></canvas>'
    + '<div class="chart-crosshair" id="chart-crosshair"></div>'
    + '</div>'
    + '<div class="chart-scrubber" id="chart-scrubber">'
    + '<span class="chart-return ' + (isPositive ? 'text-success' : 'text-danger') + '" id="chart-scrubber-text">' + returnSign + returnPct.toFixed(1) + '% total</span>'
    + '</div>'
    + '<div class="chart-dates"><span>' + formatDateShort(data[0].date) + '</span>'
    + legend
    + '<span>' + formatDateShort(data[data.length - 1].date) + '</span></div>'
    + '</div>';
}

export function drawPortfolioChart(state: AppState): void {
  const canvas = document.getElementById('portfolio-canvas') as HTMLCanvasElement | null;
  const chartArea = document.getElementById('chart-area') as HTMLElement | null;
  if (!canvas || !chartArea || !state.portfolioHistory) return;

  const data = filterByPeriod(state.portfolioHistory.series, state.selectedPeriod);
  const events = state.portfolioHistory.events;
  if (data.length < 2) return;

  const rect = canvas.parentElement!.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const pad = { top: 12, bottom: 24, left: 0, right: 0 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valPad = (maxVal - minVal) * 0.08 || 1;
  const rangeMin = minVal - valPad;
  const rangeMax = maxVal + valPad;
  const range = rangeMax - rangeMin;

  const toX = (i: number) => pad.left + (i / (data.length - 1)) * cw;
  const toY = (v: number) => pad.top + (1 - (v - rangeMin) / range) * ch;

  const color = chartArea.dataset.color || '#3d8b37';

  // Smooth gradient fill
  const grad = ctx.createLinearGradient(0, toY(maxVal), 0, h);
  grad.addColorStop(0, color + '30');
  grad.addColorStop(0.6, color + '12');
  grad.addColorStop(1, color + '02');

  // Build smooth curve using cardinal spline
  const pts: Array<{ x: number; y: number }> = data.map((d, i) => ({ x: toX(i), y: toY(d.value) }));
  const tension = 0.3;
  const drawSmoothLine = (close: boolean) => {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    if (close) {
      ctx.lineTo(pts[pts.length - 1].x, h);
      ctx.lineTo(pts[0].x, h);
      ctx.closePath();
    }
  };

  // Fill area
  ctx.beginPath();
  drawSmoothLine(true);
  ctx.fillStyle = grad;
  ctx.fill();

  // Smooth line
  ctx.beginPath();
  drawSmoothLine(false);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Current value dot at end of line
  const lastPt = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(lastPt.x, lastPt.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lastPt.x, lastPt.y, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Event markers
  for (const ev of events) {
    const idx = data.findIndex(d => d.date >= ev.date);
    if (idx < 0) continue;
    const x = pts[idx].x, y = pts[idx].y;
    const dotColor = ev.type === 'TRADE_BUY' ? '#5a9a6e'
      : ev.type === 'TRADE_SELL' ? '#c75450' : '#da7756';
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
  }

  // Date labels along bottom
  drawDateTicks(ctx, data, toX, h, w);
}

function drawDateTicks(
  ctx: CanvasRenderingContext2D,
  data: Array<{ date: string }>,
  toX: (i: number) => number,
  h: number,
  w: number
): void {
  if (data.length < 2) return;

  // Pick ~3-5 evenly spaced dates
  const tickCount = Math.min(5, Math.max(3, Math.floor(w / 80)));
  const step = Math.floor(data.length / (tickCount - 1));

  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#9c9590';
  ctx.textBaseline = 'bottom';

  for (let t = 0; t < tickCount; t++) {
    const idx = t === tickCount - 1 ? data.length - 1 : t * step;
    const x = toX(idx);
    const date = data[idx].date;
    // Format as "jan 25" or "mar 26"
    const d = new Date(date);
    const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
    const label = months[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);

    const align = t === 0 ? 'left' : t === tickCount - 1 ? 'right' : 'center';
    ctx.textAlign = align as CanvasTextAlign;
    ctx.fillText(label, x, h - 2);
  }
}

export function attachChartInteraction(state: AppState): void {
  const chartArea = document.getElementById('chart-area');
  const crosshair = document.getElementById('chart-crosshair');
  const scrubber = document.getElementById('chart-scrubber-text');
  if (!chartArea || !crosshair || !scrubber || !state.portfolioHistory) return;

  const data = filterByPeriod(state.portfolioHistory.series, state.selectedPeriod);
  if (data.length < 2) return;

  const defaultText = scrubber.innerHTML;

  const handleMove = (clientX: number) => {
    const rect = chartArea.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const idx = Math.round((x / rect.width) * (data.length - 1));
    const point = data[Math.max(0, Math.min(idx, data.length - 1))];

    crosshair.style.left = x + 'px';
    crosshair.style.display = 'block';

    const returnPct = point.costBasis > 0 ? ((point.value - point.costBasis) / point.costBasis * 100) : 0;
    const returnSign = returnPct >= 0 ? '+' : '';
    const pctClass = returnPct >= 0 ? 'text-success' : 'text-danger';

    scrubber.className = 'chart-scrubber-active';
    scrubber.innerHTML = '<span class="scrub-date">' + formatDateShort(point.date) + '</span>'
      + '<span class="scrub-value">' + formatCurrency(point.value) + '</span>'
      + '<span class="' + pctClass + '">' + returnSign + returnPct.toFixed(1) + '%</span>';
  };

  const handleEnd = () => {
    crosshair.style.display = 'none';
    scrubber.className = data[data.length - 1].value >= data[0].value ? 'text-success' : 'text-danger';
    scrubber.innerHTML = defaultText;
  };

  chartArea.addEventListener('touchstart', (e) => { e.preventDefault(); handleMove(e.touches[0].clientX); }, { passive: false });
  chartArea.addEventListener('touchmove', (e) => { e.preventDefault(); handleMove(e.touches[0].clientX); }, { passive: false });
  chartArea.addEventListener('touchend', handleEnd);
  chartArea.addEventListener('mousemove', (e) => handleMove(e.clientX));
  chartArea.addEventListener('mouseleave', handleEnd);
}
