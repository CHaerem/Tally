import type { AppState } from '../state';
import { LedgerStorage } from '../ledger';
import { formatCurrency } from '../calculations';
import { fetchPriceForDate, fetchDividendHistory } from '../api';
import type { StockSuggestion } from '../data/funds';

export function renderTradeModal(state: AppState): string {
  const today = new Date().toISOString().split('T')[0];
  const isSimple = state.tradeModalMode === 'simple';
  const title = isSimple ? 'Legg til beholdning' : 'Registrer transaksjon';

  const typeTabs = isSimple ? '' : '<div class="trade-type-tabs">'
    + '<button class="trade-tab active" data-type="TRADE_BUY">Kjøp</button>'
    + '<button class="trade-tab" data-type="TRADE_SELL">Salg</button>'
    + '</div>';

  const dateField = '<div class="form-group"><label for="trade-date">' + (isSimple ? 'Kjøpsdato' : 'Dato') + '</label><input type="date" id="trade-date" class="form-control" value="' + today + '"></div>';
  const feeField = '<div class="form-group"><label for="trade-fee">Kurtasje (valgfritt)</label><input type="number" id="trade-fee" class="form-control" placeholder="29" step="0.01" min="0" inputmode="decimal"></div>';

  const modeToggle = isSimple
    ? '<button class="btn-link" id="toggle-trade-mode" type="button">Registrer en spesifikk transaksjon i stedet</button>'
    : '<button class="btn-link" id="toggle-trade-mode" type="button">Legg til beholdning enkelt i stedet</button>';

  return '<div class="modal" id="trade-modal"><div class="modal-content"><div class="modal-header"><h3>' + title + '</h3>'
    + (isSimple ? '<p class="text-muted text-small">Søk og velg — kurs hentes automatisk</p>' : '') + '</div>'
    + typeTabs
    + '<input type="hidden" id="trade-type" value="TRADE_BUY">'
    + '<div class="form-group"><label for="trade-ticker">Aksje eller fond</label><div class="search-wrapper"><input type="text" id="trade-ticker" class="form-control" placeholder="Søk etter aksje eller fond..." autocapitalize="characters" autocorrect="off" spellcheck="false" autocomplete="off"><div class="search-suggestions" id="search-suggestions"></div></div></div>'
    + '<input type="hidden" id="trade-name" value="">'
    + '<input type="hidden" id="trade-isin" value="">'
    + '<input type="hidden" id="trade-instrument-type" value="STOCK">'
    + dateField
    + '<div class="form-row"><div class="form-group"><label for="trade-price" id="trade-price-label">Kurs</label><input type="number" id="trade-price" class="form-control" placeholder="280,50" step="0.01" min="0" inputmode="decimal"><span class="price-date-hint" id="price-date-hint"></span></div>'
    + '<div class="form-group"><label for="trade-qty" id="trade-qty-label">Antall</label><input type="number" id="trade-qty" class="form-control" placeholder="100" step="any" min="0.001" inputmode="decimal"></div></div>'
    + '<div class="form-group"><label for="trade-total-input">Totalbeløp</label><input type="number" id="trade-total-input" class="form-control" placeholder="50 000" step="0.01" min="0" inputmode="decimal"><span class="text-muted text-small" id="trade-calc-hint"></span></div>'
    + feeField
    + '<div class="modal-footer"><button class="btn" id="cancel-trade">Avbryt</button><button class="btn btn-success" id="submit-trade">' + (isSimple ? 'Legg til' : 'Registrer') + '</button></div>'
    + '<div class="modal-mode-toggle">' + modeToggle + '</div>'
    + '</div></div>';
}

export function submitTrade(state: AppState, callbacks: {
  onRerender: () => void;
  onRefreshPrices: () => void;
  onHideTradeModal: () => void;
  onAutoRegisterDividends: (ticker: string, isin: string, date: string) => void;
}): void {
  const type = (document.getElementById('trade-type') as HTMLSelectElement).value;
  const tickerRaw = (document.getElementById('trade-ticker') as HTMLInputElement).value.trim();
  const ticker = tickerRaw.includes('.') ? tickerRaw : tickerRaw.toUpperCase();
  const name = (document.getElementById('trade-name') as HTMLInputElement).value.trim();
  const isinInput = (document.getElementById('trade-isin') as HTMLInputElement).value.trim();
  const instrumentType = ((document.getElementById('trade-instrument-type') as HTMLInputElement)?.value || 'STOCK') as 'STOCK' | 'FUND';
  const dateEl = document.getElementById('trade-date') as HTMLInputElement | null;
  const date = dateEl?.value || new Date().toISOString().split('T')[0];
  const qty = parseFloat((document.getElementById('trade-qty') as HTMLInputElement).value);
  const price = parseFloat((document.getElementById('trade-price') as HTMLInputElement).value);
  const feeEl = document.getElementById('trade-fee') as HTMLInputElement | null;
  const fee = parseFloat(feeEl?.value || '0') || 0;

  if (!ticker || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
    alert('Fyll inn ' + (instrumentType === 'FUND' ? 'fond' : 'ticker') + ', dato, antall og kurs.');
    return;
  }

  const isin = isinInput || ('MANUAL_' + ticker);
  const amount = qty * price;
  const accountId = state.ledger.accounts[0]?.id || 'default';
  const now = new Date().toISOString();

  // If editing an existing event, delete the old one first
  const submitBtn = document.getElementById('submit-trade');
  const replaceId = submitBtn?.dataset.replaceEventId;
  if (replaceId) {
    LedgerStorage.deleteEvent(replaceId);
    delete submitBtn!.dataset.replaceEventId;
  }

  // Upsert instrument
  LedgerStorage.upsertInstrument({ isin, ticker, name: name || ticker, currency: 'NOK', instrumentType });

  if (type === 'DIVIDEND') {
    const event = {
      id: 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8),
      accountId, date, type: 'DIVIDEND' as const, amount, currency: 'NOK' as const,
      createdAt: now, source: 'MANUAL' as const,
      isin, quantity: qty, perShare: price,
    };
    LedgerStorage.addEvents([event]);
  } else {
    const event = {
      id: 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8),
      accountId, date, type: type as 'TRADE_BUY' | 'TRADE_SELL', amount, currency: 'NOK' as const,
      createdAt: now, source: 'MANUAL' as const,
      isin, quantity: qty, pricePerShare: price, fee: fee > 0 ? fee : undefined,
    };
    LedgerStorage.addEvents([event]);
  }

  state.ledger = LedgerStorage.loadLedger() || state.ledger;
  callbacks.onHideTradeModal();
  callbacks.onRerender();
  callbacks.onRefreshPrices();

  // Auto-register historical dividends for buy trades
  if (type === 'TRADE_BUY') {
    callbacks.onAutoRegisterDividends(ticker, isin, date);
  }
}

export function selectStock(state: AppState, stock: StockSuggestion): void {
  const tickerInput = document.getElementById('trade-ticker') as HTMLInputElement;
  const nameInput = document.getElementById('trade-name') as HTMLInputElement;
  const suggestionsEl = document.getElementById('search-suggestions') as HTMLElement;
  const isinInput = document.getElementById('trade-isin') as HTMLInputElement;
  const instrumentTypeInput = document.getElementById('trade-instrument-type') as HTMLInputElement;

  tickerInput.value = stock.ticker;
  nameInput.value = stock.name;
  if (isinInput) isinInput.value = '';
  if (instrumentTypeInput) instrumentTypeInput.value = stock.type;

  // Adapt labels for funds
  const isFund = stock.type === 'FUND';
  const qtyLabel = document.querySelector('label[for="trade-qty"]');
  const priceLabel = document.getElementById('trade-price-label');
  if (qtyLabel) qtyLabel.textContent = isFund ? 'Antall andeler' : 'Antall aksjer';
  if (priceLabel) priceLabel.textContent = isFund ? 'NAV per andel' : 'Kurs per aksje';

  suggestionsEl.innerHTML = '';
  suggestionsEl.classList.remove('active');

  // Fetch price for the selected date (historical or current)
  updatePriceForSelectedStock(state);

  // Focus quantity field so user can continue quickly
  document.getElementById('trade-qty')?.focus();
}

export async function updatePriceForSelectedStock(state: AppState): Promise<void> {
  const tickerRaw = (document.getElementById('trade-ticker') as HTMLInputElement)?.value.trim();
  const ticker = tickerRaw.includes('.') ? tickerRaw : tickerRaw.toUpperCase();
  const date = (document.getElementById('trade-date') as HTMLInputElement)?.value;
  const priceInput = document.getElementById('trade-price') as HTMLInputElement | null;
  const tradeType = (document.getElementById('trade-type') as HTMLInputElement)?.value;
  if (!ticker || !date || !priceInput || tradeType === 'DIVIDEND') return;

  const today = new Date().toISOString().split('T')[0];
  const isToday = date === today;

  // For today's date, use the current price from stock list (already loaded)
  if (isToday) {
    const stock = state.stockList.find(s => s.ticker === ticker);
    if (stock?.currentPrice) {
      priceInput.value = stock.currentPrice.toFixed(2);
      priceInput.dispatchEvent(new Event('input'));
    }
    return;
  }

  // For historical dates, fetch from per-ticker data file
  const priceHint = document.getElementById('price-date-hint');
  if (priceHint) priceHint.textContent = 'Henter kurs...';

  const price = await fetchPriceForDate(ticker, date);
  if (price !== null) {
    priceInput.value = price.toFixed(2);
    priceInput.dispatchEvent(new Event('input'));
    if (priceHint) priceHint.textContent = 'Kurs fra ' + date;
  } else {
    if (priceHint) priceHint.textContent = 'Ingen historisk kurs funnet';
  }

  // Clear hint after a few seconds
  if (priceHint) {
    setTimeout(() => { priceHint.textContent = ''; }, 3000);
  }
}

export function updateSuggestionHighlight(state: AppState, items: NodeListOf<Element>): void {
  items.forEach((item, i) => {
    item.classList.toggle('selected', i === state.selectedSuggestionIndex);
    if (i === state.selectedSuggestionIndex) {
      (item as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  });
}

export function attachTradeModalListeners(state: AppState, callbacks: {
  onRerender: () => void;
  onRefreshPrices: () => void;
  onShowTradeModal: (mode: 'simple' | 'full', prefill?: { ticker: string; name: string; isin: string; instrumentType: 'STOCK' | 'FUND' }) => void;
  onHideTradeModal: () => void;
  onAutoRegisterDividends: (ticker: string, isin: string, date: string) => void;
}): void {
  document.getElementById('cancel-trade')?.addEventListener('click', () => callbacks.onHideTradeModal());
  document.getElementById('submit-trade')?.addEventListener('click', () => submitTrade(state, callbacks));

  // Mode toggle
  document.getElementById('toggle-trade-mode')?.addEventListener('click', () => {
    callbacks.onShowTradeModal(state.tradeModalMode === 'simple' ? 'full' : 'simple');
  });

  // Date change -> fetch historical price
  document.getElementById('trade-date')?.addEventListener('change', () => {
    updatePriceForSelectedStock(state);
  });

  // Trade type tabs
  document.querySelectorAll('.trade-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.trade-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const type = (tab as HTMLElement).dataset.type || 'TRADE_BUY';
      (document.getElementById('trade-type') as HTMLInputElement).value = type;
      const priceLabel = document.getElementById('trade-price-label');
      if (priceLabel) {
        priceLabel.textContent = type === 'DIVIDEND' ? 'Utbytte per aksje' : 'Kurs per aksje';
      }
    });
  });

  // Three-way calculation: price x qty = total (any field drives the others)
  const qtyInput = document.getElementById('trade-qty') as HTMLInputElement | null;
  const priceInput = document.getElementById('trade-price') as HTMLInputElement | null;
  const totalInput = document.getElementById('trade-total-input') as HTMLInputElement | null;
  const calcHint = document.getElementById('trade-calc-hint') as HTMLElement | null;

  const calcFrom = (source: 'price' | 'qty' | 'total') => {
    const p = parseFloat(priceInput?.value || '0');
    const q = parseFloat(qtyInput?.value || '0');
    const t = parseFloat(totalInput?.value || '0');
    const instType = (document.getElementById('trade-instrument-type') as HTMLInputElement)?.value;
    const unitLabel = instType === 'FUND' ? 'andeler' : 'aksjer';

    if (source === 'total' && t > 0) {
      if (p > 0 && qtyInput) {
        qtyInput.value = (t / p).toFixed(4).replace(/\.?0+$/, '');
        if (calcHint) calcHint.textContent = formatCurrency(t) + ' ÷ ' + formatCurrency(p, 2) + ' = ' + qtyInput.value + ' ' + unitLabel;
      } else if (q > 0 && priceInput) {
        priceInput.value = (t / q).toFixed(4).replace(/\.?0+$/, '');
        if (calcHint) calcHint.textContent = formatCurrency(t) + ' ÷ ' + q + ' ' + unitLabel + ' = ' + formatCurrency(parseFloat(priceInput.value), 2) + ' per andel';
      }
    } else if (source === 'qty' && q > 0) {
      if (p > 0 && totalInput) {
        totalInput.value = (q * p).toFixed(2);
        if (calcHint) calcHint.textContent = '';
      } else if (t > 0 && priceInput) {
        priceInput.value = (t / q).toFixed(4).replace(/\.?0+$/, '');
        if (calcHint) calcHint.textContent = formatCurrency(t) + ' ÷ ' + q + ' ' + unitLabel + ' = ' + formatCurrency(parseFloat(priceInput.value), 2) + ' per andel';
      }
    } else if (source === 'price' && p > 0) {
      if (q > 0 && totalInput) {
        totalInput.value = (q * p).toFixed(2);
        if (calcHint) calcHint.textContent = '';
      } else if (t > 0 && qtyInput) {
        qtyInput.value = (t / p).toFixed(4).replace(/\.?0+$/, '');
        if (calcHint) calcHint.textContent = formatCurrency(t) + ' ÷ ' + formatCurrency(p, 2) + ' = ' + qtyInput.value + ' ' + unitLabel;
      }
    } else {
      if (calcHint) calcHint.textContent = '';
    }
  };

  priceInput?.addEventListener('input', () => calcFrom('price'));
  qtyInput?.addEventListener('input', () => calcFrom('qty'));
  totalInput?.addEventListener('input', () => calcFrom('total'));

  // Stock search autocomplete
  const tickerInput = document.getElementById('trade-ticker') as HTMLInputElement | null;
  const suggestionsEl = document.getElementById('search-suggestions') as HTMLElement | null;
  if (tickerInput && suggestionsEl) {
    tickerInput.addEventListener('input', () => {
      // Normalize: strip diacritics for matching
      const normalize = (str: string) => str.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const query = normalize(tickerInput.value.trim());
      state.selectedSuggestionIndex = -1;
      if (query.length === 0) {
        suggestionsEl.innerHTML = '';
        suggestionsEl.classList.remove('active');
        return;
      }
      const queryWords = query.split(/\s+/).filter(w => w.length > 0);
      const fuzzyScore = (s: StockSuggestion): number => {
        const ticker = normalize(s.ticker);
        const name = normalize(s.name);
        const combined = ticker + ' ' + name;
        const allMatch = queryWords.every(w => combined.includes(w));
        if (!allMatch) return -1;
        if (ticker.startsWith(query)) return 100;
        if (ticker.includes(query)) return 90;
        if (name.startsWith(query)) return 80;
        if (name.includes(query)) return 70;
        const nameWords = name.split(/\s+/);
        const boundaryMatches = queryWords.filter(qw =>
          nameWords.some(nw => nw.startsWith(qw))
        ).length;
        return 50 + (boundaryMatches * 5);
      };
      const matches = state.stockList
        .map(s => ({ stock: s, score: fuzzyScore(s) }))
        .filter(r => r.score >= 0)
        .sort((a, b) => b.score - a.score || a.stock.name.localeCompare(b.stock.name))
        .map(r => r.stock)
        .slice(0, 8);

      if (matches.length === 0) {
        suggestionsEl.innerHTML = '<div class="suggestion-empty">Ingen treff — skriv ticker manuelt</div>';
        suggestionsEl.classList.add('active');
        return;
      }

      suggestionsEl.innerHTML = matches.map((s, i) => {
        const isFund = s.type === 'FUND';
        const badge = isFund ? '<span class="suggestion-badge">Fond</span>' : '';
        const label = isFund ? s.name : s.ticker;
        const sublabel = isFund ? '' : '<span class="suggestion-name">' + s.name + '</span>';
        return '<button class="suggestion-item' + (i === state.selectedSuggestionIndex ? ' selected' : '') + '" data-index="' + i + '" type="button">'
          + '<span class="suggestion-ticker">' + label + '</span>'
          + badge + sublabel
          + (s.currentPrice ? '<span class="suggestion-price">' + s.currentPrice.toFixed(2) + '</span>' : '')
          + '</button>';
      }).join('');
      suggestionsEl.classList.add('active');

      suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          const idx = parseInt((item as HTMLElement).dataset.index || '0');
          selectStock(state, matches[idx]);
        });
      });
    });

    tickerInput.addEventListener('keydown', (e) => {
      const items = suggestionsEl.querySelectorAll('.suggestion-item');
      if (items.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.selectedSuggestionIndex = Math.min(state.selectedSuggestionIndex + 1, items.length - 1);
        updateSuggestionHighlight(state, items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.selectedSuggestionIndex = Math.max(state.selectedSuggestionIndex - 1, 0);
        updateSuggestionHighlight(state, items);
      } else if (e.key === 'Enter' && state.selectedSuggestionIndex >= 0) {
        e.preventDefault();
        (items[state.selectedSuggestionIndex] as HTMLElement).click();
      }
    });

    document.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.search-wrapper')) {
        suggestionsEl.innerHTML = '';
        suggestionsEl.classList.remove('active');
      }
    });
  }

  // Close trade modal on backdrop
  document.getElementById('trade-modal')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'trade-modal') callbacks.onHideTradeModal();
  });
}

export function showTradeModal(state: AppState, mode: 'simple' | 'full' = 'simple', prefill?: { ticker: string; name: string; isin: string; instrumentType: 'STOCK' | 'FUND' }, attachListeners?: () => void): void {
  state.tradeModalMode = mode;
  const modal = document.getElementById('trade-modal');
  if (modal) {
    modal.outerHTML = renderTradeModal(state);
    if (attachListeners) attachListeners();
    if (prefill) {
      const tickerInput = document.getElementById('trade-ticker') as HTMLInputElement | null;
      const nameInput = document.getElementById('trade-name') as HTMLInputElement | null;
      const isinInput = document.getElementById('trade-isin') as HTMLInputElement | null;
      const instrumentTypeInput = document.getElementById('trade-instrument-type') as HTMLInputElement | null;
      if (tickerInput) { tickerInput.value = prefill.ticker; tickerInput.readOnly = true; }
      if (nameInput) nameInput.value = prefill.name;
      if (isinInput) isinInput.value = prefill.isin;
      if (instrumentTypeInput) instrumentTypeInput.value = prefill.instrumentType;
      if (prefill.instrumentType === 'FUND') {
        const qtyLabel = document.querySelector('label[for="trade-qty"]');
        const priceLabel = document.getElementById('trade-price-label');
        if (qtyLabel) qtyLabel.textContent = 'Antall andeler';
        if (priceLabel) priceLabel.textContent = 'NAV per andel';
      }
      updatePriceForSelectedStock(state);
    }
    document.getElementById('trade-modal')?.classList.add('active');
  }
}

export function hideTradeModal(state: AppState): void {
  document.getElementById('trade-modal')?.classList.remove('active');
  const fields = ['trade-ticker', 'trade-name', 'trade-isin', 'trade-qty', 'trade-price', 'trade-fee'];
  for (const id of fields) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.value = '';
  }
  const nameInput = document.getElementById('trade-name') as HTMLInputElement | null;
  if (nameInput) nameInput.value = '';
  const instrumentType = document.getElementById('trade-instrument-type') as HTMLInputElement | null;
  if (instrumentType) instrumentType.value = 'STOCK';
  const qtyLabel = document.querySelector('label[for="trade-qty"]');
  const priceLabel = document.getElementById('trade-price-label');
  if (qtyLabel) qtyLabel.textContent = 'Antall aksjer';
  if (priceLabel) priceLabel.textContent = 'Kurs per aksje';
  const suggestions = document.getElementById('search-suggestions') as HTMLElement | null;
  if (suggestions) { suggestions.innerHTML = ''; suggestions.classList.remove('active'); }
  state.selectedSuggestionIndex = -1;
}

export async function autoRegisterDividends(state: AppState, ticker: string, isin: string, buyDate: string, callbacks: {
  onRerender: () => void;
  onComputePortfolioHistory: () => void;
}): Promise<void> {
  const dividends = await fetchDividendHistory(ticker);
  if (!dividends || dividends.length === 0) return;

  const today = new Date().toISOString().split('T')[0];
  const accountId = state.ledger.accounts[0]?.id || 'default';
  const now = new Date().toISOString();

  // Delete existing AUTO dividends from buyDate onwards — they'll be recreated
  // with correct quantities based on the updated trade history
  const autoDivsToRemove = state.ledger.events.filter(
    e => e.type === 'DIVIDEND' && e.source === 'AUTO'
      && 'isin' in e && (e as unknown as { isin: string }).isin === isin
      && e.date >= buyDate
  );
  if (autoDivsToRemove.length > 0) {
    for (const d of autoDivsToRemove) {
      LedgerStorage.deleteEvent(d.id);
    }
    state.ledger = LedgerStorage.loadLedger() || state.ledger;
  }

  // Only skip dates with MANUAL/CSV dividends (not AUTO, since we just deleted those)
  const existingDivDates = new Set(
    state.ledger.events
      .filter(e => e.type === 'DIVIDEND' && 'isin' in e && (e as unknown as { isin: string }).isin === isin)
      .map(e => e.date)
  );

  // Sort events by date for correct quantity calculation
  const sortedEvents = [...state.ledger.events].sort((a, b) => a.date.localeCompare(b.date));

  const newDividends: Array<{ date: string; amount: number; qty: number; perShare: number }> = [];

  for (const div of dividends) {
    if (div.date < buyDate || div.date > today) continue;
    if (existingDivDates.has(div.date)) continue;

    let qtyAtDate = 0;
    for (const e of sortedEvents) {
      if (!('isin' in e) || (e as unknown as { isin: string }).isin !== isin) continue;
      if (e.date > div.date) break;
      const te = e as unknown as { quantity?: number };
      if (e.type === 'TRADE_BUY' && te.quantity) qtyAtDate += te.quantity;
      else if (e.type === 'TRADE_SELL' && te.quantity) qtyAtDate -= te.quantity;
    }

    if (qtyAtDate > 0) {
      const amount = Math.round(qtyAtDate * div.amount * 100) / 100;
      newDividends.push({ date: div.date, amount, qty: qtyAtDate, perShare: div.amount });
    }
  }

  if (newDividends.length === 0) return;

  const events = newDividends.map(d => ({
    id: 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8),
    accountId,
    date: d.date,
    type: 'DIVIDEND' as const,
    amount: d.amount,
    currency: 'NOK' as const,
    createdAt: now,
    source: 'AUTO' as const,
    isin,
    quantity: d.qty,
    perShare: d.perShare,
  }));

  LedgerStorage.addEvents(events);
  state.ledger = LedgerStorage.loadLedger() || state.ledger;
  callbacks.onRerender();
  callbacks.onComputePortfolioHistory();
}
