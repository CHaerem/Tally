import './style.css';
import { LedgerStorage, generateEventId } from './ledger';
import { parseCSV, validateCSV, parseVPSExport, isVPSFile } from './import';
import { deriveHoldings, derivePortfolioMetrics, formatCurrency, formatPercent, formatDateShort, getPeriodStartDate, deriveDividendSummary, buildMissingDividendEvents } from './calculations';
import type { ReturnPeriod, DividendSummary } from './calculations';
import { fetchPricesForHoldings, fetchStockIndex, fetchPriceForDate, fetchPriceHistory, fetchLivePrice, fetchStockQuote, fetchFundamentals, fetchMarketData, fetchDividendHistory } from './api';
import type { StockQuote, Fundamentals } from './api';
import type { LedgerState, Holding, PortfolioMetrics, DividendEvent } from './types';
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
  // Heimdal
  { ticker: '0P0001Q692.IR', name: 'Heimdal Utbytte D', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001Q690.IR', name: 'Heimdal Utbytte B', currentPrice: null, type: 'FUND' },
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
  // exploreCategory removed
  private watchlist: Array<{ ticker: string; name: string; type: 'STOCK' | 'FUND' }> = [];
  private obxPrice: number | null = null;
  private selectedPeriod: ReturnPeriod = 'total';
  private dividendSummary: DividendSummary | null = null;
  private quoteCache = new Map<string, StockQuote>();
  private portfolioHistory: {
    series: Array<{ date: string; value: number; costBasis: number }>;
    events: Array<{ date: string; type: string; amount: number; name: string }>;
  } | null = null;
  private isLoadingChart = false;

  constructor() {
    this.ledger = LedgerStorage.initializeLedger();
    this.currentPrices = LedgerStorage.loadPrices();
    this.watchlist = this.loadWatchlist();
    this.checkShareUrl();
    this.updateDerivedData();
    this.render();
    this.attachEventListeners();
    this.refreshPrices();
    this.loadStockIndex();
    this.computePortfolioHistory();
    this.fetchOBXPrice();
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
    // Re-render to show explore section now that stock data is loaded
    if (this.stockList.length > NORWEGIAN_FUNDS.length) {
      this.render();
      this.attachEventListeners();
      this.computePortfolioHistory();
    }
  }

  private loadWatchlist(): Array<{ ticker: string; name: string; type: 'STOCK' | 'FUND' }> {
    try {
      const raw = localStorage.getItem('tally_watchlist');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private saveWatchlist(): void {
    localStorage.setItem('tally_watchlist', JSON.stringify(this.watchlist));
  }

  private addToWatchlist(stock: StockSuggestion): void {
    if (this.watchlist.some(w => w.ticker === stock.ticker)) return;
    this.watchlist.push({ ticker: stock.ticker, name: stock.name, type: stock.type });
    this.saveWatchlist();
    this.render();
    this.attachEventListeners();
  }

  private removeFromWatchlist(ticker: string): void {
    this.watchlist = this.watchlist.filter(w => w.ticker !== ticker);
    this.saveWatchlist();
    this.render();
    this.attachEventListeners();
  }

  private async fetchOBXPrice(): Promise<void> {
    const price = await fetchLivePrice('^OBX');
    if (price !== null) {
      this.obxPrice = price;
      const el = document.getElementById('obx-price');
      if (el) el.textContent = price.toFixed(2);
    }
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
    this.computePortfolioHistory();
    this.syncDividends();
  }

  private updateDerivedData(): void {
    this.holdings = deriveHoldings(this.ledger.events, this.ledger.instruments, this.currentPrices);
    this.metrics = derivePortfolioMetrics(this.ledger.events, this.holdings);
    this.dividendSummary = deriveDividendSummary(this.ledger.events, this.ledger.instruments, this.holdings);
    this.portfolioHistory = null;
  }

  /**
   * Sync dividends from static data for all instruments in the ledger.
   * Compares known dividend events with historical data and creates
   * missing DIVIDEND events based on quantity held at each ex-date.
   */
  private async syncDividends(): Promise<void> {
    const instruments = this.ledger.instruments;
    if (instruments.length === 0) return;

    const newEvents: DividendEvent[] = [];

    const results = await Promise.allSettled(
      instruments.map(async (inst) => {
        const history = await fetchDividendHistory(inst.ticker);
        if (history.length === 0) return;
        const missing = buildMissingDividendEvents(
          this.ledger.events, inst.isin, history, generateEventId,
        );
        newEvents.push(...missing);
      })
    );
    void results;

    if (newEvents.length > 0) {
      this.ledger = LedgerStorage.addEvents(newEvents);
      this.updateDerivedData();
      this.render();
      this.attachEventListeners();
      this.reattachChartIfNeeded();
    }
  }

  private async computePortfolioHistory(): Promise<void> {
    if (this.isLoadingChart || this.ledger.events.length === 0) return;
    this.isLoadingChart = true;

    try {
      // Collect unique ISINs and their tickers
      const isinTickers = new Map<string, string>();
      for (const e of this.ledger.events) {
        if ('isin' in e) {
          const ev = e as unknown as { isin: string };
          const inst = this.ledger.instruments.find(i => i.isin === ev.isin);
          if (inst) isinTickers.set(inst.isin, inst.ticker);
        }
      }

      // Fetch price histories in parallel
      const priceMap = new Map<string, Array<{ date: string; close: number }>>();
      const fetches = Array.from(isinTickers.entries()).map(async ([isin, ticker]) => {
        const prices = await fetchPriceHistory(ticker);
        if (prices.length > 0) priceMap.set(isin, prices);
      });
      await Promise.allSettled(fetches);

      // Build price lookup: closest price on or before date
      const getPrice = (isin: string, date: string): number | null => {
        const prices = priceMap.get(isin);
        if (!prices) return null;
        let best: number | null = null;
        for (const p of prices) {
          if (p.date <= date) best = p.close;
          else break;
        }
        return best;
      };

      // Sort events chronologically
      const sortedEvents = [...this.ledger.events].sort((a, b) => a.date.localeCompare(b.date));
      if (sortedEvents.length === 0) { this.isLoadingChart = false; return; }

      // Collect all unique dates from price histories (sampled weekly)
      const allDates = new Set<string>();
      for (const prices of priceMap.values()) {
        for (let i = 0; i < prices.length; i += 5) { // every ~week (5 trading days)
          allDates.add(prices[i].date);
        }
        // Always include last date
        if (prices.length > 0) allDates.add(prices[prices.length - 1].date);
      }
      // Include event dates
      for (const e of sortedEvents) allDates.add(e.date);
      // Include today
      const today = new Date().toISOString().split('T')[0];
      allDates.add(today);

      const firstEventDate = sortedEvents[0].date;
      const sampleDates = Array.from(allDates)
        .filter(d => d >= firstEventDate)
        .sort();

      // Replay events to compute portfolio value at each sample date
      const quantities = new Map<string, number>();
      let totalCostBasis = 0;
      let eventIdx = 0;
      const series: Array<{ date: string; value: number; costBasis: number }> = [];
      const eventMarkers: Array<{ date: string; type: string; amount: number; name: string }> = [];

      for (const date of sampleDates) {
        // Replay events up to and including this date
        while (eventIdx < sortedEvents.length && sortedEvents[eventIdx].date <= date) {
          const ev = sortedEvents[eventIdx];
          if (ev.type === 'TRADE_BUY' || ev.type === 'TRADE_SELL') {
            const te = ev as unknown as { isin: string; quantity: number; fee?: number };
            const prevQty = quantities.get(te.isin) || 0;
            if (ev.type === 'TRADE_BUY') {
              quantities.set(te.isin, prevQty + te.quantity);
              totalCostBasis += ev.amount + (te.fee || 0);
            } else {
              quantities.set(te.isin, prevQty - te.quantity);
              totalCostBasis -= ev.amount;
            }
            const inst = this.ledger.instruments.find(i => i.isin === te.isin);
            eventMarkers.push({ date: ev.date, type: ev.type, amount: ev.amount, name: inst?.name || te.isin });
          } else if (ev.type === 'DIVIDEND') {
            const de = ev as unknown as { isin: string };
            const inst = this.ledger.instruments.find(i => i.isin === de.isin);
            eventMarkers.push({ date: ev.date, type: ev.type, amount: ev.amount, name: inst?.name || de.isin });
          }
          eventIdx++;
        }

        // Compute portfolio value at this date
        let value = 0;
        let hasAnyPrice = false;
        for (const [isin, qty] of quantities) {
          if (qty <= 0) continue;
          const price = getPrice(isin, date);
          if (price !== null) {
            value += qty * price;
            hasAnyPrice = true;
          }
        }

        if (hasAnyPrice || value === 0) {
          series.push({ date, value, costBasis: totalCostBasis });
        }
      }

      this.portfolioHistory = { series, events: eventMarkers };

      // Inject into DOM
      const container = document.getElementById('portfolio-chart-container');
      if (container && series.length >= 2) {
        container.innerHTML = this.renderPortfolioChartSVG();
        this.drawPortfolioChart();
        this.attachChartInteraction();
      } else if (container) {
        container.innerHTML = '';
      }
      const divList = document.getElementById('portfolio-dividend-list');
      if (divList) {
        divList.innerHTML = this.renderDividendList();
        this.attachDividendToggle();
      }

    } finally {
      this.isLoadingChart = false;
    }
  }

  private reattachChartIfNeeded(): void {
    if (!this.portfolioHistory) return;
    const container = document.getElementById('portfolio-chart-container');
    if (container && this.portfolioHistory.series.length >= 2) {
      container.innerHTML = this.renderPortfolioChartSVG();
      this.drawPortfolioChart();
      this.attachChartInteraction();
    }
    const divList = document.getElementById('portfolio-dividend-list');
    if (divList) {
      divList.innerHTML = this.renderDividendList();
      this.attachDividendToggle();
    }
  }

  private attachDividendToggle(): void {
    const toggle = document.getElementById('div-txn-toggle');
    const list = document.getElementById('div-txn-list');
    if (toggle && list) {
      toggle.addEventListener('click', () => {
        const isActive = list.classList.toggle('active');
        toggle.textContent = isActive ? 'Skjul transaksjoner' : 'Vis transaksjoner';
      });
    }
  }

  private render(): void {
    const app = document.getElementById('app');
    if (!app) return;

    const hasData = this.ledger.events.length > 0;

    app.innerHTML = this.renderHeader()
      + '<main class="container">'
      + (hasData
        ? this.renderSummary()
          + this.renderWarnings()
          + '<section class="section-group">' + this.renderHoldings() + '</section>'
          + '<section class="section-group section-market">' + this.renderMarketSection() + '</section>'
          + this.renderFooter()
        : this.renderEmptyState())
      + '</main>'
      + this.renderTradeModal()
      + this.renderImportModal()
;

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
    const unrealizedGain = this.holdings.reduce((sum, h) => sum + h.unrealizedGain, 0);
    const totalReturn = unrealizedGain + m.totalDividends;
    const totalReturnClass = totalReturn >= 0 ? 'text-success' : 'text-danger';

    // Period selector for chart
    const firstEventDate = this.ledger.events.length > 0
      ? this.ledger.events.reduce((min, e) => e.date < min ? e.date : min, this.ledger.events[0].date)
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
          '<button class="period-pill' + (p.key === this.selectedPeriod ? ' active' : '') + '" data-period="' + p.key + '">' + p.label + '</button>'
        ).join('') + '</div>'
      : '';

    // Calculate invested from trades (buy - sell) if no CASH_IN events
    const totalCostBasis = this.holdings.reduce((sum, h) => sum + h.costBasis, 0);
    const invested = m.netCashFlow > 0 ? m.netCashFlow : totalCostBasis;

    // Allocation bar
    const totalMV = m.currentValue || 1;
    const allocationColors = ['#5a9a6e', '#da7756', '#4a90d9', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c', '#34495e'];
    const allocationItems = this.holdings
      .map((h, i) => {
        const inst = this.ledger.instruments.find(ii => ii.isin === h.isin);
        const label = inst?.instrumentType === 'FUND' ? h.name : h.ticker;
        const pct = (h.marketValue / totalMV) * 100;
        return { label, pct, color: allocationColors[i % allocationColors.length] };
      })
      .sort((a, b) => b.pct - a.pct);

    const allocationBar = allocationItems
      .map(a => '<div class="alloc-segment" style="width:' + a.pct.toFixed(1) + '%;background:' + a.color + '" title="' + a.label + ' ' + a.pct.toFixed(1) + '%"></div>')
      .join('');

    const unrealizedClass = unrealizedGain >= 0 ? 'text-success' : 'text-danger';

    const totalReturnPct = invested > 0 ? (totalReturn / invested * 100) : 0;
    const totalReturnPctSign = totalReturnPct >= 0 ? '+' : '';

    // Separate unrealized (kursgevinst) % for clarity
    const unrealizedPct = invested > 0 ? (unrealizedGain / invested * 100) : 0;
    const unrealizedPctSign = unrealizedPct >= 0 ? '+' : '';

    return '<div class="card">'
      + '<div class="summary-hero">'
      + '<div class="label">Markedsverdi</div>'
      + '<div class="value">' + formatCurrency(m.currentValue) + '</div>'
      + periodPills
      + '</div>'
      + '<div id="portfolio-chart-container" class="portfolio-chart-container"><div class="chart-placeholder">Laster graf...</div></div>'
      + '<div id="portfolio-dividend-list"></div>'
      // Breakdown — each line is self-explanatory
      + '<div class="return-breakdown">'
      + '<div class="breakdown-row"><span class="breakdown-label">Investert</span><span class="breakdown-val">' + formatCurrency(invested) + '</span></div>'
      + '<div class="breakdown-row"><span class="breakdown-label">Kursgevinst</span><span class="breakdown-val ' + unrealizedClass + '">' + (unrealizedGain >= 0 ? '+' : '') + formatCurrency(unrealizedGain) + ' (' + unrealizedPctSign + unrealizedPct.toFixed(1) + '%)</span></div>'
      + '<div class="breakdown-row"><span class="breakdown-label">Mottatt utbytte</span><span class="breakdown-val">' + (m.totalDividends > 0 ? '+' + formatCurrency(m.totalDividends) : '0 kr') + '</span></div>'
      + '<div class="breakdown-row breakdown-total"><span class="breakdown-label">Totalavkastning (inkl. utbytte)</span><span class="breakdown-val ' + totalReturnClass + '">' + (totalReturn >= 0 ? '+' : '') + formatCurrency(totalReturn) + ' (' + totalReturnPctSign + totalReturnPct.toFixed(1) + '%)</span></div>'
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
    const refreshBtn = '<button class="btn btn-small btn-outline" id="refresh-prices"'
      + (this.isFetchingPrices ? ' disabled' : '') + '>' + refreshLabel + '</button>';

    const allocationColors = ['#5a9a6e', '#da7756', '#4a90d9', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c', '#34495e'];
    const totalMVH = this.holdings.reduce((s, x) => s + x.marketValue, 0) || 1;

    return '<div class="card-header"><h2>Beholdning</h2>' + refreshBtn + '</div>'
      + '<div class="holdings-list">'
      + this.holdings.map((h, hIdx) => {
        const gainClass = h.unrealizedGain >= 0 ? 'text-success' : 'text-danger';
        // gainSign removed — formatPercent already adds +/-
        const inst = this.ledger.instruments.find(i => i.isin === h.isin);
        const isFund = inst?.instrumentType === 'FUND';
        const label = isFund ? h.name : h.ticker;
        const sublabel = isFund ? 'Fond' : h.name;
        const qty = Number.isInteger(h.quantity) ? h.quantity.toString() : h.quantity.toFixed(4);
        const priceValue = h.currentPrice > 0 ? h.currentPrice.toFixed(2) : '';
        const allocColor = allocationColors[hIdx % allocationColors.length];

        // Portfolio share
        const sharePct = (h.marketValue / totalMVH * 100).toFixed(1);

        return '<div class="holding-card" data-isin="' + h.isin + '">'
          + '<div class="holding-color" style="background:' + allocColor + '"></div>'
          + '<div class="holding-info">'
          + '<div class="holding-ticker">' + label + '</div>'
          + '<div class="holding-name">' + sublabel + '</div>'
          + '</div>'
          + '<div class="holding-values">'
          + '<div class="holding-market-value">' + formatCurrency(h.marketValue) + '</div>'
          + '<div class="holding-gain ' + gainClass + '">' + formatPercent(h.unrealizedGainPercent) + '</div>'
          + '</div></div>'
          + '<div class="holding-details" id="details-' + h.isin + '">'
          + '<div class="holding-chart-wrap" data-ticker="' + (inst?.ticker || h.ticker) + '" data-isin="' + h.isin + '" data-cost="' + h.averageCostPerShare.toFixed(2) + '">'
          + '<div class="holding-chart-info" id="hcinfo-' + h.isin + '"></div>'
          + '<div class="holding-chart-area" id="hcarea-' + h.isin + '"><div class="sparkline-placeholder">Laster graf...</div></div>'
          + '</div>'
          + '<div class="holding-detail"><div class="label">Antall</div><div class="value">' + qty + '</div></div>'
          + '<div class="holding-detail"><div class="label">Kjøpskurs (snitt)</div><div class="value">' + formatCurrency(h.averageCostPerShare, 2) + '</div></div>'
          + '<div class="holding-detail"><div class="label">Nåværende kurs</div><input type="number" class="price-input" data-isin="' + h.isin + '" value="' + priceValue + '" placeholder="—" step="0.01" min="0"></div>'
          + '<div class="holding-detail"><div class="label">Kursgevinst</div><div class="value ' + gainClass + '">' + (h.unrealizedGain >= 0 ? '+' : '') + formatCurrency(h.unrealizedGain) + '</div></div>'
          + '<div class="holding-detail"><div class="label">Mottatt utbytte</div><div class="value' + (h.totalDividendsReceived > 0 ? '' : ' text-muted') + '">' + (h.totalDividendsReceived > 0 ? formatCurrency(h.totalDividendsReceived) : '—') + '</div></div>'
          + '<div class="holding-detail"><div class="label">Andel av portefølje</div><div class="value">' + sharePct + '%</div></div>'
          + this.renderMarketStats(inst?.ticker || h.ticker)
          + this.renderHoldingTransactions(h.isin)
          + '<div class="holding-actions"><button class="btn btn-small holding-add-trade" data-isin="' + h.isin + '">+ Legg til transaksjon</button></div>'
          + '</div>';
      }).join('')
      + '</div>';
  }

  private renderMarketStats(ticker: string): string {
    const safeTicker = ticker.replace(/\./g, '_');
    const isStock = !ticker.includes('.IR');
    const newswebTicker = ticker.replace('.OL', '');
    return '<div class="market-stats" id="mstats-' + safeTicker + '">'
      + '<div class="holding-detail"><div class="label">I dag</div><div class="value text-muted" id="mstat-day-' + safeTicker + '">...</div></div>'
      + '<div class="holding-detail"><div class="label">52 uker</div><div class="value text-muted" id="mstat-52w-' + safeTicker + '">...</div></div>'
      + '<div class="holding-detail"><div class="label">Volum</div><div class="value text-muted" id="mstat-vol-' + safeTicker + '">...</div></div>'
      + '<div class="holding-detail"><div class="label">P/E</div><div class="value text-muted" id="mstat-pe-' + safeTicker + '">...</div></div>'
      + '<div class="holding-detail"><div class="label">P/B</div><div class="value text-muted" id="mstat-pb-' + safeTicker + '">...</div></div>'
      + '<div class="holding-detail"><div class="label">Markedsverdi</div><div class="value text-muted" id="mstat-mcap-' + safeTicker + '">...</div></div>'
      + '<div class="holding-detail"><div class="label">Utbytterate</div><div class="value text-muted" id="mstat-divy-' + safeTicker + '">...</div></div>'
      + '<div class="holding-detail"><div class="label">Margin</div><div class="value text-muted" id="mstat-margin-' + safeTicker + '">...</div></div>'
      + (isStock ? '<div class="market-stats-link"><a href="https://newsweb.oslobors.no/search?issuer=' + newswebTicker + '" target="_blank" rel="noopener">Se børsmeldinger ›</a></div>' : '')
      + '</div>';
  }

  private loadMarketStats(ticker: string): void {
    const safeTicker = ticker.replace(/\./g, '_');

    // 1. Load from static data first (instant, has fundamentals)
    fetchMarketData(ticker).then(md => {
      if (md) this.fillMarketData(safeTicker, md);
    });
    fetchFundamentals(ticker).then(f => {
      if (f) this.fillFundamentals(safeTicker, f);
    });

    // 2. Then try live quote for fresh daily data
    const cached = this.quoteCache.get(ticker);
    if (cached) {
      this.fillLiveQuote(safeTicker, cached);
    } else {
      fetchStockQuote(ticker).then(quote => {
        if (!quote) return;
        this.quoteCache.set(ticker, quote);
        this.fillLiveQuote(safeTicker, quote);
      });
    }
  }

  private fillMarketData(safeTicker: string, md: { previousClose: number | null; dayHigh: number | null; dayLow: number | null; volume: number | null; fiftyTwoWeekHigh: number | null; fiftyTwoWeekLow: number | null }): void {
    const w52El = document.getElementById('mstat-52w-' + safeTicker);
    const volEl = document.getElementById('mstat-vol-' + safeTicker);
    if (w52El && md.fiftyTwoWeekLow !== null && md.fiftyTwoWeekHigh !== null) {
      w52El.className = 'value';
      w52El.textContent = formatCurrency(md.fiftyTwoWeekLow, 2) + ' — ' + formatCurrency(md.fiftyTwoWeekHigh, 2);
    }
    if (volEl && md.volume !== null) {
      volEl.className = 'value';
      volEl.textContent = md.volume.toLocaleString('nb-NO');
    }
  }

  private fillFundamentals(safeTicker: string, f: Fundamentals): void {
    const peEl = document.getElementById('mstat-pe-' + safeTicker);
    const pbEl = document.getElementById('mstat-pb-' + safeTicker);
    const mcapEl = document.getElementById('mstat-mcap-' + safeTicker);
    const divyEl = document.getElementById('mstat-divy-' + safeTicker);
    const marginEl = document.getElementById('mstat-margin-' + safeTicker);

    if (peEl) {
      peEl.className = 'value';
      peEl.textContent = f.trailingPE ? f.trailingPE.toFixed(1) : (f.forwardPE ? f.forwardPE.toFixed(1) + ' (fwd)' : '—');
    }
    if (pbEl) {
      pbEl.className = 'value';
      pbEl.textContent = f.priceToBook ? f.priceToBook.toFixed(2) : '—';
    }
    if (mcapEl && f.marketCap) {
      mcapEl.className = 'value';
      if (f.marketCap >= 1e12) mcapEl.textContent = (f.marketCap / 1e12).toFixed(1) + ' bill kr';
      else if (f.marketCap >= 1e9) mcapEl.textContent = (f.marketCap / 1e9).toFixed(1) + ' mrd kr';
      else mcapEl.textContent = (f.marketCap / 1e6).toFixed(0) + ' mill kr';
    }
    if (divyEl) {
      divyEl.className = 'value';
      divyEl.textContent = f.dividendYield ? (f.dividendYield * 100).toFixed(2) + '%' : '—';
    }
    if (marginEl) {
      marginEl.className = 'value';
      marginEl.textContent = f.profitMargins ? (f.profitMargins * 100).toFixed(1) + '%' : '—';
    }
  }

  private fillLiveQuote(safeTicker: string, q: StockQuote): void {
    const dayEl = document.getElementById('mstat-day-' + safeTicker);
    const w52El = document.getElementById('mstat-52w-' + safeTicker);
    const volEl = document.getElementById('mstat-vol-' + safeTicker);

    if (dayEl && q.dayChange !== null && q.dayChangePct !== null) {
      const sign = q.dayChange >= 0 ? '+' : '';
      const cls = q.dayChange >= 0 ? 'text-success' : 'text-danger';
      dayEl.className = 'value ' + cls;
      dayEl.textContent = sign + q.dayChange.toFixed(2) + ' (' + sign + q.dayChangePct.toFixed(2) + '%)';
    }
    if (w52El && q.weekLow52 !== null && q.weekHigh52 !== null) {
      w52El.className = 'value';
      w52El.textContent = formatCurrency(q.weekLow52, 2) + ' — ' + formatCurrency(q.weekHigh52, 2);
    }
    if (volEl && q.volume !== null) {
      volEl.className = 'value';
      volEl.textContent = q.volume.toLocaleString('nb-NO');
    }
  }

  private renderHoldingTransactions(isin: string): string {
    const events = this.ledger.events
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

  private renderHoldingChart(
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
    const holdingEvents = this.ledger.events
      .filter(e => 'isin' in e && (e as unknown as { isin: string }).isin === isin)
      .sort((a, b) => a.date.localeCompare(b.date));

    const firstBuyDate = holdingEvents.find(e => e.type === 'TRADE_BUY')?.date;
    if (!firstBuyDate) return;

    // Build position value over time: replay events to track qty, then qty × price
    // Start from first buy date
    const data: Array<{ date: string; value: number; price: number; qty: number; invested: number }> = [];
    let qty = 0;
    let totalInvested = 0;
    let eventIdx = 0;

    for (const p of allPrices) {
      if (p.date < firstBuyDate) continue;

      // Replay events up to this date
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

    // Setup area HTML
    area.innerHTML = '<canvas id="hcanvas-' + isin + '"></canvas>'
      + '<div class="chart-crosshair" id="hcross-' + isin + '"></div>';

    // Default info — show return since YOUR first buy
    if (infoEl) {
      const sign = returnPct >= 0 ? '+' : '';
      infoEl.innerHTML = '<span class="chart-return ' + (isPositive ? 'text-success' : 'text-danger') + '">'
        + sign + returnPct.toFixed(1) + '% siden kjøp ' + formatDateShort(firstBuyDate) + '</span>';
    }

    // Draw chart — position VALUE over time, not just price
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

    // Build smooth curve points — using position VALUE, not price
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

    // Invested amount line (dashed) — shows your total invested for comparison
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

    // Touch interaction — show info below chart, no floating tooltip
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

  private renderPortfolioChartSVG(): string {
    if (!this.portfolioHistory || this.portfolioHistory.series.length < 2) return '';
    const data = this.portfolioHistory.series;

    const firstVal = data[0].value;
    const lastVal = data[data.length - 1].value;
    const isPositive = lastVal >= firstVal;
    const color = isPositive ? '#3d8b37' : '#c0392b';
    const returnPct = firstVal > 0 ? ((lastVal - firstVal) / firstVal * 100) : 0;
    const returnSign = returnPct >= 0 ? '+' : '';

    // Build legend from actual events
    const events = this.portfolioHistory.events;
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

  private drawPortfolioChart(): void {
    const canvas = document.getElementById('portfolio-canvas') as HTMLCanvasElement | null;
    const chartArea = document.getElementById('chart-area') as HTMLElement | null;
    if (!canvas || !chartArea || !this.portfolioHistory) return;

    const data = this.portfolioHistory.series;
    const events = this.portfolioHistory.events;
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
    const pad = { top: 12, bottom: 12, left: 0, right: 0 };
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

    // Event markers — colored dots on the line
    for (const ev of events) {
      const idx = data.findIndex(d => d.date >= ev.date);
      if (idx < 0) continue;
      const x = pts[idx].x, y = pts[idx].y;
      const dotColor = ev.type === 'TRADE_BUY' ? '#5a9a6e'
        : ev.type === 'TRADE_SELL' ? '#c75450' : '#da7756';
      // White border
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      // Colored fill
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();
    }
  }

  private attachChartInteraction(): void {
    const chartArea = document.getElementById('chart-area');
    const crosshair = document.getElementById('chart-crosshair');
    const scrubber = document.getElementById('chart-scrubber-text');
    if (!chartArea || !crosshair || !scrubber || !this.portfolioHistory) return;

    const data = this.portfolioHistory.series;
    const events = this.portfolioHistory.events;
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

      // Check for events at this date
      const eventsOnDate = events.filter(e => {
        const eIdx = data.findIndex(d => d.date >= e.date);
        return eIdx === idx;
      });
      let eventText = '';
      for (const ev of eventsOnDate) {
        const tl = ev.type === 'TRADE_BUY' ? 'Kjøp' : ev.type === 'TRADE_SELL' ? 'Salg' : 'Utbytte';
        eventText += ' · ' + tl + ' ' + formatCurrency(ev.amount);
      }

      scrubber.className = 'chart-scrubber-active';
      scrubber.innerHTML = '<span class="scrub-date">' + formatDateShort(point.date) + '</span>'
        + '<span class="scrub-value">' + formatCurrency(point.value) + '</span>'
        + '<span class="' + pctClass + '">' + returnSign + returnPct.toFixed(1) + '%</span>'
        + (eventText ? '<span class="scrub-event">' + eventText + '</span>' : '');
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

  private renderDividendList(): string {
    if (!this.dividendSummary || this.dividendSummary.totalAllTime === 0) return '';
    const ds = this.dividendSummary;

    // Year bars — visual bar chart
    const maxYear = Math.max(...ds.byYear.map(y => y.total));
    const yearBars = ds.byYear.map(y => {
      const pct = maxYear > 0 ? (y.total / maxYear) * 100 : 0;
      return '<div class="div-year-row">'
        + '<span class="div-year-label">' + y.year + '</span>'
        + '<div class="div-year-bar-bg"><div class="div-year-bar" style="width:' + pct.toFixed(1) + '%"></div></div>'
        + '<span class="div-year-amount">' + formatCurrency(y.total) + '</span>'
        + '</div>';
    }).join('');

    // Per holding — compact list with yield on cost
    const holdingRows = ds.byHolding.map(h => {
      const inst = this.ledger.instruments.find(i => i.isin === h.isin);
      const isFund = inst?.instrumentType === 'FUND';
      const label = isFund ? h.name : h.ticker;
      const yoc = h.yieldOnCost !== null ? h.yieldOnCost.toFixed(1) + '%' : '—';
      return '<div class="div-holding-row">'
        + '<span class="div-holding-name">' + label + '</span>'
        + '<span class="div-holding-yoc">' + yoc + '</span>'
        + '<span class="div-holding-amount">' + formatCurrency(h.total) + '</span>'
        + '</div>';
    }).join('');

    // Individual transactions (collapsed by default)
    const dividends = this.ledger.events
      .filter(e => e.type === 'DIVIDEND')
      .sort((a, b) => b.date.localeCompare(a.date));

    const txnRows = dividends.map(e => {
      const de = e as unknown as { isin: string };
      const inst = this.ledger.instruments.find(i => i.isin === de.isin);
      const isFund = inst?.instrumentType === 'FUND';
      const name = isFund ? inst?.name || de.isin : inst?.ticker || de.isin;
      return '<div class="txn-row">'
        + '<span class="txn-date">' + formatDateShort(e.date) + '</span>'
        + '<span class="txn-type txn-type-dividend">' + name + '</span>'
        + '<span class="txn-amount">' + formatCurrency(e.amount) + '</span>'
        + '</div>';
    }).join('');

    return '<div class="dividend-list">'
      + '<div class="txn-header">Utbytter</div>'
      // By year
      + '<div class="div-year-chart">' + yearBars + '</div>'
      // By holding
      + (ds.byHolding.length > 1
        ? '<div class="div-by-holding">'
          + '<div class="div-holding-header">'
          + '<span>Beholdning</span><span>YoC</span><span>Totalt</span>'
          + '</div>'
          + holdingRows
          + '</div>'
        : '')
      // Transactions (expandable)
      + '<div class="div-txn-toggle" id="div-txn-toggle">Vis transaksjoner</div>'
      + '<div class="div-txn-list" id="div-txn-list">' + txnRows + '</div>'
      + '</div>';
  }

  private renderMarketSection(): string {
    const obxDisplay = this.obxPrice !== null ? this.obxPrice.toFixed(2) : '...';

    // Watchlist items — expandable with detail view
    const watchlistItems = this.watchlist.map(w => {
      const stock = this.stockList.find(s => s.ticker === w.ticker);
      const price = stock?.currentPrice;
      const isFund = w.type === 'FUND';
      const label = isFund ? w.name : w.ticker;
      const sublabel = isFund ? 'Fond' : w.name;
      const safeTicker = w.ticker.replace(/\./g, '_');
      return '<div class="watchlist-card" data-ticker="' + w.ticker + '">'
        + '<div class="watchlist-item">'
        + '<div class="watchlist-info">'
        + '<div class="watchlist-ticker">' + label + '</div>'
        + '<div class="watchlist-name">' + sublabel + '</div>'
        + '</div>'
        + '<div class="watchlist-values">'
        + (price ? '<div class="watchlist-price">' + price.toFixed(2) + '</div>' : '<div class="watchlist-price text-muted">—</div>')
        + '</div>'
        + '</div>'
        // Expandable detail — same layout as holding details
        + '<div class="holding-details" id="sdetail-' + safeTicker + '">'
        + '<div class="holding-chart-wrap">'
        + '<div class="holding-chart-info" id="sdinfo-' + safeTicker + '"></div>'
        + '<div class="holding-chart-area" id="sdchart-' + safeTicker + '"><div class="sparkline-placeholder">Laster graf...</div></div>'
        + '</div>'
        + '<div class="holding-detail"><div class="label">Kurs</div><div class="value">' + (price ? formatCurrency(price, 2) : '—') + '</div></div>'
        + '<div class="holding-detail"><div class="label">Type</div><div class="value">' + (isFund ? 'Fond' : 'Aksje') + '</div></div>'
        + this.renderMarketStats(w.ticker)
        + '<div class="holding-actions">'
        + '<button class="btn btn-small holding-add-trade stock-buy" data-ticker="' + w.ticker + '">+ Kjøp</button>'
        + '<button class="btn btn-small watchlist-remove-link" data-ticker="' + w.ticker + '">Fjern fra følgeliste</button>'
        + '</div>'
        + '</div>'
        + '</div>';
    }).join('');

    // Popular suggestions when watchlist is small
    const POPULAR = ['EQNR', 'DNB', 'MOWI', 'YAR', 'TEL', 'ORK'];
    const suggestTickers = POPULAR.filter(t => !this.watchlist.some(w => w.ticker === t));
    const suggestions = suggestTickers.length > 0 && this.stockList.length > 0
      ? '<div class="suggestions-label">Populære</div>'
        + '<div class="suggestions-chips">'
        + suggestTickers.slice(0, 4).map(t => {
          const s = this.stockList.find(x => x.ticker === t);
          return s ? '<button class="suggestion-chip" data-ticker="' + t + '">' + t + '</button>' : '';
        }).join('')
        + '</div>'
      : '';

    return '<div class="card-header"><h2>Følgeliste</h2><button class="btn btn-small btn-outline" id="add-watchlist">+ Legg til</button></div>'
      + '<div class="card watchlist-list">'
      + '<div class="watchlist-item obx-item">'
      + '<div class="watchlist-info"><div class="watchlist-ticker">OBX</div><div class="watchlist-name">Oslo Børs</div></div>'
      + '<div class="watchlist-values"><div class="watchlist-price" id="obx-price">' + obxDisplay + '</div></div>'
      + '</div>'
      + watchlistItems
      + (this.watchlist.length === 0 ? '<div class="watchlist-empty-hint">Søk og legg til aksjer eller fond du vil følge med på</div>' : '')
      + '</div>'
      + suggestions
      // Inline search
      + '<div class="watchlist-search" id="watchlist-search" style="display:none">'
      + '<div class="search-wrapper"><input type="text" id="watchlist-ticker" class="form-control" placeholder="Søk etter aksje eller fond..." autocapitalize="characters" autocorrect="off" spellcheck="false" autocomplete="off">'
      + '<div class="search-suggestions" id="watchlist-suggestions"></div></div></div>';
  }

  private loadStockDetailChart(ticker: string, safeTicker: string): void {
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

    this.ledger = LedgerStorage.loadLedger() || this.ledger;
    this.updateDerivedData();
    this.hideTradeModal();
    this.render();
    this.attachEventListeners();
    this.refreshPrices();

    // Auto-register historical dividends for buy trades
    if (type === 'TRADE_BUY') {
      this.autoRegisterDividends(ticker, isin, date);
    }
  }

  private async autoRegisterDividends(ticker: string, isin: string, buyDate: string): Promise<void> {
    const dividends = await fetchDividendHistory(ticker);
    if (!dividends || dividends.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const accountId = this.ledger.accounts[0]?.id || 'default';
    const now = new Date().toISOString();

    // Get existing dividend event dates for this ISIN to avoid duplicates
    const existingDivDates = new Set(
      this.ledger.events
        .filter(e => e.type === 'DIVIDEND' && 'isin' in e && (e as unknown as { isin: string }).isin === isin)
        .map(e => e.date)
    );

    // For each dividend after buy date, compute qty held at that date and register
    const newDividends: Array<{ date: string; amount: number; qty: number; perShare: number }> = [];

    for (const div of dividends) {
      if (div.date < buyDate || div.date > today) continue;
      if (existingDivDates.has(div.date)) continue;

      // Compute qty held at this dividend date by replaying all events for this ISIN
      let qtyAtDate = 0;
      for (const e of this.ledger.events) {
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

    // Register all dividend events
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
    this.ledger = LedgerStorage.loadLedger() || this.ledger;
    this.updateDerivedData();
    this.render();
    this.attachEventListeners();
    this.computePortfolioHistory();
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
        // Normalize: strip diacritics (ö→o, é→e etc) for matching
        const normalize = (str: string) => str.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const query = normalize(tickerInput.value.trim());
        this.selectedSuggestionIndex = -1;
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

  private showTradeModal(mode: 'simple' | 'full' = 'simple', prefill?: { ticker: string; name: string; isin: string; instrumentType: 'STOCK' | 'FUND' }): void {
    this.tradeModalMode = mode;
    // Re-render modal with correct mode, then show it
    const modal = document.getElementById('trade-modal');
    if (modal) {
      modal.outerHTML = this.renderTradeModal();
      this.attachTradeModalListeners();
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
        this.updatePriceForSelectedStock();
      }
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
    const today = new Date().toISOString().split('T')[0];
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];
    const vpsUrl = 'https://investor.vps.no/vip/#/transactions?size=200&page=0&settledDateFrom=' + yearAgo + '&settledDateTo=' + today + '&settled=false';

    return '<div class="modal" id="import-modal"><div class="modal-content"><div class="modal-header"><h3>Importer transaksjoner</h3></div>'
      + '<div class="import-vps"><a href="' + vpsUrl + '" target="_blank" rel="noopener" class="btn btn-outline btn-large import-vps-btn">Åpne VPS Investortjenester</a>'
      + '<p class="text-muted text-small">Logg inn med BankID → Trykk Export → Last opp filen under</p></div>'
      + '<div class="form-group"><label class="file-upload" id="file-upload-label"><input type="file" id="csv-file" accept=".csv,.txt,.xlsx,.xls"><span class="file-upload-text">Last opp VPS-eksport (.xlsx) eller CSV</span></label></div>'
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

    // Period selector pills
    document.querySelectorAll('.period-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const period = (pill as HTMLElement).dataset.period as ReturnPeriod;
        if (period && period !== this.selectedPeriod) {
          this.selectedPeriod = period;
          // Update only the summary hero without full re-render
          const summaryCard = document.querySelector('.summary-hero');
          if (summaryCard) {
            this.render();
            this.attachEventListeners();
            this.reattachChartIfNeeded();
          }
        }
      });
    });

    // Holding cards — click to expand details
    document.querySelectorAll('.holding-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't toggle if clicking a price input
        if ((e.target as HTMLElement).classList.contains('price-input')) return;
        const isin = (card as HTMLElement).dataset.isin;
        const details = document.getElementById('details-' + isin);
        if (details) {
          details.classList.toggle('active');
          // Load holding chart on first expand
          if (details.classList.contains('active')) {
            const chartWrap = details.querySelector('.holding-chart-wrap') as HTMLElement | null;
            if (chartWrap && !chartWrap.querySelector('canvas')) {
              const ticker = chartWrap.dataset.ticker;
              const hIsin = chartWrap.dataset.isin || '';
              const avgCost = parseFloat(chartWrap.dataset.cost || '0');
              if (ticker) {
                fetchPriceHistory(ticker).then(prices => {
                  if (!details.classList.contains('active')) return;
                  if (prices.length >= 2) {
                    this.renderHoldingChart(hIsin, ticker, prices, avgCost);
                  } else {
                    const area = chartWrap.querySelector('.holding-chart-area');
                    if (area) area.innerHTML = '<span class="text-muted text-small">Ingen prishistorikk</span>';
                  }
                });
              }
            }
            // Load market stats
            const mstats = details.querySelector('.market-stats') as HTMLElement | null;
            if (mstats && mstats.querySelector('.text-muted')) {
              const chartWrap2 = details.querySelector('.holding-chart-wrap') as HTMLElement | null;
              const t = chartWrap2?.dataset.ticker;
              if (t) this.loadMarketStats(t);
            }
          }
        }
      });
    });

    // Quick-add transaction from holding detail
    document.querySelectorAll('.holding-add-trade').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isin = (btn as HTMLElement).dataset.isin;
        const inst = this.ledger.instruments.find(i => i.isin === isin);
        if (inst) {
          this.showTradeModal('full', {
            ticker: inst.ticker,
            name: inst.name,
            isin: inst.isin,
            instrumentType: inst.instrumentType || 'STOCK',
          });
        }
      });
    });

    // Delete transaction
    document.querySelectorAll('.txn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const eventId = (btn as HTMLElement).dataset.eventId;
        if (!eventId) return;
        if (!confirm('Er du sikker på at du vil slette denne transaksjonen?')) return;
        LedgerStorage.deleteEvent(eventId);
        this.ledger = LedgerStorage.loadLedger() || this.ledger;
        this.updateDerivedData();
        this.render();
        this.attachEventListeners();
        this.computePortfolioHistory();
      });
    });

    // Edit transaction — open trade modal pre-filled with event data
    document.querySelectorAll('.txn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const eventId = (btn as HTMLElement).dataset.eventId;
        if (!eventId) return;
        const event = this.ledger.events.find(ev => ev.id === eventId);
        if (!event) return;
        const te = event as unknown as { isin?: string; quantity?: number; pricePerShare?: number; fee?: number };
        const inst = te.isin ? this.ledger.instruments.find(i => i.isin === te.isin) : null;

        // Open trade modal in full mode
        this.showTradeModal('full', inst ? {
          ticker: inst.ticker,
          name: inst.name,
          isin: inst.isin,
          instrumentType: inst.instrumentType || 'STOCK',
        } : undefined);

        // Pre-fill the form with event data after modal renders
        setTimeout(() => {
          const dateInput = document.getElementById('trade-date') as HTMLInputElement;
          const priceInput = document.getElementById('trade-price') as HTMLInputElement;
          const qtyInput = document.getElementById('trade-qty') as HTMLInputElement;
          const feeInput = document.getElementById('trade-fee') as HTMLInputElement;
          const typeInput = document.getElementById('trade-type') as HTMLInputElement;

          if (dateInput) dateInput.value = event.date;
          if (priceInput && te.pricePerShare) { priceInput.value = te.pricePerShare.toString(); priceInput.dispatchEvent(new Event('input')); }
          if (qtyInput && te.quantity) { qtyInput.value = te.quantity.toString(); qtyInput.dispatchEvent(new Event('input')); }
          if (feeInput && te.fee) feeInput.value = te.fee.toString();

          // Set trade type tab
          if (typeInput) typeInput.value = event.type;
          document.querySelectorAll('.trade-tab').forEach(tab => {
            tab.classList.toggle('active', (tab as HTMLElement).dataset.type === event.type);
          });

          // Store the old event ID so submit can delete-then-add
          const submitBtn = document.getElementById('submit-trade');
          if (submitBtn) submitBtn.dataset.replaceEventId = eventId;
        }, 100);
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

    // Watchlist listeners
    document.getElementById('add-watchlist')?.addEventListener('click', () => {
      const searchEl = document.getElementById('watchlist-search');
      if (searchEl) {
        searchEl.style.display = searchEl.style.display === 'none' ? 'block' : 'none';
        if (searchEl.style.display === 'block') {
          document.getElementById('watchlist-ticker')?.focus();
        }
      }
    });

    document.querySelectorAll('.watchlist-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticker = (btn as HTMLElement).dataset.ticker;
        if (ticker) this.removeFromWatchlist(ticker);
      });
    });

    // Watchlist cards — click to expand inline detail
    document.querySelectorAll('.watchlist-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('watchlist-remove-link') || target.classList.contains('stock-buy')) return;
        const ticker = (card as HTMLElement).dataset.ticker || '';
        const safeTicker = ticker.replace(/\./g, '_');
        const detail = document.getElementById('sdetail-' + safeTicker);
        if (!detail) return;
        detail.classList.toggle('active');
        if (detail.classList.contains('active')) {
          if (!detail.querySelector('canvas')) this.loadStockDetailChart(ticker, safeTicker);
          this.loadMarketStats(ticker);
        }
      });
    });

    // Buy buttons in watchlist detail
    document.querySelectorAll('.stock-buy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticker = (btn as HTMLElement).dataset.ticker;
        const stock = this.stockList.find(s => s.ticker === ticker);
        if (stock) {
          const inst = this.ledger.instruments.find(i => i.ticker === ticker);
          this.showTradeModal('full', { ticker: stock.ticker, name: stock.name, isin: inst?.isin || '', instrumentType: stock.type });
        }
      });
    });

    // Remove from watchlist (text link inside detail)
    document.querySelectorAll('.watchlist-remove-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticker = (btn as HTMLElement).dataset.ticker;
        if (ticker) this.removeFromWatchlist(ticker);
      });
    });

    // Popular suggestion chips — add to watchlist
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const ticker = (chip as HTMLElement).dataset.ticker;
        const stock = this.stockList.find(s => s.ticker === ticker);
        if (stock) this.addToWatchlist(stock);
      });
    });

    // Watchlist search
    const wInput = document.getElementById('watchlist-ticker') as HTMLInputElement | null;
    const wSuggestions = document.getElementById('watchlist-suggestions') as HTMLElement | null;
    if (wInput && wSuggestions) {
      wInput.addEventListener('input', () => {
        const query = wInput.value.trim().toUpperCase();
        if (query.length === 0) { wSuggestions.innerHTML = ''; wSuggestions.classList.remove('active'); return; }
        const queryWords = query.split(/\s+/).filter(w => w.length > 0);
        const matches = this.stockList
          .filter(s => {
            // Exclude already-watched and already-held instruments
            if (this.watchlist.some(w => w.ticker === s.ticker)) return false;
            const held = this.ledger.instruments.find(i => i.ticker === s.ticker);
            if (held && this.holdings.some(h => h.isin === held.isin)) return false;
            const combined = (s.ticker + ' ' + s.name).toUpperCase();
            return queryWords.every(w => combined.includes(w));
          })
          .slice(0, 6);
        if (matches.length === 0) {
          wSuggestions.innerHTML = '<div class="suggestion-empty">Ingen treff</div>';
          wSuggestions.classList.add('active');
          return;
        }
        wSuggestions.innerHTML = matches.map(s => {
          const isFund = s.type === 'FUND';
          const badge = isFund ? '<span class="suggestion-badge">Fond</span>' : '';
          const label = isFund ? s.name : s.ticker;
          const sublabel = isFund ? '' : '<span class="suggestion-name">' + s.name + '</span>';
          return '<button class="suggestion-item" type="button">'
            + '<span class="suggestion-ticker">' + label + '</span>'
            + badge + sublabel
            + (s.currentPrice ? '<span class="suggestion-price">' + s.currentPrice.toFixed(2) + '</span>' : '')
            + '</button>';
        }).join('');
        wSuggestions.classList.add('active');
        wSuggestions.querySelectorAll('.suggestion-item').forEach((item, i) => {
          item.addEventListener('click', () => {
            this.addToWatchlist(matches[i]);
            wInput.value = '';
            wSuggestions.innerHTML = '';
            wSuggestions.classList.remove('active');
            document.getElementById('watchlist-search')!.style.display = 'none';
          });
        });
      });
    }
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
    let result;
    if (isVPSFile(file)) {
      const buffer = await file.arrayBuffer();
      // Resolve ticker from stock list by matching security name
      const tickerLookup = (name: string) => {
        const upper = name.toUpperCase();
        const match = this.stockList.find(s =>
          s.name.toUpperCase() === upper
          || s.name.toUpperCase().includes(upper)
          || upper.includes(s.name.toUpperCase())
          || upper.includes(s.ticker)
        );
        return match ? { ticker: match.ticker, type: match.type } : null;
      };
      result = parseVPSExport(buffer, this.ledger.accounts[0]?.id || 'default', tickerLookup);
      if (result.errors.length > 0 && result.events.length === 0) {
        alert('Feil i filen:\n\n' + result.errors.map(e => e.message).join('\n'));
        return;
      }
    } else {
      const content = await file.text();
      const errors = validateCSV(content);
      if (errors.length > 0) { alert('Feil i filen:\n\n' + errors.join('\n')); return; }
      result = parseCSV(content, this.ledger.accounts[0]?.id || 'default');
    }
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
