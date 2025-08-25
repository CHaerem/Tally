#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Get API key from environment variable (GitHub Secret)
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

if (!FINNHUB_API_KEY) {
    console.error('ERROR: FINNHUB_API_KEY environment variable is not set');
    process.exit(1);
}

// Norwegian stocks to fetch - expanded list
const NORWEGIAN_STOCKS = [
    // Major stocks
    'EQNR', 'DNB', 'TEL', 'MOWI', 'YAR', 'ORK', 'SALM', 'NHY',
    'AKRBP', 'GJF', 'STB', 'KOG', 'TOM', 'SCATC', 'SUBC', 'FRO',
    'GOGL', 'NAS', 'BAKKA', 'LSG', 'AUSS', 'GSF', 'VAR', 'PGS',
    'TGS', 'AKSO', 'BWO', 'WAWI', 'FLNG', 'BWLPG', 'MPCC',
    
    // Additional stocks including Sentia
    'SNTIA', 'NEL', 'KAHOT', 'REC', 'OPERA', 'CRAYN', 'BOUVET',
    'PEXIP', 'ATEA', 'LINK', 'IDEX', 'NEXT', 'ZAPTEC', 'AUTO',
    'NOD', 'VOLUE', 'B2HOLD', 'PROTCT', 'NONG', 'SRBANK',
    'MORG', 'MING', 'ENTRA', 'OLT', 'SOFF', 'KID', 'KOMPL',
    'XXL', 'EUROW', 'AFG', 'VEI', 'SCHB', 'SCHA', 'ADEV',
    'AKH', 'ACC', 'ACR', 'ABG', 'ENDUR', 'CLOUDBERRY'
];

// Rate limiting helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Fetch data from Finnhub
async function fetchFromFinnhub(endpoint) {
    return new Promise((resolve, reject) => {
        const url = `https://finnhub.io/api/v1${endpoint}&token=${FINNHUB_API_KEY}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`Invalid JSON response for ${endpoint}`));
                    }
                } else if (res.statusCode === 429) {
                    reject(new Error('Rate limited'));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        }).on('error', reject);
    });
}

// Fetch quote for a single stock
async function fetchStockQuote(symbol) {
    try {
        const quote = await fetchFromFinnhub(`/quote?symbol=${symbol}`);
        
        // Check if we have valid data
        if (quote && quote.c > 0) {
            return {
                symbol,
                price: quote.c,           // Current price
                change: quote.d,          // Change
                changePercent: quote.dp,  // Change percent
                high: quote.h,           // High of the day
                low: quote.l,            // Low of the day
                open: quote.o,           // Open price
                previousClose: quote.pc,  // Previous close
                timestamp: new Date().toISOString(),
                source: 'finnhub'
            };
        }
        
        return null;
    } catch (error) {
        console.error(`Error fetching ${symbol}:`, error.message);
        return null;
    }
}

// Fetch dividend data for a stock
async function fetchDividends(symbol) {
    try {
        const toDate = new Date().toISOString().split('T')[0];
        const fromDate = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const dividends = await fetchFromFinnhub(`/stock/dividend2?symbol=${symbol}&from=${fromDate}&to=${toDate}`);
        
        if (dividends && dividends.symbol) {
            return dividends.data || [];
        }
        
        return [];
    } catch (error) {
        // Many stocks don't have dividend data, so this is not an error
        return [];
    }
}

// Main function to fetch all data
async function fetchAllStockData() {
    console.log('Starting stock data fetch...');
    console.log(`Fetching data for ${NORWEGIAN_STOCKS.length} Norwegian stocks`);
    
    const stockData = {};
    const errors = [];
    let successCount = 0;
    
    for (let i = 0; i < NORWEGIAN_STOCKS.length; i++) {
        const symbol = NORWEGIAN_STOCKS[i];
        console.log(`[${i + 1}/${NORWEGIAN_STOCKS.length}] Fetching ${symbol}...`);
        
        try {
            // Fetch quote
            const quote = await fetchStockQuote(symbol);
            
            if (quote) {
                // Fetch dividends (optional, may not exist)
                const dividends = await fetchDividends(symbol);
                
                stockData[symbol] = {
                    ...quote,
                    dividends: dividends
                };
                
                successCount++;
                console.log(`  ✓ ${symbol}: ${quote.price} (${quote.changePercent > 0 ? '+' : ''}${quote.changePercent}%)`);
            } else {
                console.log(`  ✗ ${symbol}: No data available`);
                errors.push(`${symbol}: No data`);
            }
            
            // Rate limiting: Finnhub free tier allows 60 calls/minute
            // We make 2 calls per stock (quote + dividend), so delay accordingly
            await delay(2100); // ~28 stocks per minute to be safe
            
        } catch (error) {
            console.error(`  ✗ ${symbol}: ${error.message}`);
            errors.push(`${symbol}: ${error.message}`);
            
            // If rate limited, wait longer
            if (error.message === 'Rate limited') {
                console.log('Rate limited, waiting 60 seconds...');
                await delay(60000);
            }
        }
    }
    
    // Prepare the final data structure
    const finalData = {
        metadata: {
            lastUpdated: new Date().toISOString(),
            totalStocks: NORWEGIAN_STOCKS.length,
            successfulFetches: successCount,
            failedFetches: errors.length,
            source: 'Finnhub',
            nextUpdate: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() // 6 hours later
        },
        stocks: stockData,
        errors: errors
    };
    
    // Save to public directory for the app to consume
    const outputPath = path.join(__dirname, '..', 'public', 'stock-data.json');
    
    // Create public directory if it doesn't exist
    const publicDir = path.join(__dirname, '..', 'public');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Write the data
    fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2));
    
    console.log('\n=== Summary ===');
    console.log(`Successfully fetched: ${successCount}/${NORWEGIAN_STOCKS.length} stocks`);
    console.log(`Failed: ${errors.length} stocks`);
    console.log(`Data saved to: ${outputPath}`);
    console.log(`Last updated: ${finalData.metadata.lastUpdated}`);
    
    // Exit with error if too many failures
    if (errors.length > NORWEGIAN_STOCKS.length * 0.5) {
        console.error('More than 50% of fetches failed!');
        process.exit(1);
    }
    
    return finalData;
}

// Run the script
if (require.main === module) {
    fetchAllStockData()
        .then(() => {
            console.log('Stock data fetch completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { fetchAllStockData };