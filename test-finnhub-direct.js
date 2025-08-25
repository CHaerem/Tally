const https = require('https');

// Using the sandbox API key from earlier test
const API_KEY = 'ct7p1upr01qvjgqbfdbgct7p1upr01qvjgqbfdc0';

function fetchQuote(symbol) {
    return new Promise((resolve, reject) => {
        const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`;
        console.log(`Fetching ${symbol}...`);
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const quote = JSON.parse(data);
                    console.log(`${symbol}:`, quote);
                    resolve(quote);
                } else {
                    console.log(`${symbol}: HTTP ${res.statusCode}`);
                    resolve(null);
                }
            });
        }).on('error', reject);
    });
}

async function testStocks() {
    console.log('Testing Finnhub API for Norwegian stocks\n');
    
    // Test different ticker formats
    const tickers = [
        'EQNR',       // Shows USD price
        'EQNR.OL',    // Oslo listing
        'DNB',        
        'DNB.OL',
        'SNTIA',
        'SNTIA.OL',
        'TEL',
        'TEL.OL',
        'MOWI',
        'MOWI.OL'
    ];
    
    for (const ticker of tickers) {
        await fetchQuote(ticker);
        await new Promise(r => setTimeout(r, 1100)); // Rate limit
    }
    
    console.log('\n=== Testing Exchange Symbols ===\n');
    
    // Get Oslo exchange symbols
    const exchangeUrl = `https://finnhub.io/api/v1/stock/symbol?exchange=OL&token=${API_KEY}`;
    
    https.get(exchangeUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                const symbols = JSON.parse(data);
                console.log(`Found ${symbols.length} symbols on Oslo exchange`);
                
                // Show first 10 with SNTIA
                const sentia = symbols.find(s => s.symbol.includes('SNTIA') || s.description?.includes('Sentia'));
                if (sentia) {
                    console.log('\nSentia found:', sentia);
                }
                
                console.log('\nFirst 10 Oslo stocks:');
                symbols.slice(0, 10).forEach(s => {
                    console.log(`- ${s.symbol}: ${s.description} (${s.currency})`);
                });
            }
        });
    });
}

testStocks().catch(console.error);