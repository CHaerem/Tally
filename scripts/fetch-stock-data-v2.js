#!/usr/bin/env node

/**
 * Tally Stock & Fund Data Fetcher
 *
 * Fetches historical prices and dividends from Yahoo Finance for Norwegian stocks
 * and mutual funds. Stores data as static JSON files in public/data/.
 *
 * Usage:
 *   node scripts/fetch-stock-data-v2.js                    # Incremental (stocks + funds)
 *   node scripts/fetch-stock-data-v2.js --full-update      # Full history (10 years)
 *   node scripts/fetch-stock-data-v2.js --funds-only       # Only fetch fund data
 *   node scripts/fetch-stock-data-v2.js --no-funds         # Only fetch stock data
 *   node scripts/fetch-stock-data-v2.js --dividends-only   # Only update dividends
 *   node scripts/fetch-stock-data-v2.js --symbols=EQNR,DNB # Specific symbols only
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// --- Configuration ---

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');

// Norwegian mutual funds (Yahoo Finance Morningstar IDs)
// These use .IR suffix and are fetched separately from stocks
const FUND_SYMBOLS = [
  // DNB
  '0P0000PS3U.IR',  // DNB Norge Indeks
  '0P00000NKJ.IR',  // DNB Norge
  '0P0001EFNB.IR',  // DNB Norge A
  '0P0001EFNG.IR',  // DNB Norge Selektiv
  '0P0001Q8AD.IR',  // DNB Global Indeks
  '0P00000MUA.IR',  // DNB Global Emerging Markets
  '0P00000MVB.IR',  // DNB Teknologi
  '0P0001BJ8T.IR',  // DNB Miljøinvest
  '0P0001CTL0.IR',  // DNB Norden Indeks
  '0P0001EFN5.IR',  // DNB Norden
  '0P0001BJ8N.IR',  // DNB Finans
  '0P00000O4C.IR',  // DNB Barnefond
  '0P0001EFNK.IR',  // DNB Obligasjon
  '0P0001EFNN.IR',  // DNB Obligasjon 20
  '0P00017AUH.IR',  // DNB Global Treasury
  '0P0001F1IM.IR',  // DNB AM Norske Aksjer
  // Storebrand
  '0P0001HAP0.IR',  // Storebrand Norge
  '0P00012AVM.IR',  // Storebrand Indeks Norge
  '0P0001ACQT.IR',  // Storebrand Norge Horisont
  '0P0000A82Y.IR',  // Storebrand Global Indeks
  '0P0001BL9W.IR',  // Storebrand Global Optimised
  '0P00007ZI2.IR',  // Storebrand Global Multifactor
  '0P0001M3YC.IR',  // Storebrand Indeks - Norden
  '0P00000O5V.IR',  // Storebrand Verdi
  '0P0001KO95.IR',  // Storebrand Vekst
  '0P00000O4T.IR',  // Storebrand Aksje Innland
  '0P0000TNI3.IR',  // Storebrand Forsiktig
  '0P0001HAOZ.IR',  // Storebrand Likviditet
  // KLP
  '0P00001BVT.IR',  // KLP AksjeNorge Indeks
  '0P0001OPC5.IR',  // KLP AksjeVerden Indeks
  '0P00018V9L.IR',  // KLP AksjeGlobal Indeks
  '0P0001OPBV.IR',  // KLP AksjeNorden Indeks
  '0P0001OPC2.IR',  // KLP AksjeUSA Indeks
  '0P0001OPBA.IR',  // KLP AksjeEuropa Indeks
  '0P0001OPBE.IR',  // KLP AksjeFremvoksende Markeder Indeks
  '0P0001OPBN.IR',  // KLP AksjeGlobal Mer Samfunnsansvar
  '0P0001OPBH.IR',  // KLP AksjeGlobal Flerfaktor
  '0P0001BWAQ.IR',  // KLP AksjeGlobal Small Cap Indeks
  '0P00006D9Q.IR',  // KLP AksjeAsia Indeks
  '0P00000MY9.IR',  // KLP Obligasjon 5 år
  '0P0001IFZZ.IR',  // KLP Obligasjon 1 år Mer Samfunnsansvar
  '0P00002C94.IR',  // KLP Obligasjon Global
  '0P00000MYB.IR',  // KLP Likviditet
  '0P00019ADK.IR',  // KLP Framtid
  // Nordnet
  '0P000134K7.IR',  // Nordnet Indeksfond Norge
  '0P0001K6NJ.IR',  // Nordnet Indeksfond Global
  '0P0001RMV1.IR',  // Nordnet Global Indeks 125
  '0P0001M5YQ.IR',  // Nordnet Indeksfond Teknologi
  '0P0001K6NB.IR',  // Nordnet Indeksfond Emerging Markets
  // ODIN
  '0P000161CO.IR',  // ODIN Aksje
  '0P00000SVG.IR',  // ODIN Norge
  '0P00000SVE.IR',  // ODIN Norden
  '0P00000O88.IR',  // ODIN Global
  '0P00000SVP.IR',  // ODIN Eiendom
  '0P0001J3OK.IR',  // ODIN Small Cap
  '0P00000OC2.IR',  // ODIN Norsk Obligasjon
  // Nordea
  '0P0001SQM9.IR',  // Nordea Norge Verdi
  '0P0001SQMA.IR',  // Nordea Norge Pluss
  '0P0001TPW6.IR',  // Nordea Stabile Aksjer Global
  '0P0001TPW7.IR',  // Nordea Avkastning
  '0P0001CKST.IR',  // Nordea Global Enhanced
  // Skagen
  '0P00013OX2.IR',  // Skagen Global
  '0P00013OX3.IR',  // Skagen Kon-Tiki
  '0P00013OX6.IR',  // Skagen Vekst
  '0P00015YSS.IR',  // Skagen Focus
  // Holberg
  '0P00000OCZ.IR',  // Holberg Norge
  '0P00000OCX.IR',  // Holberg Global
  '0P0001IZAY.IR',  // Holberg Global Valutasikret
  '0P00000NXT.IR',  // Holberg Obligasjon Norden
  '0P00000OCR.IR',  // Holberg Likviditet
  // Delphi
  '0P00000HCS.IR',  // Delphi Norge
  '0P00005UKR.IR',  // Delphi Global
  '0P0001A1QS.IR',  // Delphi Global Valutasikret
  '0P00000HCV.IR',  // Delphi Kombinasjon
  // Alfred Berg
  '0P00000MT3.IR',  // Alfred Berg Norge
  '0P00000MVR.IR',  // Alfred Berg Gambak
  '0P00000O9F.IR',  // Alfred Berg Gambak Global
  '0P0001EUC3.IR',  // Alfred Berg Gambak Nordic
  '0P00000MSP.IR',  // Alfred Berg Aktiv
  '0P000015PZ.IR',  // Alfred Berg Indeks
  // Arctic
  '0P0000S1O6.IR',  // Arctic Norwegian Equities
  '0P000195U2.IR',  // Arctic Norwegian Value Creation
  '0P00015EZF.IR',  // Arctic Return
  '0P0000RUOV.IR',  // Arctic Nordic Corporate Bond
  '0P0000RUOU.IR',  // Arctic Nordic Investment Grade
  // Handelsbanken
  '0P0001CW9F.IR',  // Handelsbanken Norge
  '0P0001A1QL.IR',  // Handelsbanken Norge A1
  // Pareto
  '0P00000NY6.IR',  // Pareto Aksje Norge
  '0P00001BTH.IR',  // Pareto Global
  '0P00000OAI.IR',  // Pareto Obligasjon
  '0P0000YT99.IR',  // Pareto Nordic Corporate Bond
  // Landkreditt
  '0P00001E5D.IR',  // Landkreditt Aksje Global
  '0P0000Y66P.IR',  // Landkreditt Utbytte
  '0P0001FTOL.IR',  // Landkreditt Norden Utbytte
  '0P00001E5H.IR',  // Landkreditt Høyrente
  '0P0000X9XC.IR',  // Landkreditt Extra
  // PLUSS (Fondsforvaltning)
  '0P00000MXR.IR',  // PLUSS Aksje
  '0P00000MXH.IR',  // PLUSS Markedsverdi
  '0P00000MX1.IR',  // PLUSS Utland Aksje
  '0P0001T9DH.IR',  // PLUSS Obligasjon
  '0P00000MXL.IR',  // PLUSS Likviditet
  // C WorldWide
  '0P00000O6S.IR',  // C WorldWide Norge
  '0P00000SV3.IR',  // C WorldWide Stabile Aksjer
  // Norne
  '0P0001LR0Y.IR',  // Norne Aksje Norge
  '0P0001J97B.IR',  // Norne Aksje Classic
  '0P0001KDPB.IR',  // Norne Rente
  '0P0001LR14.IR',  // Norne Kombi 80
  '0P0001LRWP.IR',  // Norne Kombi 20
  '0P0001LRWQ.IR',  // Norne Kombi 50
  // Fondsfinans
  '0P00000L92.IR',  // Fondsfinans Norge
  '0P00000HII.IR',  // Fondsfinans Aktiv 60/40
  '0P00000HIN.IR',  // Fondsfinans Fornybar Energi
  '0P0001IEW6.IR',  // Fondsfinans Utbytte
  '0P00016NF4.IR',  // Fondsfinans Norden Utbytte
  '0P000131AW.IR',  // Fondsfinans High Yield
  '0P00017UZ2.IR',  // Fondsfinans Obligasjon
  // Eika
  '0P00000HD4.IR',  // Eika Norge
  '0P00000ODT.IR',  // Eika Global
  '0P00000NYF.IR',  // Eika Balansert
  // SpareBank 1
  '0P0001PMGR.IR',  // SpareBank 1 Indeks Global
  '0P0001MLUK.IR',  // SpareBank 1 Norge Verdi
  '0P0001LLD4.IR',  // SpareBank 1 Aksjer Svanemerket
  '0P0000X18D.IR',  // SpareBank 1 Indeks Moderat 50
  '0P0000Z0FJ.IR',  // SpareBank 1 Indeks Forsiktig 25
  // Danske Invest
  '0P0000ZSIB.IR',  // Danske Invest Norsk Kort Obligasjon
  '0P00016RIB.IR',  // Danske Invest Norske Aksjer Inst
  // Carnegie
  '0P0001RTTV.IR',  // Carnegie Global Resilient Small Cap
  // FIRST
  '0P0001IBOU.IR',  // FIRST Veritas
  // Sbanken
  '0P00017BQO.IR',  // Sbanken Framgang Sammen
  // Gjensidige
  '0P0000J7K8.IR',  // Gjensidige Likviditet
];

// Norwegian stocks on Oslo Børs (OBX, main list, Euronext Growth)
// This is a comprehensive list — Yahoo Finance will return errors for
// delisted or invalid tickers, which are silently skipped.
const DEFAULT_SYMBOLS = [
  // === Oslo Børs (XOSL) — Main list ===
  // OBX 25
  'EQNR', 'DNB', 'TEL', 'MOWI', 'YAR', 'ORK', 'NHY', 'AKRBP',
  'GJF', 'SALM', 'STB', 'KOG', 'SUBC', 'FRO', 'GOGL', 'NAS',
  'AKER', 'BAKKA', 'LSG', 'SCATC', 'TOM', 'AUSS', 'GSF', 'VOW',
  'HAFNI',
  // Large cap
  'AUTO', 'HAUTO', 'VAR', 'DOFG', 'ELK', 'ENTRA', 'EPR', 'CADLR',
  'MPCC', 'BEWI', 'BRG', 'PROT', 'KID', 'WAWI', 'LINK', 'PARB',
  'SOFF', 'BWO', 'BWLPG', 'FLNG', 'NEL', 'HEX', 'BORR',
  // Mid cap
  'ABG', 'ACR', 'ADE', 'AFC', 'AFG', 'AFK', 'AKBM', 'AKSO',
  'AKVA', 'AMSC', 'ARCH', 'ASTK', 'ATEA', 'AZT', 'BELCO', 'BGBIO',
  'BIEN', 'BMA', 'BNOR', 'BONHR', 'BOUV', 'BWE', 'CLOUD',
  'CONTX', 'CRAYN', 'DDRIL', 'DNO', 'DVD', 'EAM', 'EIOF',
  'ELMRA', 'ELO', 'EMGS', 'ENDUR', 'EQVA',
  'FORTE', 'FROY', 'GENO', 'GENT', 'GIG', 'GOLDEN', 'GRIEG',
  'HAVI', 'HBC', 'HDLY', 'HYON', 'IDEX', 'ITERA', 'KAHOT',
  'KCC', 'KIT', 'KOA', 'KOMPX', 'KVLP', 'MEDI', 'MGN',
  'MPC', 'MULTI', 'NAPA', 'NASS', 'NEXT', 'NHPC', 'NOD',
  'NORBT', 'NORCO', 'NRC', 'NSKOG', 'OET', 'OKEA', 'OLT',
  'PCIB', 'PEN', 'PEXIP', 'PGS', 'PHO', 'PLCS', 'POL',
  'PSE', 'QFR', 'RAKP', 'RECSI', 'SACAM', 'SADG', 'SATS',
  'SBO', 'SCHA', 'SDRL', 'SEA1', 'SHLF', 'SIKRI', 'SKUE',
  'SMCRT', 'SNI', 'SNTIA', 'SOFR', 'SOR', 'SPOL', 'SRBNK',
  'SSO', 'STATT', 'SVEG', 'TECH', 'TEKNA', 'TGS', 'THIN',
  'ULTI', 'VEI', 'VERDE', 'VISTN', 'VOLUE', 'VGM', 'WBULK',
  'WSTEP', 'WWI', 'XXL', 'ZAPTEC',
  // Small cap / remaining main list
  'ABL', 'ABS', 'ABTEC', 'ACED', 'ADS', 'AFISH', 'AGLX', 'AIX',
  'AKH', 'AKOBO', 'ALNG', 'ANDF', 'APR', 'ARR', 'ASA', 'AURG',
  'B2I', 'BALT', 'BARRA', 'BCS', 'BOR', 'BRUT', 'BSP', 'CAMBI',
  'CAPSL', 'CAPT', 'CAVEN', 'CMBTO', 'CODE', 'COSH', 'CRNA',
  'CYVIZ', 'DELIA', 'DFENS', 'DSRT', 'EISP', 'ELABS', 'ELIMP',
  'ELOO', 'ENERG', 'ENH', 'ENSU', 'ENVIP', 'EXTX', 'FFSB',
  'GEM', 'GEOS', 'GIGA', 'INSTA', 'IWS', 'JACK', 'MORG', 'NKR',
  'NOM', 'NORSE', 'OPRA', 'PRS', 'PROXI', 'SCANA', 'SMOP', 'WEST',
  // === Euronext Expand (MERK) ===
  'AASB', 'AKAST', 'AIRX', 'BFISH', 'BMEDI', 'ECIT', 'EFUEL',
  'EXACT', 'FKRAFT', 'HPUR', 'HUDYA', 'ICG', 'INIFY', 'KALERA',
  'KMCP', 'KOLR', 'LUMI', 'MORPOL', 'MSEIS', 'NORAM', 'NYKD',
  'ODF', 'OTEC', 'OTOVO', 'RANA', 'RIVER', 'SALMON', 'TECO',
  // === Euronext Growth Oslo (XOAS) + additional listings ===
  '2020', '5PG', 'AYFIE', 'CXENSE', 'DLTX', 'GKP', 'GOD', 'GRONG',
  'GYL', 'HAV', 'HELG', 'HERMA', 'HGSB', 'HKY', 'HLNG', 'HSHP',
  'HSPG', 'HUDL', 'HUNT', 'HYN', 'HYPRO', 'IFISH', 'INDCT', 'ININ',
  'IOX', 'ISLAX', 'JAREN', 'JIN', 'KING', 'KLDVK', 'KOMPL', 'KRAB',
  'LIFE', 'LOKO', 'LYTIX', 'MAS', 'MELG', 'MING', 'MNTR', 'MORLD',
  'MPCES', 'MVE', 'MVW', 'NAVA', 'NBX', 'NCOD', 'NISB', 'NOAP',
  'NOFIN', 'NOHAL', 'NOL', 'NONG', 'NORDH', 'NORTH', 'NSOL', 'NTG',
  'NTI', 'OBSRV', 'OCEAN', 'ODFB', 'ODL', 'OMDA', 'ONCIN', 'OSUN',
  'OTL', 'PLGC', 'PLSV', 'PLT', 'PNOR', 'PPG', 'PRYME', 'PUBLI',
  'PYRUM', 'QEC', 'REACH', 'REFL', 'RING', 'ROGS', 'ROM', 'ROMER',
  'SAGA', 'SALME', 'SB1NO', 'SB68', 'SBNOR', 'SCOIN', 'SDSD',
  'SKAND', 'SNOR', 'SOAG', 'SOFTX', 'SOGN', 'SOLON', 'SOMA', 'SPIR',
  'SPOG', 'STECH', 'STRO', 'STST', 'SWON', 'TIETO', 'TINDE', 'TRBO',
  'TRMED', 'TRSB', 'TYVEK', 'VDI', 'VEND', 'VOLUP', 'VTURA', 'VVL',
  'WWIB', 'XPLRA', 'ZAL', 'ZAP', 'ZENA', 'ZLNA',
];

// --- Helpers ---

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location).then(resolve, reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        } else {
          resolve(data);
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// --- Yahoo Finance API ---

async function fetchYahooData(ticker, range = '5y') {
  // Fund tickers already have .IR suffix, stocks need .OL
  const symbol = ticker.includes('.') ? ticker : ticker + '.OL';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
    + `?range=${range}&interval=1d&events=div`;

  console.log(`  Fetching ${symbol} (${range})...`);
  const raw = await fetch(url);
  const json = JSON.parse(raw);

  const result = json.chart?.result?.[0];
  if (!result) {
    throw new Error(`No data for ${symbol}: ${json.chart?.error?.description || 'unknown'}`);
  }

  return result;
}

function parseYahooResult(result) {
  const meta = result.meta;
  const timestamps = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0] || {};
  const dividendEvents = result.events?.dividends || {};

  // Parse daily prices
  const prices = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = quotes.close?.[i];
    if (close == null) continue;
    prices.push({
      date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
      close: Math.round(close * 100) / 100,
    });
  }

  // Parse dividends
  const dividends = [];
  for (const [ts, div] of Object.entries(dividendEvents)) {
    dividends.push({
      date: new Date(Number(ts) * 1000).toISOString().split('T')[0],
      amount: Math.round(div.amount * 100) / 100,
    });
  }
  dividends.sort((a, b) => a.date.localeCompare(b.date));

  // For funds (.IR suffix), keep the full symbol as ticker; for stocks, strip .OL
  const rawSymbol = meta.symbol || '';
  const ticker = rawSymbol.endsWith('.IR') ? rawSymbol : rawSymbol.replace('.OL', '');

  return {
    ticker,
    name: meta.shortName || meta.longName || '',
    currency: meta.currency || 'NOK',
    exchange: meta.exchangeName || 'OSL',
    currentPrice: meta.regularMarketPrice || null,
    prices,
    dividends,
    lastUpdated: new Date().toISOString(),
  };
}

// --- Data merging ---

function mergeStockData(existing, fresh) {
  // Merge prices (keep all unique dates, prefer fresh data)
  const priceMap = new Map();
  for (const p of (existing?.prices || [])) priceMap.set(p.date, p);
  for (const p of fresh.prices) priceMap.set(p.date, p);
  const prices = [...priceMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Merge dividends (keep all unique dates)
  const divMap = new Map();
  for (const d of (existing?.dividends || [])) divMap.set(d.date, d);
  for (const d of fresh.dividends) divMap.set(d.date, d);
  const dividends = [...divMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    ...fresh,
    prices,
    dividends,
  };
}

// Sanitize ticker for filename: replace dots with underscores for fund IDs
function tickerToFilename(ticker) {
  return ticker.replace(/\./g, '_');
}

function loadExisting(ticker) {
  const file = path.join(DATA_DIR, `${tickerToFilename(ticker)}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function saveStockData(ticker, data) {
  const file = path.join(DATA_DIR, `${tickerToFilename(ticker)}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// --- Index file ---

function updateIndex(allData) {
  const symbols = {};
  for (const [ticker, data] of Object.entries(allData)) {
    symbols[ticker] = {
      name: data.name,
      currentPrice: data.currentPrice,
      currency: data.currency,
      priceCount: data.prices.length,
      dividendCount: data.dividends.length,
      firstDate: data.prices[0]?.date || null,
      lastDate: data.prices[data.prices.length - 1]?.date || null,
      lastUpdated: data.lastUpdated,
    };
  }

  const index = {
    metadata: {
      lastUpdated: new Date().toISOString(),
      symbolCount: Object.keys(symbols).length,
    },
    symbols,
  };

  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
  return index;
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const fullUpdate = args.includes('--full-update');
  const dividendsOnly = args.includes('--dividends-only');
  const fundsOnly = args.includes('--funds-only');
  const noFunds = args.includes('--no-funds');
  const symbolsArg = args.find(a => a.startsWith('--symbols='));

  let symbols;
  if (symbolsArg) {
    symbols = symbolsArg.split('=')[1].split(',').map(s => s.trim());
  } else if (fundsOnly) {
    symbols = FUND_SYMBOLS;
  } else if (noFunds) {
    symbols = DEFAULT_SYMBOLS;
  } else {
    symbols = [...DEFAULT_SYMBOLS, ...FUND_SYMBOLS];
  }

  const range = fullUpdate ? '10y' : '5d';

  console.log(`Mode: ${fullUpdate ? 'full' : dividendsOnly ? 'dividends-only' : 'incremental'}`);
  console.log(`Symbols: ${symbols.join(', ')}`);
  console.log(`Range: ${range}`);
  console.log('');

  ensureDir(DATA_DIR);

  const allData = {};
  let successCount = 0;
  let errorCount = 0;

  for (const ticker of symbols) {
    try {
      const existing = loadExisting(ticker);
      const result = await fetchYahooData(ticker, dividendsOnly ? '5y' : range);
      const fresh = parseYahooResult(result);

      const merged = fullUpdate ? fresh : mergeStockData(existing, fresh);
      saveStockData(ticker, merged);
      allData[ticker] = merged;

      const pCount = merged.prices.length;
      const dCount = merged.dividends.length;
      console.log(`  ✓ ${ticker}: ${pCount} priser, ${dCount} utbytter, kurs ${merged.currentPrice}`);
      successCount++;
    } catch (err) {
      console.log(`  ✗ ${ticker}: ${err.message}`);
      // Keep existing data in index
      const existing = loadExisting(ticker);
      if (existing) allData[ticker] = existing;
      errorCount++;
    }

    // Rate limiting — be polite to Yahoo (300ms between requests)
    await sleep(300);
  }

  // Load any existing tickers not in this run
  if (!fullUpdate) {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
      const ticker = data.ticker || file.replace('.json', '');
      if (!allData[ticker]) {
        allData[ticker] = data;
      }
    }
  }

  const index = updateIndex(allData);

  console.log('');
  console.log(`Done: ${successCount} OK, ${errorCount} feil, ${index.metadata.symbolCount} totalt`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
