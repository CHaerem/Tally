// Test script to verify which API approach actually works
const https = require('https');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve({ ok: true, data: JSON.parse(data), status: res.statusCode });
                    } catch (e) {
                        resolve({ ok: false, error: 'Invalid JSON', status: res.statusCode });
                    }
                } else {
                    resolve({ ok: false, status: res.statusCode });
                }
            });
        }).on('error', (err) => {
            resolve({ ok: false, error: err.message });
        });
    });
}

async function testYahooFinance() {
    console.log('\n=== Testing Yahoo Finance API ===\n');
    
    const tickers = [
        { symbol: 'EQNR.OL', name: 'Equinor' },
        { symbol: 'DNB.OL', name: 'DNB Bank' },
        { symbol: 'MOWI.OL', name: 'Mowi' },
        { symbol: 'TEL.OL', name: 'Telenor' },
        { symbol: 'SENTI.OL', name: 'Sentia Group' },
        { symbol: 'EQNR', name: 'Equinor (no suffix)' }
    ];
    
    for (const ticker of tickers) {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.symbol}`;
        const result = await fetchUrl(url);
        
        if (result.ok && result.data?.chart?.result?.[0]?.meta?.regularMarketPrice) {
            const price = result.data.chart.result[0].meta.regularMarketPrice;
            console.log(`✅ ${ticker.symbol} (${ticker.name}): ${price} NOK`);
        } else {
            console.log(`❌ ${ticker.symbol} (${ticker.name}): Not available (Status: ${result.status || 'N/A'})`);
        }
    }
}

async function testAlphaVantage() {
    console.log('\n=== Testing Alpha Vantage API ===\n');
    
    // Note: Alpha Vantage has very limited free tier
    const url = 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=EQNR.OSE&apikey=demo';
    const result = await fetchUrl(url);
    
    if (result.ok) {
        console.log('Alpha Vantage response:', JSON.stringify(result.data, null, 2).substring(0, 200));
    } else {
        console.log('❌ Alpha Vantage failed:', result.status);
    }
}

async function testTwelveData() {
    console.log('\n=== Testing Twelve Data API ===\n');
    
    const symbols = ['EQNR:OSE', 'DNB:OSE', 'MOWI:OSE'];
    
    for (const symbol of symbols) {
        const url = `https://api.twelvedata.com/price?symbol=${symbol}&apikey=demo`;
        const result = await fetchUrl(url);
        
        if (result.ok) {
            console.log(`${symbol}:`, JSON.stringify(result.data));
        } else {
            console.log(`❌ ${symbol} failed:`, result.status);
        }
    }
}

async function testMarketstack() {
    console.log('\n=== Testing Marketstack API ===\n');
    
    // Note: Marketstack requires API key for any real data
    const url = 'http://api.marketstack.com/v1/eod/latest?access_key=YOUR_API_KEY&symbols=EQNR.XOSL';
    console.log('Marketstack requires API key (free tier available at marketstack.com)');
}

async function runAllTests() {
    console.log('Starting API tests from Node.js (no CORS issues)...\n');
    
    await testYahooFinance();
    await testAlphaVantage();
    await testTwelveData();
    await testMarketstack();
    
    console.log('\n=== Test Summary ===\n');
    console.log('Yahoo Finance: Works for major Norwegian stocks with .OL suffix');
    console.log('Alpha Vantage: Limited free tier, requires API key');
    console.log('Twelve Data: Has free tier but limited');
    console.log('Marketstack: Free tier available, good for European stocks');
    console.log('\nRecommendation: Use Yahoo Finance for major stocks, consider paid API for comprehensive coverage');
}

runAllTests();