// Test Finnhub API for Norwegian stocks
const https = require('https');

const FINNHUB_API_KEY = 'ct7p1upr01qvjgqbfdbgct7p1upr01qvjgqbfdc0'; // Free sandbox key

function fetchFinnhub(path) {
    return new Promise((resolve, reject) => {
        const url = `https://finnhub.io/api/v1${path}&token=${FINNHUB_API_KEY}`;
        console.log('Fetching:', url);
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        }).on('error', reject);
    });
}

async function testNorwegianStocks() {
    console.log('\n=== Testing Finnhub API for Norwegian Stocks ===\n');
    
    // Test various ticker formats
    const tickers = [
        'SNTIA',      // Sentia AS
        'EQNR',       // Equinor
        'DNB',        // DNB Bank
        'MOWI',       // Mowi
        'TEL',        // Telenor
        'SNTIA.OL',   // With .OL suffix
        'EQNR.OL',    // With .OL suffix
    ];
    
    for (const ticker of tickers) {
        try {
            // Try quote endpoint
            const quote = await fetchFinnhub(`/quote?symbol=${ticker}`);
            if (quote.c && quote.c > 0) {
                console.log(`✅ ${ticker}: Current price = ${quote.c}, Change = ${quote.d} (${quote.dp}%)`);
            } else {
                console.log(`❌ ${ticker}: No price data`);
            }
        } catch (error) {
            console.log(`❌ ${ticker}: ${error.message}`);
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

async function searchNorwegianStocks() {
    console.log('\n=== Searching Norwegian Exchange ===\n');
    
    try {
        // Get all symbols for Oslo exchange
        const symbols = await fetchFinnhub('/stock/symbol?exchange=OL');
        
        console.log(`Found ${symbols.length} stocks on Oslo exchange`);
        
        // Look for Sentia
        const sentia = symbols.find(s => 
            s.symbol.includes('SNTIA') || 
            s.description?.toLowerCase().includes('sentia')
        );
        
        if (sentia) {
            console.log('\nFound Sentia:', sentia);
        }
        
        // Show first 10 stocks
        console.log('\nFirst 10 Oslo stocks:');
        symbols.slice(0, 10).forEach(s => {
            console.log(`- ${s.symbol}: ${s.description}`);
        });
        
    } catch (error) {
        console.log('Error searching stocks:', error.message);
    }
}

async function main() {
    await testNorwegianStocks();
    await searchNorwegianStocks();
}

main().catch(console.error);