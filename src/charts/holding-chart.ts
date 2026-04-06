import type { AppState } from '../state';
import { formatCurrency, formatDateShort } from '../calculations';
import { fetchPriceHistory } from '../api';

export function renderHoldingChart(
  state: AppState,
  isin: string,
  _ticker: string,
  prices: Array<{ date: string; close: number }>,
  _avgCost: number
): void {
  const area = document.getElementById('hcarea-' + isin);
  const infoEl = document.getElementById('hcinfo-' + isin);
  if (!area) return;

  const allPrices = prices;

  // Get events for this holding, sorted by date
  const holdingEvents = state.ledger.events
    .filter(e => 'isin' in e && (e as unknown as { isin: string }).isin === isin)
    .sort((a, b) => a.date.localeCompare(b.date));

  const firstBuyDate = holdingEvents.find(e => e.type === 'TRADE_BUY')?.date;
  if (!firstBuyDate) return;

  // Build position value over time
  const data: Array<{ date: string; value: number; price: number; qty: number; invested: number }> = [];
  let qty = 0;
  let totalInvested = 0;
  let eventIdx = 0;

  for (const p of allPrices) {
    if (p.date < firstBuyDate) continue;

    while (eventIdx < holdingEvents.length && holdingEvents[eventIdx].date <= p.date) {
      const ev = holdingEvents[eventIdx];
      const te = ev as unknown as { quantity?: number };
      if (ev.type === 'TRADE_BUY' && te.quantity) {
        qty += te.quantity;
        totalInvested += ev.amount;
      } else if (ev.type === 'TRADE_SELL' && te.quantity) {
        qty -= te.quantity;
        totalInvested -= ev.amount;
      }
      eventIdx++;
    }

    if (qty > 0) {
      data.push({ date: p.date, value: qty * p.close, price: p.close, qty, invested: totalInvested });
    }
  }

  if (data.length < 2) return;

  const firstValue = data[0].invested;
  const lastValue = data[data.length - 1].value;
  const gain = lastValue - firstValue;
  const isPositive = gain >= 0;
  const color = isPositive ? '#3d8b37' : '#c0392b';
  const returnPct = firstValue > 0 ? (gain / firstValue * 100) : 0;

  area.innerHTML = '<canvas id="hcanvas-' + isin + '"></canvas>'
    + '<div class="chart-crosshair" id="hcross-' + isin + '"></div>';

  if (infoEl) {
    const sign = returnPct >= 0 ? '+' : '';
    infoEl.innerHTML = '<span class="chart-return ' + (isPositive ? 'text-success' : 'text-danger') + '">'
      + sign + returnPct.toFixed(1) + '% siden kjøp ' + formatDateShort(firstBuyDate) + '</span>';
  }

  const canvas = document.getElementById('hcanvas-' + isin) as HTMLCanvasElement;
  if (!canvas) return;

  const rect = area.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  const w = rect.width, h = rect.height;
  const pad = { top: 10, bottom: 10, left: 0, right: 0 };
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

  const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.value) }));
  const tension = 0.3;
  const drawSmooth = (close: boolean) => {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      ctx.bezierCurveTo(
        p1.x + (p2.x - p0.x) * tension, p1.y + (p2.y - p0.y) * tension,
        p2.x - (p3.x - p1.x) * tension, p2.y - (p3.y - p1.y) * tension,
        p2.x, p2.y
      );
    }
    if (close) { ctx.lineTo(pts[pts.length - 1].x, h); ctx.lineTo(pts[0].x, h); ctx.closePath(); }
  };

  // Gradient fill
  const grad = ctx.createLinearGradient(0, toY(maxVal), 0, h);
  grad.addColorStop(0, color + '30');
  grad.addColorStop(0.6, color + '12');
  grad.addColorStop(1, color + '02');
  ctx.beginPath(); drawSmooth(true); ctx.fillStyle = grad; ctx.fill();

  // Invested amount line (dashed)
  const currentInvested = data[data.length - 1].invested;
  if (currentInvested > 0 && currentInvested >= rangeMin && currentInvested <= rangeMax) {
    const costY = toY(currentInvested);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, costY);
    ctx.lineTo(w, costY);
    ctx.strokeStyle = '#9c959088';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Smooth line
  ctx.beginPath(); drawSmooth(false);
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();

  // End dot
  const last = pts[pts.length - 1];
  ctx.beginPath(); ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.beginPath(); ctx.arc(last.x, last.y, 1.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();

  // Event markers
  for (const ev of holdingEvents) {
    const idx = data.findIndex(d => d.date >= ev.date);
    if (idx < 0) continue;
    const dotColor = ev.type === 'TRADE_BUY' ? '#5a9a6e' : ev.type === 'TRADE_SELL' ? '#c75450' : '#da7756';
    const x = pts[idx].x, y = pts[idx].y;
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = dotColor; ctx.fill();
  }

  // Touch interaction
  const crosshair = document.getElementById('hcross-' + isin);
  const defaultInfo = infoEl?.innerHTML || '';

  const handleMove = (clientX: number) => {
    const r = area.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - r.left, r.width));
    const idx = Math.round((x / r.width) * (data.length - 1));
    const point = data[Math.max(0, Math.min(idx, data.length - 1))];

    if (crosshair) { crosshair.style.left = x + 'px'; crosshair.style.display = 'block'; }

    const pointGain = point.value - point.invested;
    const pointPct = point.invested > 0 ? (pointGain / point.invested * 100) : 0;
    const pctSign = pointPct >= 0 ? '+' : '';
    const pctClass = pointPct >= 0 ? 'text-success' : 'text-danger';

    if (infoEl) {
      infoEl.innerHTML = '<span class="scrub-date">' + formatDateShort(point.date) + '</span>'
        + '<span class="scrub-value">' + formatCurrency(point.value) + '</span>'
        + '<span class="' + pctClass + '">' + pctSign + pointPct.toFixed(1) + '%</span>';
    }
  };

  const handleEnd = () => {
    if (crosshair) crosshair.style.display = 'none';
    if (infoEl) infoEl.innerHTML = defaultInfo;
  };

  area.addEventListener('touchstart', (e) => { e.preventDefault(); handleMove(e.touches[0].clientX); }, { passive: false });
  area.addEventListener('touchmove', (e) => { e.preventDefault(); handleMove(e.touches[0].clientX); }, { passive: false });
  area.addEventListener('touchend', handleEnd);
  area.addEventListener('mousemove', (e) => handleMove(e.clientX));
  area.addEventListener('mouseleave', handleEnd);
}

export function loadStockDetailChart(ticker: string, safeTicker: string): void {
  const chartArea = document.getElementById('sdchart-' + safeTicker);
  const infoEl = document.getElementById('sdinfo-' + safeTicker);
  if (!chartArea) return;

  fetchPriceHistory(ticker).then(prices => {
    if (prices.length < 2) {
      chartArea.innerHTML = '<span class="text-muted text-small">Ingen prishistorikk</span>';
      return;
    }

    const data = prices;
    const first = data[0].close, last = data[data.length - 1].close;
    const isPos = last >= first;
    const color = isPos ? '#3d8b37' : '#c0392b';
    const pct = first > 0 ? ((last - first) / first * 100) : 0;
    const sign = pct >= 0 ? '+' : '';

    if (infoEl) {
      infoEl.innerHTML = '<span class="' + (isPos ? 'text-success' : 'text-danger') + '">' + sign + pct.toFixed(1) + '% siden ' + formatDateShort(data[0].date) + '</span>';
    }

    chartArea.innerHTML = '<canvas id="sdcanvas-' + safeTicker + '"></canvas>'
      + '<div class="chart-crosshair" id="sdcross-' + safeTicker + '"></div>';

    const canvas = document.getElementById('sdcanvas-' + safeTicker) as HTMLCanvasElement;
    if (!canvas) return;

    const rect = chartArea.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const w = rect.width, h = rect.height;
    const closes = data.map(d => d.close);
    const minV = Math.min(...closes), maxV = Math.max(...closes);
    const valPad = (maxV - minV) * 0.08 || 1;
    const rMin = minV - valPad, range = (maxV + valPad) - rMin;
    const toX = (i: number) => (i / (data.length - 1)) * w;
    const toY = (v: number) => 8 + (1 - (v - rMin) / range) * (h - 16);

    const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.close) }));
    const tension = 0.3;
    const drawSmooth = (close: boolean) => {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        ctx.bezierCurveTo(p1.x + (p2.x - p0.x) * tension, p1.y + (p2.y - p0.y) * tension, p2.x - (p3.x - p1.x) * tension, p2.y - (p3.y - p1.y) * tension, p2.x, p2.y);
      }
      if (close) { ctx.lineTo(pts[pts.length - 1].x, h); ctx.lineTo(pts[0].x, h); ctx.closePath(); }
    };

    const grad = ctx.createLinearGradient(0, toY(maxV), 0, h);
    grad.addColorStop(0, color + '25'); grad.addColorStop(1, color + '02');
    ctx.beginPath(); drawSmooth(true); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); drawSmooth(false); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    const lp = pts[pts.length - 1];
    ctx.beginPath(); ctx.arc(lp.x, lp.y, 3, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.beginPath(); ctx.arc(lp.x, lp.y, 1.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();

    // Touch interaction
    const crosshair = document.getElementById('sdcross-' + safeTicker);
    const defaultInfo = infoEl?.innerHTML || '';
    const handleMove = (clientX: number) => {
      const r = chartArea.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - r.left, r.width));
      const idx = Math.round((x / r.width) * (data.length - 1));
      const point = data[Math.max(0, Math.min(idx, data.length - 1))];
      if (crosshair) { crosshair.style.left = x + 'px'; crosshair.style.display = 'block'; }
      if (infoEl) {
        infoEl.innerHTML = '<span class="scrub-date">' + formatDateShort(point.date) + '</span>'
          + '<span class="scrub-value">' + formatCurrency(point.close, 2) + '</span>';
      }
    };
    const handleEnd = () => {
      if (crosshair) crosshair.style.display = 'none';
      if (infoEl) infoEl.innerHTML = defaultInfo;
    };
    chartArea.addEventListener('touchstart', (e) => { e.preventDefault(); handleMove(e.touches[0].clientX); }, { passive: false });
    chartArea.addEventListener('touchmove', (e) => { e.preventDefault(); handleMove(e.touches[0].clientX); }, { passive: false });
    chartArea.addEventListener('touchend', handleEnd);
    chartArea.addEventListener('mousemove', (e) => handleMove(e.clientX));
    chartArea.addEventListener('mouseleave', handleEnd);
  });
}
