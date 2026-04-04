#!/usr/bin/env node

/**
 * Tally Stock Data Fetcher
 *
 * Fetches historical prices and dividends from Yahoo Finance for Norwegian stocks.
 * Stores data as static JSON files in public/data/ for the app to consume.
 *
 * Usage:
 *   node scripts/fetch-stock-data-v2.js                    # Incremental (last 5 days)
 *   node scripts/fetch-stock-data-v2.js --full-update      # Full history (5 years)
 *   node scripts/fetch-stock-data-v2.js --dividends-only   # Only update dividends
 *   node scripts/fetch-stock-data-v2.js --symbols=EQNR,DNB # Specific symbols only
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// --- Configuration ---

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');

// Norwegian stocks on Oslo Børs (OBX, main list, Euronext Growth)
// This is a comprehensive list — Yahoo Finance will return errors for
// delisted or invalid tickers, which are silently skipped.
const DEFAULT_SYMBOLS = [
  // OBX 25 (most traded)
  'EQNR', 'DNB', 'TEL', 'MOWI', 'YAR', 'ORK', 'NHY', 'AKRBP',
  'GJF', 'SALM', 'STB', 'KOG', 'SUBC', 'FRO', 'GOGL', 'NAS',
  'AKER', 'BAKKA', 'LSG', 'SCATC', 'TOM', 'AUSS', 'GSF', 'VOW',
  'HAFNI',
  // Large & mid cap
  'ABG', 'AKSO', 'ATEA', 'ADE', 'AFC', 'AMSC', 'ARCH', 'ASTK',
  'AUTO', 'BELCO', 'BEWI', 'BGBIO', 'BONHR', 'BORR', 'BRG',
  'BWO', 'CADLR', 'CLOUD', 'CONTX', 'CRAYN', 'DNO', 'DOFG',
  'ELK', 'ELMRA', 'ENTRA', 'EPR', 'FLNG', 'FORTE', 'FROY',
  'GIG', 'GOLDEN', 'GRIEG', 'HAUTO', 'HAVI', 'HBC', 'HDLY',
  'HYON', 'IDEX', 'KAHOT', 'KIT', 'KOA', 'KOMPX', 'KVLP',
  'LINK', 'MPCC', 'MPC', 'MULTI', 'NAPA', 'NASS', 'NEXT',
  'NHPC', 'NOD', 'NORBT', 'NSKOG', 'OET', 'OLT', 'ORK',
  'PARB', 'PCIB', 'PEN', 'PEXIP', 'PHO', 'PGS', 'PLCS',
  'POL', 'PROT', 'PSE', 'QFR', 'RAKP', 'RECSI', 'SACAM',
  'SATS', 'SBO', 'SCHA', 'SDRL', 'SHLF', 'SIKRI', 'SKUE',
  'SMCRT', 'SNI', 'SOFR', 'SRBNK', 'SSO', 'STATT', 'SUBC',
  'TEKNA', 'THIN', 'TGS', 'ULTI', 'VAR', 'VEI', 'VERDE',
  'VOLUE', 'VGM', 'WAWI', 'WSTEP', 'WWI', 'ZAPTEC',
  // Euronext Growth (smaller companies)
  'AASB', 'AGLX', 'AIRX', 'ALCOA', 'AYFIE', 'BFISH', 'BMEDI',
  'CXENSE', 'ECIT', 'EFUEL', 'ENDUR', 'EXACT', 'FKRAFT', 'HPUR',
  'HUDYA', 'ICG', 'INIFY', 'KALERA', 'KMCP', 'KOLR', 'LUMI',
  'MORPOL', 'MSEIS', 'NORAM', 'NYKD', 'ODF', 'OKEA', 'OTEC',
  'OTOVO', 'RANA', 'RIVER', 'SALMON', 'SENTI', 'SPOL', 'TECO',
  'WBULK',
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
  const symbol = ticker.endsWith('.OL') ? ticker : ticker + '.OL';
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

  return {
    ticker: meta.symbol?.replace('.OL', '') || '',
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

function loadExisting(ticker) {
  const file = path.join(DATA_DIR, `${ticker}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function saveStockData(ticker, data) {
  const file = path.join(DATA_DIR, `${ticker}.json`);
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
  const symbolsArg = args.find(a => a.startsWith('--symbols='));
  const symbols = symbolsArg
    ? symbolsArg.split('=')[1].split(',').map(s => s.trim().toUpperCase())
    : DEFAULT_SYMBOLS;

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
      const ticker = file.replace('.json', '');
      if (!allData[ticker]) {
        allData[ticker] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
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
