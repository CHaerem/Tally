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

## 🐛 Known Issues

- Yahoo Finance API may have rate limits during market hours
- Some newer Oslo Børs listings might not appear in search
- Dividend data might be incomplete for some stocks
- CORS issues may occur with certain API endpoints (fallback to mock data)

## 📧 Support

For issues or questions, please open a GitHub issue in this repository.