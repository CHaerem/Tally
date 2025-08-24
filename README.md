# 📈 Tally - Norwegian Stock Portfolio Tracker

A web-based portfolio tracker for Norwegian stocks that calculates your net profit including dividends. Track your investments from Oslo Børs with real-time prices and automatic dividend history.

## 🎯 Goal

Create a simple, privacy-focused portfolio tracker specifically for Norwegian stock investors that:
- Calculates true investment returns (purchase price vs current price + dividends)
- Works entirely in the browser (no backend/registration required)
- Provides real-time stock prices from Oslo Børs
- Persists data locally between sessions
- Deploys easily via GitHub Pages

## ✅ Current Status

### Completed Features
- ✅ Portfolio management (add/edit/delete stocks)
- ✅ TypeScript setup with Vite build system
- ✅ Real-time price fetching from Yahoo Finance API
- ✅ Automatic dividend history retrieval
- ✅ Net profit calculations including dividends
- ✅ Local storage persistence
- ✅ Responsive design for mobile/desktop
- ✅ GitHub Pages deployment workflow
- ✅ Search functionality for Norwegian stocks
- ✅ Color-coded profit/loss indicators

### 🚧 TODO / Future Improvements

#### High Priority
- [ ] Add edit functionality for existing holdings
- [ ] Implement portfolio charts (performance over time)
- [ ] Add export to CSV/Excel functionality
- [ ] Support for multiple purchase dates of same stock (averaging)
- [ ] Add total portfolio performance chart

#### Medium Priority
- [ ] Currency conversion support (USD/EUR stocks)
- [ ] Tax calculation helper for Norwegian taxes
- [ ] Portfolio allocation/diversification analysis
- [ ] Compare performance against OSEBX index
- [ ] Add more detailed dividend analytics
- [ ] Support for funds and ETFs

#### Nice to Have
- [ ] Dark mode toggle
- [ ] Multiple portfolio support
- [ ] Import transactions from CSV
- [ ] Historical price charts for individual stocks
- [ ] News feed integration for portfolio stocks
- [ ] Price alerts/notifications
- [ ] Backup/restore portfolio data

## 🚀 Quick Start

### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```

### Deployment
```bash
# Deploy to GitHub Pages
npm run deploy
```

The app will be available at: `https://chaerem.github.io/Tally/`

## 🛠️ Tech Stack

- **Frontend**: TypeScript, Vite
- **Styling**: Vanilla CSS with CSS Variables
- **Data**: LocalStorage for persistence
- **API**: Yahoo Finance (free tier)
- **Deployment**: GitHub Pages
- **Build**: GitHub Actions CI/CD

## 📊 Features

### Portfolio Management
- Add stocks with ticker, purchase price, and date
- Automatic ticker search for major Norwegian companies
- Delete holdings with confirmation
- Persistent storage in browser

### Real-Time Data
- Current stock prices from Oslo Børs
- Automatic `.OL` suffix handling for Norwegian tickers
- Dividend history for accurate return calculations
- Manual refresh button for latest prices

### Performance Tracking
- Total invested amount
- Current portfolio value
- Total dividends received
- Net profit/loss with percentage
- Per-stock return breakdown

## 🔒 Privacy

- **No Registration Required**: Works entirely in your browser
- **Local Storage Only**: Your data never leaves your device
- **No Analytics**: No tracking or data collection
- **Open Source**: Fully transparent codebase

## 📝 License

MIT License - feel free to fork and customize!

## 🤝 Contributing

Contributions are welcome! Feel free to:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

Priority areas for contribution:
- Chart visualizations
- Tax calculation features
- Additional API integrations
- UI/UX improvements

## 🐛 Known Issues & Limitations

### API Limitations
- **Only major Norwegian stocks have live prices** - The following stocks work with Yahoo Finance:
  - EQNR, DNB, TEL, MOWI, YAR, ORK, SALM, NHY, AKRBP, GJF, STB, KOG, TOM, SCATC, SUBC, FRO, GOGL, NAS, BAKKA, LSG, AUSS, GSF
- **Smaller stocks (like SENTI) show "N/A" for prices** - These stocks are not available on free APIs
- **Manual price updates** - For stocks without live data, you can still track them using purchase price
- **CORS restrictions** - Browser security may block some API requests
- **Rate limiting** - Too many requests may temporarily block API access

### Workarounds
- Focus on major Norwegian stocks for live price tracking
- Use the app primarily for portfolio overview and dividend tracking
- Consider running locally with `npm run dev` for better API access
- For comprehensive Norwegian market data, consider professional data services

## 📧 Support

For issues or questions, please open a GitHub issue in this repository.