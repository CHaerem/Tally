import './style.css';
import { LedgerStorage } from './ledger';
import { parseCSV, validateCSV } from './import';
import { deriveHoldings, derivePortfolioMetrics, formatXIRRPercent, formatCurrency, formatPercent, formatDateShort } from './calculations';
import { fetchPricesForHoldings, fetchStockIndex, fetchPriceForDate } from './api';
import type { LedgerState, Holding, PortfolioMetrics } from './types';
import type { CSVParseResult } from './import';

interface StockSuggestion {
  ticker: string;
  name: string;
  currentPrice: number | null;
  type: 'STOCK' | 'FUND';
}

// Popular Norwegian mutual funds with Yahoo Finance Morningstar IDs
const NORWEGIAN_FUNDS: StockSuggestion[] = [
  // DNB
  { ticker: '0P0000PS3U.IR', name: 'DNB Norge Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000NKJ.IR', name: 'DNB Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001EFNB.IR', name: 'DNB Norge A', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001EFNG.IR', name: 'DNB Norge Selektiv', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001Q8AD.IR', name: 'DNB Global Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MUA.IR', name: 'DNB Global Emerging Markets', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MVB.IR', name: 'DNB Teknologi', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001BJ8T.IR', name: 'DNB Miljøinvest', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001CTL0.IR', name: 'DNB Norden Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001EFN5.IR', name: 'DNB Norden', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001BJ8N.IR', name: 'DNB Finans', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000O4C.IR', name: 'DNB Barnefond', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001EFNK.IR', name: 'DNB Obligasjon', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001EFNN.IR', name: 'DNB Obligasjon 20', currentPrice: null, type: 'FUND' },
  { ticker: '0P00017AUH.IR', name: 'DNB Global Treasury', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001F1IM.IR', name: 'DNB AM Norske Aksjer', currentPrice: null, type: 'FUND' },
  // Storebrand
  { ticker: '0P0001HAP0.IR', name: 'Storebrand Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00012AVM.IR', name: 'Storebrand Indeks Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001ACQT.IR', name: 'Storebrand Norge Horisont', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000A82Y.IR', name: 'Storebrand Global Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001BL9W.IR', name: 'Storebrand Global Optimised', currentPrice: null, type: 'FUND' },
  { ticker: '0P00007ZI2.IR', name: 'Storebrand Global Multifactor', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001M3YC.IR', name: 'Storebrand Indeks - Norden', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000O5V.IR', name: 'Storebrand Verdi', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001KO95.IR', name: 'Storebrand Vekst', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000O4T.IR', name: 'Storebrand Aksje Innland', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000TNI3.IR', name: 'Storebrand Forsiktig', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001HAOZ.IR', name: 'Storebrand Likviditet', currentPrice: null, type: 'FUND' },
  // KLP
  { ticker: '0P00001BVT.IR', name: 'KLP AksjeNorge Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001OPC5.IR', name: 'KLP AksjeVerden Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P00018V9L.IR', name: 'KLP AksjeGlobal Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001OPBV.IR', name: 'KLP AksjeNorden Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001OPC2.IR', name: 'KLP AksjeUSA Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001OPBA.IR', name: 'KLP AksjeEuropa Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001OPBE.IR', name: 'KLP AksjeFremvoksende Markeder Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001OPBN.IR', name: 'KLP AksjeGlobal Mer Samfunnsansvar', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001OPBH.IR', name: 'KLP AksjeGlobal Flerfaktor', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001BWAQ.IR', name: 'KLP AksjeGlobal Small Cap Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P00006D9Q.IR', name: 'KLP AksjeAsia Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P00017YPW.IR', name: 'KLP AksjeAsia Indeks Valutasikret', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MY9.IR', name: 'KLP Obligasjon 5 år', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001IFZZ.IR', name: 'KLP Obligasjon 1 år Mer Samfunnsansvar', currentPrice: null, type: 'FUND' },
  { ticker: '0P00002C94.IR', name: 'KLP Obligasjon Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MYB.IR', name: 'KLP Likviditet', currentPrice: null, type: 'FUND' },
  { ticker: '0P00019ADK.IR', name: 'KLP Framtid', currentPrice: null, type: 'FUND' },
  // Nordnet
  { ticker: '0P000134K7.IR', name: 'Nordnet Indeksfond Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001K6NJ.IR', name: 'Nordnet Indeksfond Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001RMV1.IR', name: 'Nordnet Global Indeks 125', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001M5YQ.IR', name: 'Nordnet Indeksfond Teknologi', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001K6NB.IR', name: 'Nordnet Indeksfond Emerging Markets', currentPrice: null, type: 'FUND' },
  // ODIN
  { ticker: '0P000161CO.IR', name: 'ODIN Aksje', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000SVG.IR', name: 'ODIN Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000SVE.IR', name: 'ODIN Norden', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000O88.IR', name: 'ODIN Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000SVP.IR', name: 'ODIN Eiendom', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001J3OK.IR', name: 'ODIN Small Cap', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000OC2.IR', name: 'ODIN Norsk Obligasjon', currentPrice: null, type: 'FUND' },
  // Nordea
  { ticker: '0P0001SQM9.IR', name: 'Nordea Norge Verdi', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001SQMA.IR', name: 'Nordea Norge Pluss', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001TPW6.IR', name: 'Nordea Stabile Aksjer Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001TPW7.IR', name: 'Nordea Avkastning', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001CKST.IR', name: 'Nordea Global Enhanced', currentPrice: null, type: 'FUND' },
  // Skagen
  { ticker: '0P00013OX2.IR', name: 'Skagen Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P00013OX3.IR', name: 'Skagen Kon-Tiki', currentPrice: null, type: 'FUND' },
  { ticker: '0P00013OX6.IR', name: 'Skagen Vekst', currentPrice: null, type: 'FUND' },
  { ticker: '0P00015YSS.IR', name: 'Skagen Focus', currentPrice: null, type: 'FUND' },
  // Holberg
  { ticker: '0P00000OCZ.IR', name: 'Holberg Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000OCX.IR', name: 'Holberg Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001IZAY.IR', name: 'Holberg Global Valutasikret', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000NXT.IR', name: 'Holberg Obligasjon Norden', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000OCR.IR', name: 'Holberg Likviditet', currentPrice: null, type: 'FUND' },
  // Delphi
  { ticker: '0P00000HCS.IR', name: 'Delphi Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00005UKR.IR', name: 'Delphi Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001A1QS.IR', name: 'Delphi Global Valutasikret', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000HCV.IR', name: 'Delphi Kombinasjon', currentPrice: null, type: 'FUND' },
  // Alfred Berg
  { ticker: '0P00000MT3.IR', name: 'Alfred Berg Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MVR.IR', name: 'Alfred Berg Gambak', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000O9F.IR', name: 'Alfred Berg Gambak Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001EUC3.IR', name: 'Alfred Berg Gambak Nordic', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MSP.IR', name: 'Alfred Berg Aktiv', currentPrice: null, type: 'FUND' },
  { ticker: '0P000015PZ.IR', name: 'Alfred Berg Indeks', currentPrice: null, type: 'FUND' },
  // Arctic
  { ticker: '0P0000S1O6.IR', name: 'Arctic Norwegian Equities', currentPrice: null, type: 'FUND' },
  { ticker: '0P000195U2.IR', name: 'Arctic Norwegian Value Creation', currentPrice: null, type: 'FUND' },
  { ticker: '0P00015EZF.IR', name: 'Arctic Return', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000RUOV.IR', name: 'Arctic Nordic Corporate Bond', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000RUOU.IR', name: 'Arctic Nordic Investment Grade', currentPrice: null, type: 'FUND' },
  // Handelsbanken
  { ticker: '0P0001CW9F.IR', name: 'Handelsbanken Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001A1QL.IR', name: 'Handelsbanken Norge A1', currentPrice: null, type: 'FUND' },
  // Pareto
  { ticker: '0P00000NY6.IR', name: 'Pareto Aksje Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00001BTH.IR', name: 'Pareto Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000OAI.IR', name: 'Pareto Obligasjon', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000YT99.IR', name: 'Pareto Nordic Corporate Bond', currentPrice: null, type: 'FUND' },
  // Landkreditt
  { ticker: '0P00001E5D.IR', name: 'Landkreditt Aksje Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000Y66P.IR', name: 'Landkreditt Utbytte', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001FTOL.IR', name: 'Landkreditt Norden Utbytte', currentPrice: null, type: 'FUND' },
  { ticker: '0P00001E5H.IR', name: 'Landkreditt Høyrente', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000X9XC.IR', name: 'Landkreditt Extra', currentPrice: null, type: 'FUND' },
  // PLUSS (Fondsforvaltning)
  { ticker: '0P00000MXR.IR', name: 'PLUSS Aksje', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MXH.IR', name: 'PLUSS Markedsverdi', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MX1.IR', name: 'PLUSS Utland Aksje', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001T9DH.IR', name: 'PLUSS Obligasjon', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MXL.IR', name: 'PLUSS Likviditet', currentPrice: null, type: 'FUND' },
  // C WorldWide
  { ticker: '0P00000O6S.IR', name: 'C WorldWide Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000SV3.IR', name: 'C WorldWide Stabile Aksjer', currentPrice: null, type: 'FUND' },
  // Norne
  { ticker: '0P0001LR0Y.IR', name: 'Norne Aksje Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001J97B.IR', name: 'Norne Aksje Classic', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001KDPB.IR', name: 'Norne Rente', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001LR14.IR', name: 'Norne Kombi 80', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001LRWP.IR', name: 'Norne Kombi 20', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001LRWQ.IR', name: 'Norne Kombi 50', currentPrice: null, type: 'FUND' },
  // Fondsfinans
  { ticker: '0P00000L92.IR', name: 'Fondsfinans Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000HII.IR', name: 'Fondsfinans Aktiv 60/40', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000HIN.IR', name: 'Fondsfinans Fornybar Energi', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001IEW6.IR', name: 'Fondsfinans Utbytte', currentPrice: null, type: 'FUND' },
  { ticker: '0P00016NF4.IR', name: 'Fondsfinans Norden Utbytte', currentPrice: null, type: 'FUND' },
  { ticker: '0P000131AW.IR', name: 'Fondsfinans High Yield', currentPrice: null, type: 'FUND' },
  { ticker: '0P00017UZ2.IR', name: 'Fondsfinans Obligasjon', currentPrice: null, type: 'FUND' },
  // Eika
  { ticker: '0P00000HD4.IR', name: 'Eika Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000ODT.IR', name: 'Eika Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000NYF.IR', name: 'Eika Balansert', currentPrice: null, type: 'FUND' },
  // SpareBank 1
  { ticker: '0P0001PMGR.IR', name: 'SpareBank 1 Indeks Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001MLUK.IR', name: 'SpareBank 1 Norge Verdi', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001LLD4.IR', name: 'SpareBank 1 Aksjer Svanemerket', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000X18D.IR', name: 'SpareBank 1 Indeks Moderat 50', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000Z0FJ.IR', name: 'SpareBank 1 Indeks Forsiktig 25', currentPrice: null, type: 'FUND' },
  // Danske Invest
  { ticker: '0P0000ZSIB.IR', name: 'Danske Invest Norsk Kort Obligasjon', currentPrice: null, type: 'FUND' },
  { ticker: '0P00016RIB.IR', name: 'Danske Invest Norske Aksjer Inst', currentPrice: null, type: 'FUND' },
  // Carnegie
  { ticker: '0P0001RTTV.IR', name: 'Carnegie Global Resilient Small Cap', currentPrice: null, type: 'FUND' },
  // FIRST
  { ticker: '0P0001IBOU.IR', name: 'FIRST Veritas', currentPrice: null, type: 'FUND' },
  // Sbanken
  { ticker: '0P00017BQO.IR', name: 'Sbanken Framgang Sammen', currentPrice: null, type: 'FUND' },
  // Gjensidige
  { ticker: '0P0000J7K8.IR', name: 'Gjensidige Likviditet', currentPrice: null, type: 'FUND' },
];

class TallyApp {
  private ledger: LedgerState;
  private holdings: Holding[] = [];
  private metrics: PortfolioMetrics | null = null;
  private currentPrices: Map<string, number> = new Map();
  private pendingImport: CSVParseResult | null = null;
  private isFetchingPrices = false;
  private stockList: StockSuggestion[] = [];
  private selectedSuggestionIndex = -1;
  private tradeModalMode: 'simple' | 'full' = 'simple';

  constructor() {
    this.ledger = LedgerStorage.initializeLedger();
    this.currentPrices = LedgerStorage.loadPrices();
    this.checkShareUrl();
    this.updateDerivedData();
    this.render();
    this.attachEventListeners();
    this.refreshPrices();
    this.loadStockIndex();
  }

  private async loadStockIndex(): Promise<void> {
    const index = await fetchStockIndex();
    const stocks: StockSuggestion[] = index
      ? Object.entries(index.symbols).map(([ticker, info]) => ({
          ticker,
          name: info.name,
          currentPrice: info.currentPrice,
          type: 'STOCK' as const,
        }))
      : [];
    this.stockList = [...stocks, ...NORWEGIAN_FUNDS];
  }

  private checkShareUrl(): void {
    const hash = window.location.hash;
    if (!hash.startsWith('#share=')) return;

    try {
      const encoded = hash.substring(7);
      const json = decodeURIComponent(atob(encoded));
      const shared = JSON.parse(json) as { events: LedgerState['events']; instruments: LedgerState['instruments'] };

      if (!shared.events?.length) return;

      const count = shared.events.length;
      const tickers = shared.instruments?.map(i => i.ticker).join(', ') || '';
      if (!confirm('Du har mottatt en portefølje med ' + count + ' transaksjoner' + (tickers ? ' (' + tickers + ')' : '') + '.\n\nVil du importere den?')) {
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }

      LedgerStorage.addEvents(shared.events);
      for (const inst of shared.instruments || []) {
        LedgerStorage.upsertInstrument(inst);
      }
      this.ledger = LedgerStorage.loadLedger() || this.ledger;

      // Clean URL
      window.history.replaceState(null, '', window.location.pathname);
    } catch {
      // Invalid share data — ignore silently
      window.history.replaceState(null, '', window.location.pathname);
    }
  }

  private async shareData(): Promise<void> {
    const payload = {
      events: this.ledger.events,
      instruments: this.ledger.instruments,
    };
    const json = JSON.stringify(payload);
    const encoded = btoa(encodeURIComponent(json));
    const url = window.location.origin + window.location.pathname + '#share=' + encoded;

    // Use native share on mobile, clipboard on desktop
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tally portefølje', url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      alert('Lenke kopiert! Åpne den på en annen enhet for å importere porteføljen.');
    } catch {
      // Clipboard failed — show URL in prompt as fallback
      prompt('Kopier denne lenken:', url);
    }
  }

  private async refreshPrices(): Promise<void> {
    if (this.isFetchingPrices) return;
    const tickers = this.ledger.instruments.map(i => ({ isin: i.isin, ticker: i.ticker }));
    if (tickers.length === 0) return;

    this.isFetchingPrices = true;
    this.render();
    this.attachEventListeners();

    const fetched = await fetchPricesForHoldings(tickers);
    for (const [isin, price] of fetched) {
      this.currentPrices.set(isin, price);
    }
    if (fetched.size > 0) {
      LedgerStorage.savePrices(this.currentPrices);
    }

    this.isFetchingPrices = false;
    this.updateDerivedData();
    this.render();
    this.attachEventListeners();
  }

  private updateDerivedData(): void {
    this.holdings = deriveHoldings(this.ledger.events, this.ledger.instruments, this.currentPrices);
    this.metrics = derivePortfolioMetrics(this.ledger.events, this.holdings);
  }

  private render(): void {
    const app = document.getElementById('app');
    if (!app) return;

    const hasData = this.ledger.events.length > 0;

    app.innerHTML = this.renderHeader()
      + '<main class="container">'
      + (hasData ? this.renderSummary() + this.renderWarnings() + this.renderHoldings() + this.renderFooter() : this.renderEmptyState())
      + '</main>'
      + this.renderTradeModal()
      + this.renderImportModal();

    // Prevent body scroll when modal is open
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('touchmove', (e) => {
        if ((e.target as HTMLElement).closest('.modal-content')) return;
        e.preventDefault();
      }, { passive: false });
    });
  }

  private renderHeader(): string {
    const hasData = this.ledger.events.length > 0;
    const actions = hasData
      ? '<div class="header-actions">'
        + '<button class="btn-icon" id="share-data" aria-label="Del"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></button>'
        + '<button class="btn-icon" id="import-csv" aria-label="Importer"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>'
        + '</div>'
      : '';
    const fab = hasData
      ? '<button class="fab" id="add-trade" aria-label="Legg til"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>'
      : '';
    return '<header><div class="container header-inner"><h1>Tally</h1>' + actions + '</div></header>' + fab;
  }

  private renderEmptyState(): string {
    return '<div class="card empty-state">'
      + '<h2>Velkommen til Tally</h2>'
      + '<p>Spor investeringene dine og se din faktiske avkastning.</p>'
      + '<div class="empty-buttons">'
      + '<button class="btn btn-primary btn-large" id="add-trade">Legg til beholdning</button>'
      + '<button class="btn btn-large btn-secondary" id="import-csv">Importer fra megler</button>'
      + '</div>'
      + '</div>';
  }

  private renderSummary(): string {
    if (!this.metrics) return '';

    const m = this.metrics;
    const xirrClass = (m.xirrPercent || 0) >= 0 ? 'text-success' : 'text-danger';
    const unrealizedGain = this.holdings.reduce((sum, h) => sum + h.unrealizedGain, 0);
    const unrealizedClass = unrealizedGain >= 0 ? 'text-success' : 'text-danger';
    const totalReturn = unrealizedGain + m.totalDividends;
    const totalReturnClass = totalReturn >= 0 ? 'text-success' : 'text-danger';

    return '<div class="card">'
      + '<div class="summary-hero"><div class="label">Markedsverdi</div><div class="value">' + formatCurrency(m.currentValue) + '</div>'
      + '<div class="sub-value ' + xirrClass + '">' + formatXIRRPercent(m.xirr) + ' årlig (XIRR)</div></div>'
      + '<div class="summary-grid">'
      + '<div class="summary-item"><div class="label">Total avkastning</div><div class="value ' + totalReturnClass + '">' + formatCurrency(totalReturn) + '</div></div>'
      + '<div class="summary-item"><div class="label">Investert</div><div class="value">' + formatCurrency(m.netCashFlow) + '</div></div>'
      + '<div class="summary-item"><div class="label">Urealisert</div><div class="value ' + unrealizedClass + '">' + formatCurrency(unrealizedGain) + '</div></div>'
      + '<div class="summary-item"><div class="label">Utbytte</div><div class="value">' + formatCurrency(m.totalDividends) + '</div></div>'
      + '</div></div>';
  }

  private renderWarnings(): string {
    const warnings = this.ledger.warnings.filter(w => w.severity !== 'INFO');
    if (warnings.length === 0) return '';
    return '<div class="card warning-card"><h3>Datakvalitetsadvarsler</h3><ul>'
      + warnings.map(w => '<li>' + w.message + '</li>').join('') + '</ul></div>';
  }

  private renderHoldings(): string {
    if (this.holdings.length === 0) return '';
    const refreshLabel = this.isFetchingPrices
      ? '<span class="loading"></span> Henter...'
      : 'Oppdater';
    const refreshBtn = '<button class="btn btn-small btn-primary" id="refresh-prices"'
      + (this.isFetchingPrices ? ' disabled' : '') + '>' + refreshLabel + '</button>';

    return '<div class="card-header"><h2>Beholdning</h2>' + refreshBtn + '</div>'
      + '<div class="holdings-list">'
      + this.holdings.map(h => {
        const gainClass = h.unrealizedGain >= 0 ? 'text-success' : 'text-danger';
        const gainSign = h.unrealizedGain >= 0 ? '+' : '';
        const inst = this.ledger.instruments.find(i => i.isin === h.isin);
        const isFund = inst?.instrumentType === 'FUND';
        const label = isFund ? h.name : h.ticker;
        const sublabel = isFund ? 'Fond' : h.name;
        const qty = Number.isInteger(h.quantity) ? h.quantity.toString() : h.quantity.toFixed(4);
        const priceValue = h.currentPrice > 0 ? h.currentPrice.toFixed(2) : '';

        return '<div class="holding-card" data-isin="' + h.isin + '">'
          + '<div class="holding-info">'
          + '<div class="holding-ticker">' + label + '</div>'
          + '<div class="holding-name">' + sublabel + '</div>'
          + '</div>'
          + '<div class="holding-values">'
          + '<div class="holding-market-value">' + formatCurrency(h.marketValue) + '</div>'
          + '<div class="holding-gain ' + gainClass + '">' + gainSign + formatPercent(h.unrealizedGainPercent) + '</div>'
          + '</div></div>'
          + '<div class="holding-details" id="details-' + h.isin + '">'
          + '<div class="holding-detail"><div class="label">Antall</div><div class="value">' + qty + '</div></div>'
          + '<div class="holding-detail"><div class="label">Snittpris</div><div class="value">' + formatCurrency(h.averageCostPerShare, 2) + '</div></div>'
          + '<div class="holding-detail"><div class="label">Kurs</div><input type="number" class="price-input" data-isin="' + h.isin + '" value="' + priceValue + '" placeholder="—" step="0.01" min="0"></div>'
          + '<div class="holding-detail"><div class="label">Gevinst</div><div class="value ' + gainClass + '">' + formatCurrency(h.unrealizedGain) + '</div></div>'
          + (h.totalDividendsReceived > 0 ? '<div class="holding-detail"><div class="label">Utbytte</div><div class="value">' + formatCurrency(h.totalDividendsReceived) + '</div></div>' : '')
          + '</div>';
      }).join('')
      + '</div>';
  }

  private renderFooter(): string {
    return '<div class="footer-actions">'
      + '<span class="text-muted text-small">'
      + this.ledger.events.length + ' transaksjoner'
      + (this.ledger.lastModified ? ' &middot; ' + formatDateShort(this.ledger.lastModified) : '')
      + '</span>'
      + '<div class="footer-buttons">'
      + '<button class="btn btn-small btn-ghost" id="export-json">Eksporter</button>'
      + '<button class="btn btn-small btn-danger-outline" id="clear-data">Slett</button>'
      + '</div>'
      + '</div>';
  }

  private renderTradeModal(): string {
    const today = new Date().toISOString().split('T')[0];
    const isSimple = this.tradeModalMode === 'simple';
    const title = isSimple ? 'Legg til beholdning' : 'Registrer transaksjon';

    const typeTabs = isSimple ? '' : '<div class="trade-type-tabs">'
      + '<button class="trade-tab active" data-type="TRADE_BUY">Kjøp</button>'
      + '<button class="trade-tab" data-type="TRADE_SELL">Salg</button>'
      + '<button class="trade-tab" data-type="DIVIDEND">Utbytte</button>'
      + '</div>';

    const dateField = '<div class="form-group"><label for="trade-date">' + (isSimple ? 'Kjøpsdato' : 'Dato') + '</label><input type="date" id="trade-date" class="form-control" value="' + today + '"></div>';
    const feeField = isSimple ? '' : '<div class="form-group"><label for="trade-fee">Kurtasje (valgfritt)</label><input type="number" id="trade-fee" class="form-control" placeholder="29" step="0.01" min="0" inputmode="decimal"></div>';

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

  private submitTrade(): void {
    const type = (document.getElementById('trade-type') as HTMLSelectElement).value;
    const tickerRaw = (document.getElementById('trade-ticker') as HTMLInputElement).value.trim();
    const ticker = tickerRaw.includes('.') ? tickerRaw : tickerRaw.toUpperCase(); // Don't uppercase Morningstar IDs
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
    const accountId = this.ledger.accounts[0]?.id || 'default';
    const now = new Date().toISOString();

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

    this.ledger = LedgerStorage.loadLedger() || this.ledger;
    this.updateDerivedData();
    this.hideTradeModal();
    this.render();
    this.attachEventListeners();
    this.refreshPrices();
  }

  private selectStock(stock: StockSuggestion): void {
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
    this.updatePriceForSelectedStock();

    // Focus quantity field so user can continue quickly
    document.getElementById('trade-qty')?.focus();
  }

  private async updatePriceForSelectedStock(): Promise<void> {
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
      const stock = this.stockList.find(s => s.ticker === ticker);
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

  private updateSuggestionHighlight(items: NodeListOf<Element>): void {
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === this.selectedSuggestionIndex);
      if (i === this.selectedSuggestionIndex) {
        (item as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    });
  }

  private attachTradeModalListeners(): void {
    document.getElementById('cancel-trade')?.addEventListener('click', () => this.hideTradeModal());
    document.getElementById('submit-trade')?.addEventListener('click', () => this.submitTrade());

    // Mode toggle
    document.getElementById('toggle-trade-mode')?.addEventListener('click', () => {
      this.showTradeModal(this.tradeModalMode === 'simple' ? 'full' : 'simple');
    });

    // Date change → fetch historical price
    document.getElementById('trade-date')?.addEventListener('change', () => {
      this.updatePriceForSelectedStock();
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

    // Three-way calculation: price × qty = total (any field drives the others)
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

      if (source === 'total' && t > 0 && p > 0 && qtyInput) {
        qtyInput.value = (t / p).toFixed(4).replace(/\.?0+$/, '');
        if (calcHint) calcHint.textContent = formatCurrency(t) + ' ÷ ' + formatCurrency(p, 2) + ' = ' + qtyInput.value + ' ' + unitLabel;
      } else if (source === 'qty' && q > 0 && p > 0 && totalInput) {
        totalInput.value = (q * p).toFixed(2);
        if (calcHint) calcHint.textContent = '';
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
        const query = tickerInput.value.trim().toUpperCase();
        this.selectedSuggestionIndex = -1;
        if (query.length === 0) {
          suggestionsEl.innerHTML = '';
          suggestionsEl.classList.remove('active');
          return;
        }
        const queryWords = query.split(/\s+/).filter(w => w.length > 0);
        const fuzzyScore = (s: StockSuggestion): number => {
          const ticker = s.ticker.toUpperCase();
          const name = s.name.toUpperCase();
          const combined = ticker + ' ' + name;
          // All query words must match somewhere (fuzzy: substring match in combined text)
          const allMatch = queryWords.every(w => combined.includes(w));
          if (!allMatch) return -1;
          // Score: exact ticker start = best, then name start, then position-based
          if (ticker.startsWith(query)) return 100;
          if (ticker.includes(query)) return 90;
          if (name.startsWith(query)) return 80;
          if (name.includes(query)) return 70;
          // Multi-word: bonus if words match at word boundaries
          const nameWords = name.split(/\s+/);
          const boundaryMatches = queryWords.filter(qw =>
            nameWords.some(nw => nw.startsWith(qw))
          ).length;
          return 50 + (boundaryMatches * 5);
        };
        const matches = this.stockList
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
          return '<button class="suggestion-item' + (i === this.selectedSuggestionIndex ? ' selected' : '') + '" data-index="' + i + '" type="button">'
            + '<span class="suggestion-ticker">' + label + '</span>'
            + badge + sublabel
            + (s.currentPrice ? '<span class="suggestion-price">' + s.currentPrice.toFixed(2) + '</span>' : '')
            + '</button>';
        }).join('');
        suggestionsEl.classList.add('active');

        suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
          item.addEventListener('click', () => {
            const idx = parseInt((item as HTMLElement).dataset.index || '0');
            this.selectStock(matches[idx]);
          });
        });
      });

      tickerInput.addEventListener('keydown', (e) => {
        const items = suggestionsEl.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.selectedSuggestionIndex = Math.min(this.selectedSuggestionIndex + 1, items.length - 1);
          this.updateSuggestionHighlight(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.selectedSuggestionIndex = Math.max(this.selectedSuggestionIndex - 1, 0);
          this.updateSuggestionHighlight(items);
        } else if (e.key === 'Enter' && this.selectedSuggestionIndex >= 0) {
          e.preventDefault();
          (items[this.selectedSuggestionIndex] as HTMLElement).click();
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
      if ((e.target as HTMLElement).id === 'trade-modal') this.hideTradeModal();
    });
  }

  private showTradeModal(mode: 'simple' | 'full' = 'simple'): void {
    this.tradeModalMode = mode;
    // Re-render modal with correct mode, then show it
    const modal = document.getElementById('trade-modal');
    if (modal) {
      modal.outerHTML = this.renderTradeModal();
      this.attachTradeModalListeners();
      document.getElementById('trade-modal')?.classList.add('active');
    }
  }
  private hideTradeModal(): void {
    document.getElementById('trade-modal')?.classList.remove('active');
    // Reset form
    const fields = ['trade-ticker', 'trade-name', 'trade-isin', 'trade-qty', 'trade-price', 'trade-fee'];
    for (const id of fields) {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = '';
    }
    const nameInput = document.getElementById('trade-name') as HTMLInputElement | null;
    if (nameInput) nameInput.value = '';
    const instrumentType = document.getElementById('trade-instrument-type') as HTMLInputElement | null;
    if (instrumentType) instrumentType.value = 'STOCK';
    // Reset labels
    const qtyLabel = document.querySelector('label[for="trade-qty"]');
    const priceLabel = document.getElementById('trade-price-label');
    if (qtyLabel) qtyLabel.textContent = 'Antall aksjer';
    if (priceLabel) priceLabel.textContent = 'Kurs per aksje';
    const suggestions = document.getElementById('search-suggestions') as HTMLElement | null;
    if (suggestions) { suggestions.innerHTML = ''; suggestions.classList.remove('active'); }
    this.selectedSuggestionIndex = -1;
  }

  private renderImportModal(): string {
    return '<div class="modal" id="import-modal"><div class="modal-content"><div class="modal-header"><h3>Importer transaksjoner</h3><p class="text-muted">Last opp CSV-fil fra megleren din (Nordnet, DNB, Sbanken m.fl.)</p></div>'
      + '<div class="form-group"><label class="file-upload" id="file-upload-label"><input type="file" id="csv-file" accept=".csv,.txt"><span class="file-upload-text">Velg fil eller dra den hit</span></label></div>'
      + '<div id="import-preview" style="display:none"><div id="import-stats" class="import-stats"></div><div id="import-warnings"></div></div>'
      + '<div class="modal-footer"><button class="btn" id="cancel-import">Avbryt</button><button class="btn btn-success" id="confirm-import" disabled>Importer</button></div></div></div>';
  }

  private attachEventListeners(): void {
    document.getElementById('import-csv')?.addEventListener('click', () => this.showModal());
    document.getElementById('cancel-import')?.addEventListener('click', () => this.hideModal());
    document.getElementById('confirm-import')?.addEventListener('click', () => this.confirmImport());
    document.getElementById('export-json')?.addEventListener('click', () => this.exportData());
    document.getElementById('clear-data')?.addEventListener('click', () => this.clearAllData());
    document.getElementById('share-data')?.addEventListener('click', () => this.shareData());
    document.getElementById('csv-file')?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) this.handleFileSelect(file);
    });
    document.getElementById('refresh-prices')?.addEventListener('click', () => this.refreshPrices());

    // Trade modal — open in simple mode from empty state, full mode from header
    const hasData = this.ledger.events.length > 0;
    document.getElementById('add-trade')?.addEventListener('click', () => this.showTradeModal(hasData ? 'full' : 'simple'));
    this.attachTradeModalListeners();

    // Close import modal on backdrop click
    document.getElementById('import-modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'import-modal') this.hideModal();
    });

    // Holding cards — click to expand details
    document.querySelectorAll('.holding-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't toggle if clicking a price input
        if ((e.target as HTMLElement).classList.contains('price-input')) return;
        const isin = (card as HTMLElement).dataset.isin;
        const details = document.getElementById('details-' + isin);
        if (details) details.classList.toggle('active');
      });
    });

    document.querySelectorAll('.price-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const el = e.target as HTMLInputElement;
        const isin = el.dataset.isin;
        const price = parseFloat(el.value);
        if (isin && !isNaN(price) && price >= 0) {
          this.currentPrices.set(isin, price);
        } else if (isin && el.value === '') {
          this.currentPrices.delete(isin);
        }
        LedgerStorage.savePrices(this.currentPrices);
        this.updateDerivedData();
        this.render();
        this.attachEventListeners();
      });
    });
  }

  private showModal(): void { document.getElementById('import-modal')?.classList.add('active'); }
  private hideModal(): void {
    document.getElementById('import-modal')?.classList.remove('active');
    const fileInput = document.getElementById('csv-file') as HTMLInputElement | null;
    const preview = document.getElementById('import-preview') as HTMLElement | null;
    const confirmBtn = document.getElementById('confirm-import') as HTMLButtonElement | null;
    if (fileInput) fileInput.value = '';
    if (preview) preview.style.display = 'none';
    if (confirmBtn) confirmBtn.disabled = true;
  }

  private async handleFileSelect(file: File): Promise<void> {
    const content = await file.text();
    const errors = validateCSV(content);
    if (errors.length > 0) { alert('Feil i filen:\n\n' + errors.join('\n')); return; }

    const result = parseCSV(content, this.ledger.accounts[0]?.id || 'default');
    this.pendingImport = result;

    const preview = document.getElementById('import-preview') as HTMLElement;
    const stats = document.getElementById('import-stats') as HTMLElement;
    const warnings = document.getElementById('import-warnings') as HTMLElement;
    const confirmBtn = document.getElementById('confirm-import') as HTMLButtonElement;

    preview.style.display = 'block';
    stats.innerHTML = '<div class="stat-grid">'
      + '<div class="stat"><span class="stat-value">' + result.stats.parsedRows + '</span><span class="stat-label">rader</span></div>'
      + '<div class="stat"><span class="stat-value">' + result.stats.tradeEvents + '</span><span class="stat-label">handler</span></div>'
      + '<div class="stat"><span class="stat-value">' + result.stats.dividendEvents + '</span><span class="stat-label">utbytter</span></div>'
      + '<div class="stat"><span class="stat-value">' + result.stats.cashEvents + '</span><span class="stat-label">inn/utbetalinger</span></div>'
      + '</div>';

    if (result.warnings.length > 0) {
      warnings.innerHTML = '<div class="import-warnings">' + result.warnings.map(w => '<p>' + w.message + '</p>').join('') + '</div>';
    }

    confirmBtn.disabled = result.events.length === 0;
  }

  private confirmImport(): void {
    if (!this.pendingImport) return;
    LedgerStorage.addEvents(this.pendingImport.events);
    for (const inst of this.pendingImport.instruments) LedgerStorage.upsertInstrument(inst);
    for (const warn of this.pendingImport.warnings) LedgerStorage.addWarning(warn);
    this.ledger = LedgerStorage.loadLedger() || this.ledger;
    this.updateDerivedData();
    this.hideModal();
    this.render();
    this.attachEventListeners();
    this.refreshPrices();
  }

  private exportData(): void {
    const json = LedgerStorage.exportAsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tally-backup-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
  }

  private clearAllData(): void {
    if (confirm('Er du sikker på at du vil slette alle data? Dette kan ikke angres.')) {
      LedgerStorage.clearLedger();
      this.currentPrices.clear();
      LedgerStorage.savePrices(this.currentPrices);
      this.ledger = LedgerStorage.initializeLedger();
      this.holdings = [];
      this.metrics = null;
      this.render();
      this.attachEventListeners();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new TallyApp());
