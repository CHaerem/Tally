#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const YAHOO_ENABLED = process.env.YAHOO_FALLBACK === 'true';
const MAX_CONCURRENT = 5; // Process 5 symbols at a time
const RATE_LIMIT_DELAY = 1100; // 1.1 seconds between batches (stay under 60/min)
const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const INDEX_FILE = path.join(__dirname, '..', 'public', 'data', 'index.json');

if (!FINNHUB_API_KEY) {
    console.error('ERROR: FINNHUB_API_KEY environment variable is not set');
    process.exit(1);
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load existing index or create new one
function loadIndex() {
    if (fs.existsSync(INDEX_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
        } catch (e) {
            console.warn('Failed to load existing index, creating new one');
        }
    }
    return {
        version: '2.0.0',
        lastFullUpdate: null,
        lastIncrementalUpdate: null,
        symbols: {},
        metadata: {
            exchange: 'Oslo Børs',
            source: 'Finnhub',
            updateSchedule: 'Pre-market and post-close on weekdays'
        }
    };
}

// Save index atomically
function saveIndex(index) {
    const tempFile = INDEX_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(index, null, 2));
    fs.renameSync(tempFile, INDEX_FILE);
}

// Save symbol data atomically
function saveSymbolData(symbol, data) {
    const symbolFile = path.join(DATA_DIR, `${symbol}.json`);
    const tempFile = symbolFile + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
    fs.renameSync(tempFile, symbolFile);
}

// Load existing symbol data
function loadSymbolData(symbol) {
    const symbolFile = path.join(DATA_DIR, `${symbol}.json`);
    if (fs.existsSync(symbolFile)) {
        try {
            return JSON.parse(fs.readFileSync(symbolFile, 'utf8'));
        } catch (e) {
            console.warn(`Failed to load data for ${symbol}`);
        }
    }
    return null;
}

// Fetch from Finnhub with retries
async function fetchFromFinnhub(endpoint, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await new Promise((resolve, reject) => {
                const url = `https://finnhub.io/api/v1${endpoint}&token=${FINNHUB_API_KEY}`;
                
                https.get(url, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            try {
                                resolve(JSON.parse(data));
                            } catch (e) {
                                reject(new Error(`Invalid JSON response`));
                            }
                        } else if (res.statusCode === 429) {
                            reject(new Error('Rate limited'));
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                        }
                    });
                }).on('error', reject);
            });
        } catch (error) {
            if (attempt === retries) throw error;
            if (error.message === 'Rate limited') {
                console.log(`Rate limited, waiting 30 seconds before retry ${attempt}/${retries}...`);
                await delay(30000);
            } else {
                await delay(2000 * attempt); // Exponential backoff
            }
        }
    }
}

// Fetch Yahoo Finance dividends as fallback
async function fetchYahooDividends(symbol) {
    if (!YAHOO_ENABLED) return null;
    
    try {
        const osloTicker = `${symbol}.OL`;
        const endDate = Math.floor(Date.now() / 1000);
        const startDate = endDate - (365 * 5 * 24 * 60 * 60); // 5 years
        
        const url = `https://query1.finance.yahoo.com/v7/finance/download/${osloTicker}?period1=${startDate}&period2=${endDate}&interval=1d&events=div`;
        
        return await new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        // Parse CSV
                        const lines = data.split('\n').slice(1); // Skip header
                        const dividends = lines
                            .filter(line => line.trim())
                            .map(line => {
                                const [date, dividend] = line.split(',');
                                return {
                                    date,
                                    amount: parseFloat(dividend),
                                    source: 'yahoo'
                                };
                            });
                        resolve(dividends);
                    } else {
                        resolve(null);
                    }
                });
            }).on('error', () => resolve(null));
        });
    } catch (error) {
        return null;
    }
}

// Auto-discover Oslo Børs symbols
async function discoverOsloSymbols() {
    console.log('Discovering Oslo Børs symbols...');
    
    try {
        const symbols = await fetchFromFinnhub('/stock/symbol?exchange=OL');
        
        if (!symbols || !Array.isArray(symbols)) {
            throw new Error('Invalid symbol list response');
        }
        
        // Filter and map symbols - remove .OL suffix if present
        const osloSymbols = symbols
            .filter(s => s.symbol && s.currency === 'NOK') // Only NOK stocks
            .map(s => ({
                symbol: s.symbol.replace('.OL', ''), // Remove .OL suffix for consistency
                name: s.description || s.symbol,
                type: s.type || 'EQS',
                currency: s.currency || 'NOK',
                figi: s.figi,
                mic: s.mic || 'XOSL'
            }));
        
        console.log(`Found ${osloSymbols.length} NOK symbols on Oslo Børs`);
        return osloSymbols;
    } catch (error) {
        console.error('Failed to discover symbols:', error.message);
        // Return hardcoded fallback list if discovery fails
        return getHardcodedSymbols();
    }
}

// Hardcoded fallback symbols
function getHardcodedSymbols() {
    return [
        { symbol: 'EQNR', name: 'Equinor ASA', type: 'EQS', currency: 'NOK' },
        { symbol: 'DNB', name: 'DNB Bank ASA', type: 'EQS', currency: 'NOK' },
        { symbol: 'TEL', name: 'Telenor ASA', type: 'EQS', currency: 'NOK' },
        { symbol: 'MOWI', name: 'Mowi ASA', type: 'EQS', currency: 'NOK' },
        { symbol: 'YAR', name: 'Yara International ASA', type: 'EQS', currency: 'NOK' },
        { symbol: 'ORK', name: 'Orkla ASA', type: 'EQS', currency: 'NOK' },
        { symbol: 'SALM', name: 'SalMar ASA', type: 'EQS', currency: 'NOK' },
        { symbol: 'NHY', name: 'Norsk Hydro ASA', type: 'EQS', currency: 'NOK' },
        { symbol: 'SNTIA', name: 'Sentia Group ASA', type: 'EQS', currency: 'NOK' },
        // Add more as needed
    ];
}

// Fetch quote for a single stock
async function fetchStockQuote(symbol) {
    try {
        // For Oslo stocks, try with .OL suffix first for NOK prices
        let quote = await fetchFromFinnhub(`/quote?symbol=${symbol}.OL`);
        
        // If .OL doesn't work, try without suffix (might give USD)
        if (!quote || quote.c === 0) {
            quote = await fetchFromFinnhub(`/quote?symbol=${symbol}`);
        }
        
        if (quote && quote.c > 0) {
            return {
                price: quote.c,
                change: quote.d,
                changePercent: quote.dp,
                high: quote.h,
                low: quote.l,
                open: quote.o,
                previousClose: quote.pc,
                timestamp: new Date().toISOString()
            };
        }
        
        return null;
    } catch (error) {
        console.error(`Error fetching quote for ${symbol}:`, error.message);
        return null;
    }
}

// Fetch dividends (incremental)
async function fetchDividends(symbol, existingData) {
    try {
        // Determine date range for incremental update
        let fromDate;
        if (existingData?.dividends?.length > 0) {
            // Get latest dividend date and fetch from there
            const latestDate = existingData.dividends
                .map(d => new Date(d.exDate || d.date))
                .sort((a, b) => b - a)[0];
            fromDate = new Date(latestDate);
            fromDate.setDate(fromDate.getDate() - 7); // Go back 7 days for safety
        } else {
            // Fetch 5 years of history for new symbols
            fromDate = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
        }
        
        const toDate = new Date();
        const from = fromDate.toISOString().split('T')[0];
        const to = toDate.toISOString().split('T')[0];
        
        // Try Finnhub first
        let dividends = [];
        try {
            const finnhubDivs = await fetchFromFinnhub(
                `/stock/dividend2?symbol=${symbol}&from=${from}&to=${to}`
            );
            
            if (finnhubDivs?.data && finnhubDivs.data.length > 0) {
                dividends = finnhubDivs.data.map(d => ({
                    exDate: d.exDate,
                    payDate: d.payDate,
                    recordDate: d.recordDate,
                    declareDate: d.declareDate,
                    amount: d.amount,
                    adjustedAmount: d.adjustedAmount,
                    currency: d.currency,
                    source: 'finnhub'
                }));
            }
        } catch (e) {
            console.log(`Finnhub dividends not available for ${symbol}`);
        }
        
        // Fallback to Yahoo if enabled and no Finnhub data
        if (dividends.length === 0 && YAHOO_ENABLED) {
            const yahooDivs = await fetchYahooDividends(symbol);
            if (yahooDivs && yahooDivs.length > 0) {
                dividends = yahooDivs;
            }
        }
        
        // Merge with existing dividends (remove duplicates)
        if (existingData?.dividends?.length > 0) {
            const existingDates = new Set(
                existingData.dividends.map(d => d.exDate || d.date)
            );
            const newDividends = dividends.filter(d => 
                !existingDates.has(d.exDate || d.date)
            );
            
            dividends = [...existingData.dividends, ...newDividends]
                .sort((a, b) => 
                    new Date(b.exDate || b.date) - new Date(a.exDate || a.date)
                );
        }
        
        return dividends;
    } catch (error) {
        console.error(`Error fetching dividends for ${symbol}:`, error.message);
        return existingData?.dividends || [];
    }
}

// Process a single symbol
async function processSymbol(symbolInfo, index, options = {}) {
    const { symbol, name, type, currency } = symbolInfo;
    const { incremental = true, dividendsOnly = false } = options;
    
    try {
        // Load existing data
        const existingData = loadSymbolData(symbol);
        
        let symbolData = existingData || {
            symbol,
            name,
            type,
            currency,
            quote: null,
            dividends: [],
            history: [],
            metadata: {
                firstFetch: new Date().toISOString(),
                lastUpdate: null,
                dataQuality: 'unknown'
            }
        };
        
        // Skip quote update if dividends-only run
        if (!dividendsOnly) {
            const quote = await fetchStockQuote(symbol);
            if (quote) {
                symbolData.quote = quote;
                
                // Add to history (keep last 30 days for charts)
                if (!symbolData.history) symbolData.history = [];
                symbolData.history.push({
                    date: new Date().toISOString().split('T')[0],
                    ...quote
                });
                
                // Keep only last 30 days
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - 30);
                symbolData.history = symbolData.history.filter(h => 
                    new Date(h.date) >= cutoffDate
                );
            }
        }
        
        // Update dividends (incremental by default)
        if (incremental || dividendsOnly) {
            symbolData.dividends = await fetchDividends(symbol, existingData);
        }
        
        // Update metadata
        symbolData.metadata.lastUpdate = new Date().toISOString();
        symbolData.metadata.dataQuality = symbolData.quote ? 'good' : 'stale';
        
        // Save symbol data
        saveSymbolData(symbol, symbolData);
        
        // Update index
        index.symbols[symbol] = {
            name,
            type,
            currency,
            lastUpdate: symbolData.metadata.lastUpdate,
            hasQuote: !!symbolData.quote,
            hasDividends: symbolData.dividends.length > 0,
            dataQuality: symbolData.metadata.dataQuality
        };
        
        return { success: true, symbol };
    } catch (error) {
        console.error(`Failed to process ${symbol}:`, error.message);
        
        // Mark as failed in index
        index.symbols[symbol] = {
            name,
            type,
            currency,
            lastUpdate: new Date().toISOString(),
            hasQuote: false,
            hasDividends: false,
            dataQuality: 'error',
            error: error.message
        };
        
        return { success: false, symbol, error: error.message };
    }
}

// Process symbols in batches
async function processBatch(symbols, index, options) {
    const results = await Promise.all(
        symbols.map(s => processSymbol(s, index, options))
    );
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Batch complete: ${successful} successful, ${failed} failed`);
    
    return results;
}

// Rate limiting helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Main function
async function main() {
    const args = process.argv.slice(2);
    const isDividendsOnly = args.includes('--dividends-only');
    const isFullUpdate = args.includes('--full-update');
    const symbolsFilter = args.find(a => a.startsWith('--symbols='))?.split('=')[1]?.split(',');
    
    console.log('=== Oslo Børs Stock Data Fetcher v2.0 ===');
    console.log(`Mode: ${isDividendsOnly ? 'Dividends Only' : isFullUpdate ? 'Full Update' : 'Incremental Update'}`);
    
    // Load index
    const index = loadIndex();
    
    // Discover or use specific symbols
    let symbolsToProcess;
    if (symbolsFilter) {
        // Process specific symbols only
        symbolsToProcess = symbolsFilter.map(s => ({
            symbol: s.toUpperCase(),
            name: index.symbols[s.toUpperCase()]?.name || s,
            type: 'EQS',
            currency: 'NOK'
        }));
        console.log(`Processing ${symbolsToProcess.length} specific symbols`);
    } else {
        // Auto-discover all symbols
        const allSymbols = await discoverOsloSymbols();
        
        // For incremental updates, prioritize symbols that users have
        if (!isFullUpdate && fs.existsSync(INDEX_FILE)) {
            const recentlyUsed = Object.keys(index.symbols)
                .filter(s => {
                    const lastUpdate = index.symbols[s].lastUpdate;
                    if (!lastUpdate) return true;
                    const hoursSinceUpdate = (Date.now() - new Date(lastUpdate)) / (1000 * 60 * 60);
                    return hoursSinceUpdate > 6; // Update if older than 6 hours
                });
            
            // Process recently used symbols first
            const recentSymbols = allSymbols.filter(s => recentlyUsed.includes(s.symbol));
            const newSymbols = allSymbols.filter(s => !index.symbols[s.symbol]);
            
            symbolsToProcess = [...recentSymbols, ...newSymbols.slice(0, 20)]; // Limit new symbols per run
        } else {
            symbolsToProcess = allSymbols;
        }
    }
    
    console.log(`Processing ${symbolsToProcess.length} symbols...`);
    
    // Process in batches
    const batchSize = MAX_CONCURRENT;
    const options = {
        incremental: !isFullUpdate,
        dividendsOnly: isDividendsOnly
    };
    
    let totalSuccess = 0;
    let totalFailed = 0;
    
    for (let i = 0; i < symbolsToProcess.length; i += batchSize) {
        const batch = symbolsToProcess.slice(i, i + batchSize);
        console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(symbolsToProcess.length/batchSize)}`);
        
        const results = await processBatch(batch, index, options);
        
        totalSuccess += results.filter(r => r.success).length;
        totalFailed += results.filter(r => !r.success).length;
        
        // Save index after each batch
        index.lastIncrementalUpdate = new Date().toISOString();
        if (isFullUpdate) {
            index.lastFullUpdate = new Date().toISOString();
        }
        saveIndex(index);
        
        // Rate limiting between batches
        if (i + batchSize < symbolsToProcess.length) {
            await delay(RATE_LIMIT_DELAY);
        }
    }
    
    // Final summary
    console.log('\n=== Summary ===');
    console.log(`Total processed: ${symbolsToProcess.length}`);
    console.log(`Successful: ${totalSuccess}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Index saved with ${Object.keys(index.symbols).length} symbols`);
    console.log(`Data directory: ${DATA_DIR}`);
    
    // Exit with error if too many failures
    if (totalFailed > symbolsToProcess.length * 0.5) {
        console.error('More than 50% of fetches failed!');
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main()
        .then(() => {
            console.log('Stock data fetch completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { main, discoverOsloSymbols, processSymbol };