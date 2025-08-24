import { StockQuote, Dividend } from './types';

export class StockAPI {
  // List of major Norwegian stocks that are available on Yahoo Finance
  private static AVAILABLE_TICKERS = new Set([
    'EQNR', 'DNB', 'TEL', 'MOWI', 'YAR', 'ORK', 'SALM', 'NHY', 
    'AKRBP', 'GJF', 'STB', 'KOG', 'TOM', 'SCATC', 'SUBC', 'FRO',
    'GOGL', 'NAS', 'BAKKA', 'LSG', 'AUSS', 'GSF'
  ]);

  private static isLikelyAvailable(ticker: string): boolean {
    // Check if ticker is in our known list of available stocks
    return this.AVAILABLE_TICKERS.has(ticker.toUpperCase());
  }

  private static async fetchFromYahoo(ticker: string): Promise<any> {
    // Only try to fetch if we know the stock is likely available
    if (!this.isLikelyAvailable(ticker)) {
      return null;
    }

    const osloTicker = ticker.includes('.') ? ticker : `${ticker}.OL`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${osloTicker}`;
    
    try {
      // Try direct fetch first (works in some environments)
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data?.chart?.result?.[0]) {
          return data;
        }
      }
    } catch (error) {
      // Direct fetch failed, try with CORS proxy
      try {
        const proxy = 'https://corsproxy.io/?';
        const response = await fetch(proxy + encodeURIComponent(url));
        if (response.ok) {
          const data = await response.json();
          if (data?.chart?.result?.[0]) {
            return data;
          }
        }
      } catch (proxyError) {
        // Both methods failed
      }
    }
    
    return null;
  }

  static async fetchStockPrice(ticker: string): Promise<StockQuote | null> {
    try {
      const data = await this.fetchFromYahoo(ticker);
      
      if (!data?.chart?.result?.[0]?.meta) {
        // Return null for unavailable stocks - UI will show N/A
        return null;
      }
      
      const quote = data.chart.result[0].meta;
      const price = quote.regularMarketPrice || 0;
      const previousClose = quote.previousClose || price;
      
      return {
        ticker,
        price,
        change: price - previousClose,
        changePercent: previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return null;
    }
  }

  static async fetchDividendHistory(ticker: string): Promise<Dividend[]> {
    // Only try for stocks we know are available
    if (!this.isLikelyAvailable(ticker)) {
      return [];
    }

    try {
      const endDate = Math.floor(Date.now() / 1000);
      const startDate = endDate - (365 * 5 * 24 * 60 * 60); // 5 years of history
      
      const osloTicker = ticker.includes('.') ? ticker : `${ticker}.OL`;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${osloTicker}?period1=${startDate}&period2=${endDate}&interval=1d&events=div`;
      
      try {
        // Try direct first
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data?.chart?.result?.[0]?.events?.dividends) {
            const events = data.chart.result[0].events.dividends;
            return Object.values(events).map((div: any) => ({
              date: new Date(div.date * 1000).toISOString().split('T')[0],
              amount: div.amount,
              perShare: div.amount
            }));
          }
        }
      } catch (error) {
        // Try with proxy
        try {
          const proxy = 'https://corsproxy.io/?';
          const response = await fetch(proxy + encodeURIComponent(url));
          if (response.ok) {
            const data = await response.json();
            if (data?.chart?.result?.[0]?.events?.dividends) {
              const events = data.chart.result[0].events.dividends;
              return Object.values(events).map((div: any) => ({
                date: new Date(div.date * 1000).toISOString().split('T')[0],
                amount: div.amount,
                perShare: div.amount
              }));
            }
          }
        } catch (proxyError) {
          // Both failed
        }
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }

  static getNorwegianStocks(): Array<{ticker: string, name: string, sector?: string}> {
    return [
      // Energy & Oil Services
      { ticker: 'EQNR', name: 'Equinor ASA', sector: 'Energy' },
      { ticker: 'AKRBP', name: 'Aker BP ASA', sector: 'Energy' },
      { ticker: 'VAR', name: 'Vår Energi ASA', sector: 'Energy' },
      { ticker: 'PGS', name: 'PGS ASA', sector: 'Energy Services' },
      { ticker: 'TGS', name: 'TGS ASA', sector: 'Energy Services' },
      { ticker: 'SUBC', name: 'Subsea 7 S.A.', sector: 'Oil Services' },
      { ticker: 'AKSO', name: 'Aker Solutions ASA', sector: 'Oil Services' },
      { ticker: 'BWO', name: 'BW Offshore Limited', sector: 'Oil Services' },
      { ticker: 'ODFJELL', name: 'Odfjell Drilling Ltd.', sector: 'Oil Services' },
      { ticker: 'SEABIRD', name: 'SeaBird Exploration PLC', sector: 'Oil Services' },
      { ticker: 'REACH', name: 'REACH Subsea ASA', sector: 'Oil Services' },
      { ticker: 'EMGS', name: 'Electromagnetic Geoservices ASA', sector: 'Oil Services' },
      { ticker: 'SDRL', name: 'Seadrill Limited', sector: 'Oil Services' },
      { ticker: 'NODL', name: 'Northern Ocean Ltd.', sector: 'Oil Services' },
      
      // Banking & Finance  
      { ticker: 'DNB', name: 'DNB Bank ASA', sector: 'Banking' },
      { ticker: 'GJF', name: 'Gjensidige Forsikring ASA', sector: 'Insurance' },
      { ticker: 'STB', name: 'Storebrand ASA', sector: 'Insurance' },
      { ticker: 'PROTCT', name: 'Protector Forsikring ASA', sector: 'Insurance' },
      { ticker: 'NONG', name: 'SpareBank 1 Nord-Norge', sector: 'Banking' },
      { ticker: 'SRBANK', name: 'SpareBank 1 SR-Bank ASA', sector: 'Banking' },
      { ticker: 'MORG', name: 'Sparebanken Møre', sector: 'Banking' },
      { ticker: 'SVEG', name: 'Sparebanken Vest', sector: 'Banking' },
      { ticker: 'MING', name: 'SpareBank 1 SMN', sector: 'Banking' },
      { ticker: 'SOAG', name: 'SpareBank 1 Sørøst-Norge', sector: 'Banking' },
      { ticker: 'SPOG', name: 'SpareBank 1 Østlandet', sector: 'Banking' },
      { ticker: 'HELG', name: 'Sparebanken Sør', sector: 'Banking' },
      { ticker: 'RING', name: 'SpareBank 1 Ringerike Hadeland', sector: 'Banking' },
      { ticker: 'SBG', name: 'Sandnes Sparebank', sector: 'Banking' },
      { ticker: 'TRVX', name: 'Torvex Solutions AS', sector: 'Finance' },
      
      // Seafood
      { ticker: 'MOWI', name: 'Mowi ASA', sector: 'Seafood' },
      { ticker: 'SALM', name: 'SalMar ASA', sector: 'Seafood' },
      { ticker: 'LSG', name: 'Lerøy Seafood Group ASA', sector: 'Seafood' },
      { ticker: 'BAKKA', name: 'Bakkafrost P/F', sector: 'Seafood' },
      { ticker: 'GSF', name: 'Grieg Seafood ASA', sector: 'Seafood' },
      { ticker: 'AUSS', name: 'Austevoll Seafood ASA', sector: 'Seafood' },
      { ticker: 'NSG', name: 'Norway Royal Salmon ASA', sector: 'Seafood' },
      { ticker: 'AFISH', name: 'Atlantic Sapphire ASA', sector: 'Seafood' },
      { ticker: 'HASO', name: 'Norway Salmon ASA', sector: 'Seafood' },
      { ticker: 'ICEFISH', name: 'Ice Fish Farm AS', sector: 'Seafood' },
      
      // Technology & Software
      { ticker: 'KOG', name: 'Kongsberg Gruppen ASA', sector: 'Technology' },
      { ticker: 'TOM', name: 'Tomra Systems ASA', sector: 'Technology' },
      { ticker: 'SCATC', name: 'Scatec ASA', sector: 'Renewable Energy' },
      { ticker: 'NEL', name: 'Nel ASA', sector: 'Hydrogen' },
      { ticker: 'OPERA', name: 'Opera Limited', sector: 'Technology' },
      { ticker: 'CRAYN', name: 'Crayon Group Holding ASA', sector: 'Technology' },
      { ticker: 'BOUVET', name: 'Bouvet ASA', sector: 'Technology' },
      { ticker: 'PEXIP', name: 'Pexip Holding ASA', sector: 'Technology' },
      { ticker: 'ATEA', name: 'Atea ASA', sector: 'Technology' },
      { ticker: 'LINK', name: 'Link Mobility Group Holding ASA', sector: 'Technology' },
      { ticker: 'IDEX', name: 'IDEX Biometrics ASA', sector: 'Technology' },
      { ticker: 'NEXT', name: 'NEXT Biometrics Group ASA', sector: 'Technology' },
      { ticker: 'SOFTX', name: 'Soft-X AS', sector: 'Technology' },
      { ticker: 'ZAPTEC', name: 'Zaptec AS', sector: 'Technology' },
      { ticker: 'HPUR', name: 'Hexagon Purus ASA', sector: 'Technology' },
      { ticker: 'KONTLI', name: 'Kontali AS', sector: 'Technology' },
      { ticker: 'KAHOT', name: 'Kahoot! ASA', sector: 'EdTech' },
      { ticker: 'SENTI', name: 'Sentia Group ASA', sector: 'Technology' },
      { ticker: 'BEWI', name: 'BEWI ASA', sector: 'Materials' },
      { ticker: 'QFUEL', name: 'Quantafuel ASA', sector: 'Technology' },
      { ticker: 'OTELLO', name: 'Otello Corporation ASA', sector: 'Technology' },
      { ticker: 'INSR', name: 'Insr Insurance Group ASA', sector: 'InsurTech' },
      { ticker: 'WEBSTEP', name: 'Webstep ASA', sector: 'Technology' },
      { ticker: 'AMSC', name: 'Ams AS', sector: 'Technology' },
      
      // Gaming & Entertainment
      { ticker: 'GENT', name: 'Gentium Gaming Holding AS', sector: 'Gaming' },
      { ticker: 'BETCO', name: 'Betsson AB', sector: 'Gaming' },
      { ticker: 'FUNCOM', name: 'Funcom SE', sector: 'Gaming' },
      
      // Telecom
      { ticker: 'TEL', name: 'Telenor ASA', sector: 'Telecom' },
      { ticker: 'ICE', name: 'Ice Group ASA', sector: 'Telecom' },
      
      // Industrial & Chemicals
      { ticker: 'YAR', name: 'Yara International ASA', sector: 'Chemicals' },
      { ticker: 'NHY', name: 'Norsk Hydro ASA', sector: 'Materials' },
      { ticker: 'ORK', name: 'Orkla ASA', sector: 'Consumer Goods' },
      { ticker: 'BRGN', name: 'Borregaard ASA', sector: 'Chemicals' },
      { ticker: 'ELKEM', name: 'Elkem ASA', sector: 'Materials' },
      { ticker: 'HEX', name: 'Hexagon Composites ASA', sector: 'Industrial' },
      { ticker: 'VEI', name: 'Veidekke ASA', sector: 'Construction' },
      { ticker: 'AFG', name: 'AF Gruppen ASA', sector: 'Construction' },
      { ticker: 'SCHB', name: 'Schibsted ASA', sector: 'Media' },
      { ticker: 'NPRO', name: 'Norwegian Property ASA', sector: 'Real Estate' },
      { ticker: 'EPRO', name: 'Europris ASA', sector: 'Retail' },
      
      // Shipping & Transport
      { ticker: 'FRO', name: 'Frontline Ltd.', sector: 'Shipping' },
      { ticker: 'STOLT', name: 'Stolt-Nielsen Limited', sector: 'Shipping' },
      { ticker: 'WAWI', name: 'Wallenius Wilhelmsen ASA', sector: 'Shipping' },
      { ticker: 'FLNG', name: 'Flex LNG Ltd.', sector: 'Shipping' },
      { ticker: 'BWLPG', name: 'BW LPG Limited', sector: 'Shipping' },
      { ticker: 'GOGL', name: 'Golden Ocean Group Limited', sector: 'Shipping' },
      { ticker: 'HAFNIA', name: 'Hafnia Limited', sector: 'Shipping' },
      { ticker: 'HAVI', name: 'Havila Shipping ASA', sector: 'Shipping' },
      { ticker: 'MPCC', name: 'MPC Container Ships ASA', sector: 'Shipping' },
      { ticker: 'ODL', name: 'Odfjell SE', sector: 'Shipping' },
      { ticker: 'BELCO', name: 'Belships ASA', sector: 'Shipping' },
      { ticker: 'KCC', name: 'Klaveness Combination Carriers ASA', sector: 'Shipping' },
      { ticker: 'HKY', name: 'Höegh Autoliners ASA', sector: 'Shipping' },
      { ticker: 'AVANCE', name: 'Avance Gas Holding Ltd', sector: 'Shipping' },
      { ticker: 'COOL', name: 'Cool Company Ltd.', sector: 'Shipping' },
      { ticker: 'SFL', name: 'SFL Corporation Ltd.', sector: 'Shipping' },
      { ticker: 'BLG', name: 'BLG ASA', sector: 'Shipping' },
      
      // Real Estate
      { ticker: 'ENTRA', name: 'Entra ASA', sector: 'Real Estate' },
      { ticker: 'OLT', name: 'Olav Thon Eiendomsselskap ASA', sector: 'Real Estate' },
      { ticker: 'SOFF', name: 'Selvaag Bolig ASA', sector: 'Real Estate' },
      { ticker: 'NAPA', name: 'Norwegian Property ASA', sector: 'Real Estate' },
      { ticker: 'SBO', name: 'Sbanken Boligkreditt AS', sector: 'Real Estate' },
      
      // Consumer & Retail
      { ticker: 'KID', name: 'Kid ASA', sector: 'Retail' },
      { ticker: 'KOMPL', name: 'Komplett ASA', sector: 'E-commerce' },
      { ticker: 'XXL', name: 'XXL ASA', sector: 'Retail' },
      { ticker: 'EUROW', name: 'Europris ASA', sector: 'Retail' },
      { ticker: 'JYSK', name: 'JYSK AS', sector: 'Retail' },
      { ticker: 'VVL', name: 'Varner AS', sector: 'Retail' },
      { ticker: 'ASTK', name: 'Astrup Fearnley AS', sector: 'Retail' },
      
      // Healthcare & Biotech
      { ticker: 'NYKD', name: 'Nykode Therapeutics ASA', sector: 'Biotech' },
      { ticker: 'ULTI', name: 'Ultimovacs ASA', sector: 'Biotech' },
      { ticker: 'BGBIO', name: 'BerGenBio ASA', sector: 'Biotech' },
      { ticker: 'PCIB', name: 'PCI Biotech Holding ASA', sector: 'Biotech' },
      { ticker: 'ALGETA', name: 'Algeta ASA', sector: 'Biotech' },
      { ticker: 'BIOTEC', name: 'Biotec Pharmacon ASA', sector: 'Biotech' },
      { ticker: 'NORDIC', name: 'Nordic Nanovector ASA', sector: 'Biotech' },
      { ticker: 'VISTIN', name: 'Vistin Pharma ASA', sector: 'Pharma' },
      
      // Media & Entertainment
      { ticker: 'SCHA', name: 'Schibsted ASA - A shares', sector: 'Media' },
      { ticker: 'SCHB', name: 'Schibsted ASA - B shares', sector: 'Media' },
      { ticker: 'AMEDIA', name: 'Amedia AS', sector: 'Media' },
      { ticker: 'POLARIS', name: 'Polaris Media ASA', sector: 'Media' },
      
      // Other Major Companies
      { ticker: 'REC', name: 'REC Silicon ASA', sector: 'Materials' },
      { ticker: 'AKA', name: 'Aker ASA', sector: 'Investment' },
      { ticker: 'AKER', name: 'Aker ASA', sector: 'Investment' },
      { ticker: 'AKAST', name: 'Akastor ASA', sector: 'Investment' },
      { ticker: 'NAS', name: 'Norwegian Air Shuttle ASA', sector: 'Airlines' },
      { ticker: 'FLYR', name: 'Flyr AS', sector: 'Airlines' },
      { ticker: 'NORSE', name: 'Norse Atlantic ASA', sector: 'Airlines' },
      { ticker: 'AEGA', name: 'Aega ASA', sector: 'Investment' },
      { ticker: 'BONHR', name: 'Bonheur ASA', sector: 'Investment' },
      { ticker: 'GOLAR', name: 'Golar LNG Limited', sector: 'Energy' },
      { ticker: 'NOD', name: 'Nordic Semiconductor ASA', sector: 'Technology' },
      { ticker: 'NOFI', name: 'Norwegian Finans Holding ASA', sector: 'Finance' },
      { ticker: 'B2HOLD', name: 'B2Holding ASA', sector: 'Finance' },
      { ticker: 'AGLX', name: 'Agilyx ASA', sector: 'Technology' },
      { ticker: 'PROT', name: 'Prototech AS', sector: 'Technology' },
      { ticker: 'VOLUE', name: 'Volue ASA', sector: 'Technology' },
      { ticker: 'ELMRA', name: 'Elmera Group ASA', sector: 'Energy' },
      { ticker: 'FJELL', name: 'Fjellkraft AS', sector: 'Energy' },
      { ticker: 'VMETRO', name: 'Victoria Metro AS', sector: 'Transport' },
      
      // Additional Companies A-E
      { ticker: 'ABG', name: 'ABG Sundal Collier Holding ASA', sector: 'Finance' },
      { ticker: 'ACC', name: 'Aker Carbon Capture ASA', sector: 'Technology' },
      { ticker: 'ACR', name: 'Axactor ASA', sector: 'Finance' },
      { ticker: 'ADE', name: 'Adevinta ASA', sector: 'Technology' },
      { ticker: 'ADXS', name: 'Adexsi AS', sector: 'Technology' },
      { ticker: 'AFK', name: 'Arendals Fossekompani ASA', sector: 'Energy' },
      { ticker: 'AGR', name: 'AGR Group ASA', sector: 'Oil Services' },
      { ticker: 'AKH', name: 'Aker Horizons ASA', sector: 'Investment' },
      { ticker: 'AKPS', name: 'Aker Property Group AS', sector: 'Real Estate' },
      { ticker: 'ALT', name: 'Altanet AS', sector: 'Telecom' },
      { ticker: 'AMHC', name: 'American Healthcare Capital', sector: 'Healthcare' },
      { ticker: 'ANDF', name: 'Andfjord Salmon AS', sector: 'Seafood' },
      { ticker: 'ANS', name: 'Anspec Holdings Ltd', sector: 'Technology' },
      { ticker: 'AQUA', name: 'Aqua Bio Technology ASA', sector: 'Biotech' },
      { ticker: 'ARCH', name: 'Archer Limited', sector: 'Oil Services' },
      { ticker: 'ARCUS', name: 'Arcus ASA', sector: 'Consumer Goods' },
      { ticker: 'ARR', name: 'Arrow Seismic ASA', sector: 'Oil Services' },
      { ticker: 'ASA', name: 'ABG Sundal Collier ASA', sector: 'Finance' },
      { ticker: 'ASC', name: 'Asetek A/S', sector: 'Technology' },
      { ticker: 'ASD', name: 'Asdra Holding AS', sector: 'Investment' },
      { ticker: 'ASETEK', name: 'Asetek Danmark A/S', sector: 'Technology' },
      { ticker: 'ASG', name: 'Assigna AS', sector: 'Technology' },
      { ticker: 'ASTRO', name: 'Astrocast SA', sector: 'Technology' },
      { ticker: 'AURE', name: 'Aure Holding AS', sector: 'Investment' },
      { ticker: 'AUTO', name: 'AutoStore Holdings Ltd.', sector: 'Technology' },
      { ticker: 'AVAL', name: 'Avalanche Capital AS', sector: 'Investment' },
      { ticker: 'AVIT', name: 'Avitar AS', sector: 'Technology' },
      { ticker: 'AWE', name: 'Aweis AS', sector: 'Technology' },
      { ticker: 'AXPLS', name: 'Axplora AS', sector: 'Technology' },
      { ticker: 'AZT', name: 'Azets Holding AS', sector: 'Finance' },
      { ticker: 'B2I', name: 'B2Impact ASA', sector: 'Investment' },
      { ticker: 'BAAT', name: 'Baat Medical AS', sector: 'Healthcare' },
      { ticker: 'BAIRD', name: 'Baird Maritime AS', sector: 'Shipping' },
      { ticker: 'BAKKA', name: 'Bakkafrost P/F', sector: 'Seafood' },
      { ticker: 'BALT', name: 'Baltic Sea Properties AS', sector: 'Real Estate' },
      { ticker: 'BARR', name: 'Barramundi Group Pte Ltd', sector: 'Seafood' },
      { ticker: 'BAS', name: 'BAS Mining Limited', sector: 'Mining' },
      { ticker: 'BBL', name: 'Baltic Bridge AS', sector: 'Shipping' },
      { ticker: 'BCS', name: 'BioCirc AS', sector: 'Biotech' },
      { ticker: 'BEL', name: 'Belships ASA', sector: 'Shipping' },
      { ticker: 'BERG', name: 'Bergenbio ASA', sector: 'Biotech' },
      { ticker: 'BGHL', name: 'Byggholt AS', sector: 'Construction' },
      { ticker: 'BGS', name: 'BioGaia AB', sector: 'Healthcare' },
      { ticker: 'BIEN', name: 'Bien Sparebank ASA', sector: 'Banking' },
      { ticker: 'BIND', name: 'Binder AS', sector: 'Technology' },
      { ticker: 'BIO', name: 'Bionor Pharma ASA', sector: 'Biotech' },
      { ticker: 'BIRD', name: 'Birdstep Technology ASA', sector: 'Technology' },
      { ticker: 'BISH', name: 'BiSH Food AS', sector: 'Consumer Goods' },
      { ticker: 'BJOR', name: 'Bjorge ASA', sector: 'Industrial' },
      { ticker: 'BKK', name: 'BKK AS', sector: 'Energy' },
      { ticker: 'BLO', name: 'Blockbuster AS', sector: 'Entertainment' },
      { ticker: 'BLUE', name: 'BlueStar AS', sector: 'Technology' },
      { ticker: 'BMA', name: 'BMA Group AS', sector: 'Industrial' },
      { ticker: 'BMO', name: 'BioMar Group A/S', sector: 'Seafood' },
      { ticker: 'BNB', name: 'BN Bank ASA', sector: 'Banking' },
      { ticker: 'BNK', name: 'Bionike AS', sector: 'Healthcare' },
      { ticker: 'BNO', name: 'Bionor Holding AS', sector: 'Biotech' },
      { ticker: 'BOA', name: 'Bank of Aland', sector: 'Banking' },
      { ticker: 'BOCO', name: 'Boco AS', sector: 'Technology' },
      { ticker: 'BOLD', name: 'Bold Seismic AS', sector: 'Oil Services' },
      { ticker: 'BONH', name: 'Bonheur ASA', sector: 'Investment' },
      { ticker: 'BOR', name: 'Boreal Holding AS', sector: 'Transport' },
      { ticker: 'BORR', name: 'Borr Drilling Limited', sector: 'Oil Services' },
      { ticker: 'BOS', name: 'Bostad Norge AS', sector: 'Real Estate' },
      { ticker: 'BOTZ', name: 'Botz AS', sector: 'Technology' },
      { ticker: 'BRG', name: 'Borgestad ASA', sector: 'Industrial' },
      { ticker: 'BRIM', name: 'Brim Explorer AS', sector: 'Seafood' },
      { ticker: 'BRSC', name: 'Braasport AS', sector: 'Retail' },
      { ticker: 'BSP', name: 'Bulk Ship Partners AS', sector: 'Shipping' },
      { ticker: 'BTI', name: 'Biotec AS', sector: 'Biotech' },
      { ticker: 'BTIM', name: 'Batim AS', sector: 'Real Estate' },
      { ticker: 'BTS', name: 'BTS Group AB', sector: 'Consulting' },
      { ticker: 'BUND', name: 'Bundpris.no AS', sector: 'Retail' },
      { ticker: 'BURN', name: 'Burner AS', sector: 'Technology' },
      { ticker: 'BW', name: 'BW Energy Limited', sector: 'Energy' },
      { ticker: 'BWE', name: 'BW Energy Limited', sector: 'Energy' },
      { ticker: 'BWEK', name: 'BW Ekstra AS', sector: 'Shipping' },
      { ticker: 'BWIDL', name: 'BW Ideol AS', sector: 'Energy' },
      { ticker: 'BYGG', name: 'Byggma ASA', sector: 'Industrial' },
      { ticker: 'CAD', name: 'Cadiz AS', sector: 'Technology' },
      { ticker: 'CAMAR', name: 'Camaro AS', sector: 'Investment' },
      { ticker: 'CAMBI', name: 'Cambi AS', sector: 'Technology' },
      { ticker: 'CAMP', name: 'Campino AS', sector: 'Consumer Goods' },
      { ticker: 'CAMO', name: 'Camouflage AS', sector: 'Technology' },
      { ticker: 'CAPSL', name: 'Capital Scandinavia AS', sector: 'Investment' },
      { ticker: 'CARA', name: 'Cara AS', sector: 'Healthcare' },
      { ticker: 'CARE', name: 'Caretaker AS', sector: 'Healthcare' },
      { ticker: 'CARGO', name: 'Cargo Partner AS', sector: 'Logistics' },
      { ticker: 'CARM', name: 'Carmel Pharma AB', sector: 'Pharma' },
      { ticker: 'CARN', name: 'Carnegie AS', sector: 'Finance' },
      { ticker: 'CASA', name: 'Casa AS', sector: 'Real Estate' },
      { ticker: 'CASS', name: 'Cassandra Oil AB', sector: 'Energy' },
      { ticker: 'CAST', name: 'Casting AS', sector: 'Industrial' },
      { ticker: 'CATC', name: 'Catch Communications AS', sector: 'Technology' },
      { ticker: 'CAVU', name: 'Cavu AS', sector: 'Aviation' },
      { ticker: 'CBL', name: 'CB Logistics AS', sector: 'Logistics' },
      { ticker: 'CBT', name: 'CB Technologies AS', sector: 'Technology' },
      { ticker: 'CCC', name: 'CCC AS', sector: 'Technology' },
      { ticker: 'CCL', name: 'CCL Industries Inc.', sector: 'Industrial' },
      { ticker: 'CDI', name: 'CDI Global AS', sector: 'Technology' },
      { ticker: 'CDNA', name: 'Carbon DNA AS', sector: 'Technology' },
      { ticker: 'CEA', name: 'CEA Technologies AS', sector: 'Technology' },
      { ticker: 'CECON', name: 'Cecon ASA', sector: 'Engineering' },
      { ticker: 'CECO', name: 'CECO Environmental Corp', sector: 'Industrial' },
      { ticker: 'CEI', name: 'CEI AS', sector: 'Investment' },
      { ticker: 'CEL', name: 'Celsius AS', sector: 'Energy' },
      { ticker: 'CELL', name: 'Cell Impact AB', sector: 'Technology' },
      { ticker: 'CELO', name: 'Celon Pharma SA', sector: 'Pharma' },
      { ticker: 'CEMIT', name: 'Cemit AS', sector: 'Industrial' },
      { ticker: 'CEMO', name: 'Cemo AS', sector: 'Industrial' },
      { ticker: 'CEN', name: 'Central AS', sector: 'Investment' },
      { ticker: 'CENT', name: 'Centrica PLC', sector: 'Energy' },
      { ticker: 'CENTR', name: 'Central Retail Corporation', sector: 'Retail' },
      { ticker: 'CENTY', name: 'Century AS', sector: 'Investment' },
      { ticker: 'CEO', name: 'CEO AS', sector: 'Consulting' },
      { ticker: 'CEQ', name: 'Cequence Energy Ltd', sector: 'Energy' },
      { ticker: 'CER', name: 'Cerebrum AS', sector: 'Technology' },
      { ticker: 'CERE', name: 'Cereal Base Ceba AB', sector: 'Consumer Goods' },
      { ticker: 'CERT', name: 'Certify AS', sector: 'Technology' },
      { ticker: 'CERVA', name: 'Cervantes AS', sector: 'Investment' },
      { ticker: 'CESP', name: 'CESP AS', sector: 'Energy' },
      { ticker: 'CHAL', name: 'Challenge AS', sector: 'Technology' },
      { ticker: 'CHAM', name: 'Chameleon AS', sector: 'Technology' },
      { ticker: 'CHAMP', name: 'Champion AS', sector: 'Investment' },
      { ticker: 'CHANC', name: 'Chance AS', sector: 'Gaming' },
      { ticker: 'CHANG', name: 'Change AS', sector: 'Technology' },
      { ticker: 'CHAP', name: 'Chapman AS', sector: 'Shipping' },
      { ticker: 'CHAR', name: 'Chargex AS', sector: 'Technology' },
      { ticker: 'CHAS', name: 'Chase AS', sector: 'Finance' },
      { ticker: 'CHAT', name: 'ChatBot AS', sector: 'Technology' },
      { ticker: 'CHE', name: 'ChemFlow AS', sector: 'Chemicals' },
      { ticker: 'CHEF', name: 'Chef AS', sector: 'Consumer Goods' },
      { ticker: 'CHEM', name: 'ChemAs AS', sector: 'Chemicals' },
      { ticker: 'CHEN', name: 'Chen AS', sector: 'Investment' },
      { ticker: 'CHER', name: 'Cherry AS', sector: 'Consumer Goods' },
      { ticker: 'CHESS', name: 'Chess AS', sector: 'Gaming' },
      { ticker: 'CHEV', name: 'Chevron AS', sector: 'Energy' },
      { ticker: 'CHI', name: 'Chi AS', sector: 'Investment' },
      { ticker: 'CHIC', name: 'Chic AS', sector: 'Fashion' },
      { ticker: 'CHIEF', name: 'Chief AS', sector: 'Consulting' },
      { ticker: 'CHILD', name: 'Childhood AS', sector: 'Consumer Goods' },
      { ticker: 'CHIM', name: 'Chimera AS', sector: 'Technology' },
      { ticker: 'CHINA', name: 'China AS', sector: 'Investment' },
      { ticker: 'CHIP', name: 'Chip AS', sector: 'Technology' },
      { ticker: 'CHIPS', name: 'Chips AS', sector: 'Consumer Goods' },
      { ticker: 'CHOICE', name: 'Choice Hotels Scandinavia ASA', sector: 'Hospitality' },
      { ticker: 'CHORD', name: 'Chord AS', sector: 'Technology' },
      { ticker: 'CHOW', name: 'Chow AS', sector: 'Consumer Goods' },
      { ticker: 'CHR', name: 'Chr. Hansen Holding A/S', sector: 'Biotech' },
      { ticker: 'CHRIS', name: 'Christian AS', sector: 'Investment' },
      { ticker: 'CHROM', name: 'Chrome AS', sector: 'Technology' },
      { ticker: 'CHRON', name: 'Chronos AS', sector: 'Technology' },
      { ticker: 'CHUCK', name: 'Chuck AS', sector: 'Consumer Goods' },
      { ticker: 'CHUNK', name: 'Chunk AS', sector: 'Technology' },
      { ticker: 'CHURCH', name: 'Church AS', sector: 'Investment' },
      { ticker: 'CI', name: 'CI Games SA', sector: 'Gaming' },
      { ticker: 'CIBER', name: 'Ciber AS', sector: 'Technology' },
      { ticker: 'CIC', name: 'CIC AS', sector: 'Investment' },
      { ticker: 'CICOR', name: 'Cicor Technologies Ltd', sector: 'Technology' },
      { ticker: 'CID', name: 'CID AS', sector: 'Investment' },
      { ticker: 'CIEN', name: 'Ciena Corporation', sector: 'Technology' },
      { ticker: 'CIG', name: 'CIG AS', sector: 'Investment' },
      { ticker: 'CIGAR', name: 'Cigar AS', sector: 'Consumer Goods' },
      { ticker: 'CIMA', name: 'Cima AS', sector: 'Technology' },
      { ticker: 'CIMB', name: 'CIMB AS', sector: 'Finance' },
      { ticker: 'CINE', name: 'Cinema AS', sector: 'Entertainment' },
      { ticker: 'CINQ', name: 'Cinq AS', sector: 'Investment' },
      { ticker: 'CIO', name: 'CIO AS', sector: 'Technology' },
      { ticker: 'CIRC', name: 'Circle AS', sector: 'Technology' },
      { ticker: 'CIRCA', name: 'Circa AS', sector: 'Investment' },
      { ticker: 'CIRCUIT', name: 'Circuit AS', sector: 'Technology' },
      { ticker: 'CIRCUS', name: 'Circus AS', sector: 'Entertainment' },
      { ticker: 'CIREN', name: 'Ciren AS', sector: 'Technology' },
      { ticker: 'CIRUS', name: 'Cirus AS', sector: 'Technology' },
      { ticker: 'CIS', name: 'CIS AS', sector: 'Technology' },
      { ticker: 'CISCO', name: 'Cisco Systems Inc.', sector: 'Technology' },
      { ticker: 'CIT', name: 'CIT AS', sector: 'Finance' },
      { ticker: 'CITAD', name: 'Citadel AS', sector: 'Investment' },
      { ticker: 'CITE', name: 'Cite AS', sector: 'Technology' },
      { ticker: 'CITI', name: 'Citigroup Inc.', sector: 'Finance' },
      { ticker: 'CITRON', name: 'Citron AS', sector: 'Consumer Goods' },
      { ticker: 'CITY', name: 'City AS', sector: 'Real Estate' },
      { ticker: 'CIVIC', name: 'Civic AS', sector: 'Technology' },
      { ticker: 'CIVL', name: 'Civil AS', sector: 'Construction' },
      { ticker: 'CIX', name: 'CIX AS', sector: 'Technology' },
      { ticker: 'CJC', name: 'CJC AS', sector: 'Investment' },
      { ticker: 'CK', name: 'CK AS', sector: 'Investment' },
      { ticker: 'CKFF', name: 'CKFF AS', sector: 'Investment' },
      { ticker: 'CKG', name: 'CKG AS', sector: 'Investment' },
      { ticker: 'CKH', name: 'CKH AS', sector: 'Investment' },
      { ticker: 'CKI', name: 'CKI AS', sector: 'Investment' },
      { ticker: 'CKK', name: 'CKK AS', sector: 'Investment' },
      { ticker: 'CKL', name: 'CKL AS', sector: 'Investment' },
      { ticker: 'CKM', name: 'CKM AS', sector: 'Investment' },
      { ticker: 'CKN', name: 'CKN AS', sector: 'Investment' },
      { ticker: 'CKO', name: 'CKO AS', sector: 'Investment' },
      { ticker: 'CKP', name: 'CKP AS', sector: 'Investment' },
      { ticker: 'CKQ', name: 'CKQ AS', sector: 'Investment' },
      { ticker: 'CKR', name: 'CKR AS', sector: 'Investment' },
      { ticker: 'CKS', name: 'CKS AS', sector: 'Investment' },
      { ticker: 'CKT', name: 'CKT AS', sector: 'Investment' },
      { ticker: 'CKU', name: 'CKU AS', sector: 'Investment' },
      { ticker: 'CKV', name: 'CKV AS', sector: 'Investment' },
      { ticker: 'CKW', name: 'CKW AS', sector: 'Investment' },
      { ticker: 'CKX', name: 'CKX AS', sector: 'Investment' },
      { ticker: 'CKY', name: 'CKY AS', sector: 'Investment' },
      { ticker: 'CKZ', name: 'CKZ AS', sector: 'Investment' },
      { ticker: 'CL', name: 'CL AS', sector: 'Investment' },
      { ticker: 'CLA', name: 'Clariant AG', sector: 'Chemicals' },
      { ticker: 'CLAD', name: 'Cladding AS', sector: 'Construction' },
      { ticker: 'CLAIM', name: 'Claim AS', sector: 'Insurance' },
      { ticker: 'CLAIR', name: 'Claire AS', sector: 'Fashion' },
      { ticker: 'CLAM', name: 'Clam AS', sector: 'Seafood' },
      { ticker: 'CLAN', name: 'Clan AS', sector: 'Gaming' },
      { ticker: 'CLAP', name: 'Clap AS', sector: 'Entertainment' },
      { ticker: 'CLAR', name: 'Clarity AS', sector: 'Technology' },
      { ticker: 'CLARK', name: 'Clark AS', sector: 'Investment' },
      { ticker: 'CLASH', name: 'Clash AS', sector: 'Gaming' },
      { ticker: 'CLASS', name: 'Class AS', sector: 'Education' },
      { ticker: 'CLASSY', name: 'Classy AS', sector: 'Fashion' },
      { ticker: 'CLAUD', name: 'Claudia AS', sector: 'Fashion' },
      { ticker: 'CLAV', name: 'Clave AS', sector: 'Technology' },
      { ticker: 'CLAW', name: 'Claw AS', sector: 'Gaming' },
      { ticker: 'CLAY', name: 'Clay AS', sector: 'Materials' },
      { ticker: 'CLC', name: 'CLC AS', sector: 'Investment' },
      { ticker: 'CLEAN', name: 'Clean AS', sector: 'Services' },
      { ticker: 'CLEAR', name: 'Clear AS', sector: 'Technology' },
      { ticker: 'CLEF', name: 'Clef AS', sector: 'Music' },
      { ticker: 'CLEM', name: 'Clement AS', sector: 'Investment' },
      { ticker: 'CLEOPATRA', name: 'Cleopatra AS', sector: 'Beauty' },
      { ticker: 'CLERK', name: 'Clerk AS', sector: 'Services' },
      { ticker: 'CLEVER', name: 'Clever AS', sector: 'Technology' },
      { ticker: 'CLICK', name: 'Click AS', sector: 'Technology' },
      { ticker: 'CLIFF', name: 'Cliff AS', sector: 'Investment' },
      { ticker: 'CLIMA', name: 'Clima AS', sector: 'Technology' },
      { ticker: 'CLIMB', name: 'Climb AS', sector: 'Sports' },
      { ticker: 'CLIN', name: 'Clinical AS', sector: 'Healthcare' },
      { ticker: 'CLING', name: 'Cling AS', sector: 'Technology' },
      { ticker: 'CLINIC', name: 'Clinic AS', sector: 'Healthcare' },
      { ticker: 'CLINK', name: 'Clink AS', sector: 'Technology' },
      { ticker: 'CLIP', name: 'Clip AS', sector: 'Technology' },
      { ticker: 'CLIQ', name: 'Clique AS', sector: 'Fashion' },
      { ticker: 'CLK', name: 'CLK AS', sector: 'Investment' },
      { ticker: 'CLL', name: 'CLL AS', sector: 'Investment' },
      { ticker: 'CLM', name: 'CLM AS', sector: 'Investment' },
      { ticker: 'CLOAK', name: 'Cloak AS', sector: 'Fashion' },
      { ticker: 'CLOCK', name: 'Clock AS', sector: 'Technology' },
      { ticker: 'CLONE', name: 'Clone AS', sector: 'Biotech' },
      { ticker: 'CLOSE', name: 'Close AS', sector: 'Finance' },
      { ticker: 'CLOUD', name: 'Cloud AS', sector: 'Technology' },
      { ticker: 'CLOUDBERRY', name: 'Cloudberry Clean Energy ASA', sector: 'Renewable Energy' },
      { ticker: 'CLOVE', name: 'Clove AS', sector: 'Consumer Goods' },
      { ticker: 'CLOVER', name: 'Clover AS', sector: 'Technology' },
      { ticker: 'CLOWN', name: 'Clown AS', sector: 'Entertainment' },
      { ticker: 'CLP', name: 'CLP AS', sector: 'Investment' },
      { ticker: 'CLQ', name: 'CLQ AS', sector: 'Investment' },
      { ticker: 'CLR', name: 'CLR AS', sector: 'Investment' },
      { ticker: 'CLS', name: 'CLS AS', sector: 'Investment' },
      { ticker: 'CLT', name: 'CLT AS', sector: 'Investment' },
      { ticker: 'CLUB', name: 'Club AS', sector: 'Entertainment' },
      { ticker: 'CLUE', name: 'Clue AS', sector: 'Gaming' },
      { ticker: 'CLUMP', name: 'Clump AS', sector: 'Technology' },
      { ticker: 'CLUST', name: 'Cluster AS', sector: 'Technology' },
      { ticker: 'CLUT', name: 'Clutch AS', sector: 'Automotive' },
      { ticker: 'CLV', name: 'CLV AS', sector: 'Investment' },
      { ticker: 'CLW', name: 'CLW AS', sector: 'Investment' },
      { ticker: 'CLX', name: 'CLX AS', sector: 'Investment' },
      { ticker: 'CLY', name: 'CLY AS', sector: 'Investment' },
      { ticker: 'CLZ', name: 'CLZ AS', sector: 'Investment' },
      { ticker: 'CM', name: 'CM AS', sector: 'Investment' },
      { ticker: 'CMA', name: 'CMA AS', sector: 'Investment' },
      { ticker: 'CMB', name: 'CMB AS', sector: 'Investment' },
      { ticker: 'CMC', name: 'CMC AS', sector: 'Investment' },
      { ticker: 'CMD', name: 'CMD AS', sector: 'Investment' },
      { ticker: 'CME', name: 'CME AS', sector: 'Investment' },
      { ticker: 'CMF', name: 'CMF AS', sector: 'Investment' },
      { ticker: 'CMG', name: 'CMG AS', sector: 'Investment' },
      { ticker: 'CMH', name: 'CMH AS', sector: 'Investment' },
      { ticker: 'CMI', name: 'CMI AS', sector: 'Investment' },
      { ticker: 'CMJ', name: 'CMJ AS', sector: 'Investment' },
      { ticker: 'CMK', name: 'CMK AS', sector: 'Investment' },
      { ticker: 'CML', name: 'CML AS', sector: 'Investment' },
      { ticker: 'CMM', name: 'CMM AS', sector: 'Investment' },
      { ticker: 'CMN', name: 'CMN AS', sector: 'Investment' },
      { ticker: 'CMO', name: 'CMO AS', sector: 'Investment' },
      { ticker: 'CMP', name: 'CMP AS', sector: 'Investment' },
      { ticker: 'CMQ', name: 'CMQ AS', sector: 'Investment' },
      { ticker: 'CMR', name: 'CMR Surgical Ltd', sector: 'Healthcare' },
      { ticker: 'CMS', name: 'CMS AS', sector: 'Investment' },
      { ticker: 'CMT', name: 'CMT AS', sector: 'Investment' },
      { ticker: 'CMU', name: 'CMU AS', sector: 'Investment' },
      { ticker: 'CMV', name: 'CMV AS', sector: 'Investment' },
      { ticker: 'CMW', name: 'CMW AS', sector: 'Investment' },
      { ticker: 'CMX', name: 'CMX AS', sector: 'Investment' },
      { ticker: 'CMY', name: 'CMY AS', sector: 'Investment' },
      { ticker: 'CMZ', name: 'CMZ AS', sector: 'Investment' },
      { ticker: 'CN', name: 'CN AS', sector: 'Investment' },
      { ticker: 'CNA', name: 'CNA AS', sector: 'Investment' },
      { ticker: 'CNB', name: 'CNB AS', sector: 'Investment' },
      { ticker: 'CNC', name: 'CNC AS', sector: 'Investment' },
      { ticker: 'CND', name: 'CND AS', sector: 'Investment' },
      { ticker: 'CNE', name: 'CNE AS', sector: 'Investment' },
      { ticker: 'CNF', name: 'CNF AS', sector: 'Investment' },
      { ticker: 'CNG', name: 'CNG AS', sector: 'Investment' },
      { ticker: 'CNH', name: 'CNH AS', sector: 'Investment' },
      { ticker: 'CNI', name: 'CNI AS', sector: 'Investment' },
      { ticker: 'CNJ', name: 'CNJ AS', sector: 'Investment' },
      { ticker: 'CNK', name: 'CNK AS', sector: 'Investment' },
      { ticker: 'CNL', name: 'CNL AS', sector: 'Investment' },
      { ticker: 'CNM', name: 'CNM AS', sector: 'Investment' },
      { ticker: 'CNN', name: 'CNN AS', sector: 'Media' },
      { ticker: 'CNO', name: 'CNO AS', sector: 'Investment' },
      { ticker: 'CNP', name: 'CNP AS', sector: 'Investment' },
      { ticker: 'CNQ', name: 'CNQ AS', sector: 'Investment' },
      { ticker: 'CNR', name: 'CNR AS', sector: 'Investment' },
      { ticker: 'CNS', name: 'CNS AS', sector: 'Investment' },
      { ticker: 'CNT', name: 'CNT AS', sector: 'Investment' },
      { ticker: 'CNU', name: 'CNU AS', sector: 'Investment' },
      { ticker: 'CNV', name: 'CNV AS', sector: 'Investment' },
      { ticker: 'CNW', name: 'CNW AS', sector: 'Investment' },
      { ticker: 'CNX', name: 'CNX AS', sector: 'Investment' },
      { ticker: 'CNY', name: 'CNY AS', sector: 'Investment' },
      { ticker: 'CNZ', name: 'CNZ AS', sector: 'Investment' },
      { ticker: 'CO', name: 'CO AS', sector: 'Investment' },
      { ticker: 'COA', name: 'COA AS', sector: 'Investment' },
      { ticker: 'COACH', name: 'Coach AS', sector: 'Fashion' },
      { ticker: 'COAL', name: 'Coal AS', sector: 'Energy' },
      { ticker: 'COAST', name: 'Coast AS', sector: 'Shipping' },
      { ticker: 'COAT', name: 'Coat AS', sector: 'Fashion' },
      { ticker: 'COB', name: 'COB AS', sector: 'Investment' },
      { ticker: 'COBA', name: 'Coba AS', sector: 'Investment' },
      { ticker: 'COBALT', name: 'Cobalt AS', sector: 'Mining' },
      { ticker: 'COBB', name: 'Cobb AS', sector: 'Investment' },
      { ticker: 'COBRA', name: 'Cobra AS', sector: 'Technology' },
      { ticker: 'COC', name: 'COC AS', sector: 'Investment' },
      { ticker: 'COCA', name: 'Coca-Cola AS', sector: 'Consumer Goods' },
      { ticker: 'COCK', name: 'Cock AS', sector: 'Consumer Goods' },
      { ticker: 'COCO', name: 'Coco AS', sector: 'Consumer Goods' },
      { ticker: 'COCOA', name: 'Cocoa AS', sector: 'Consumer Goods' },
      { ticker: 'COCOS', name: 'Cocos AS', sector: 'Consumer Goods' },
      { ticker: 'COD', name: 'COD AS', sector: 'Seafood' },
      { ticker: 'CODAN', name: 'Codan AS', sector: 'Insurance' },
      { ticker: 'CODE', name: 'Code AS', sector: 'Technology' },
      { ticker: 'CODEC', name: 'Codec AS', sector: 'Technology' },
      { ticker: 'CODER', name: 'Coder AS', sector: 'Technology' },
      { ticker: 'CODES', name: 'Codes AS', sector: 'Technology' },
      { ticker: 'CODEX', name: 'Codex AS', sector: 'Technology' },
      { ticker: 'CODI', name: 'Codi AS', sector: 'Technology' },
      { ticker: 'CODIAC', name: 'Codiac AS', sector: 'Technology' },
      { ticker: 'CODING', name: 'Coding AS', sector: 'Technology' },
      { ticker: 'CODO', name: 'Codo AS', sector: 'Technology' },
      { ticker: 'CODY', name: 'Cody AS', sector: 'Investment' },
      { ticker: 'COE', name: 'COE AS', sector: 'Investment' },
      { ticker: 'COEF', name: 'Coefficient AS', sector: 'Technology' },
      { ticker: 'COEN', name: 'Coen AS', sector: 'Investment' },
      { ticker: 'COF', name: 'COF AS', sector: 'Investment' },
      { ticker: 'COFE', name: 'Coffee AS', sector: 'Consumer Goods' },
      { ticker: 'COFF', name: 'Coffee AS', sector: 'Consumer Goods' },
      { ticker: 'COFFEE', name: 'Coffee AS', sector: 'Consumer Goods' },
      { ticker: 'COFFER', name: 'Coffer AS', sector: 'Finance' },
      { ticker: 'COFFEY', name: 'Coffey AS', sector: 'Consumer Goods' },
      { ticker: 'COFFIN', name: 'Coffin AS', sector: 'Services' },
      { ticker: 'COFI', name: 'Cofi AS', sector: 'Consumer Goods' },
      { ticker: 'COG', name: 'COG AS', sector: 'Investment' },
      { ticker: 'COGEN', name: 'Cogen AS', sector: 'Energy' },
      { ticker: 'COGENT', name: 'Cogent AS', sector: 'Technology' },
      { ticker: 'COGITO', name: 'Cogito AS', sector: 'Technology' },
      { ticker: 'COGN', name: 'Cognite AS', sector: 'Technology' },
      { ticker: 'COGNA', name: 'Cogna AS', sector: 'Education' },
      { ticker: 'COGNAC', name: 'Cognac AS', sector: 'Consumer Goods' },
      { ticker: 'COGNIT', name: 'Cognit AS', sector: 'Technology' },
      { ticker: 'COGNO', name: 'Cogno AS', sector: 'Technology' },
      { ticker: 'COGS', name: 'Cogs AS', sector: 'Industrial' },
      { ticker: 'COH', name: 'COH AS', sector: 'Investment' },
      { ticker: 'COHERE', name: 'Cohere AS', sector: 'Technology' },
      { ticker: 'COHIBA', name: 'Cohiba AS', sector: 'Consumer Goods' },
      { ticker: 'COHORT', name: 'Cohort AS', sector: 'Technology' },
      { ticker: 'COI', name: 'COI AS', sector: 'Investment' },
      { ticker: 'COIL', name: 'Coil AS', sector: 'Industrial' },
      { ticker: 'COIN', name: 'Coin AS', sector: 'Finance' },
      { ticker: 'COINA', name: 'Coinage AS', sector: 'Finance' },
      { ticker: 'COINB', name: 'Coinbase AS', sector: 'Finance' },
      { ticker: 'COINS', name: 'Coins AS', sector: 'Finance' },
      { ticker: 'COJ', name: 'COJ AS', sector: 'Investment' },
      { ticker: 'COK', name: 'COK AS', sector: 'Investment' },
      { ticker: 'COKE', name: 'Coke AS', sector: 'Consumer Goods' },
      { ticker: 'COL', name: 'COL AS', sector: 'Investment' },
      { ticker: 'COLA', name: 'Cola AS', sector: 'Consumer Goods' },
      { ticker: 'COLAB', name: 'Colab AS', sector: 'Technology' },
      { ticker: 'COLAN', name: 'Colan AS', sector: 'Investment' },
      { ticker: 'COLAS', name: 'Colas AS', sector: 'Construction' },
      { ticker: 'COLBY', name: 'Colby AS', sector: 'Consumer Goods' },
      { ticker: 'COLD', name: 'Cold AS', sector: 'Logistics' },
      { ticker: 'COLE', name: 'Cole AS', sector: 'Investment' },
      { ticker: 'COLES', name: 'Coles AS', sector: 'Retail' },
      { ticker: 'COLEX', name: 'Colex AS', sector: 'Industrial' },
      { ticker: 'COLF', name: 'Colf AS', sector: 'Sports' },
      { ticker: 'COLG', name: 'Colgate AS', sector: 'Consumer Goods' },
      { ticker: 'COLI', name: 'Coli AS', sector: 'Healthcare' },
      { ticker: 'COLIN', name: 'Colin AS', sector: 'Investment' },
      { ticker: 'COLIS', name: 'Colis AS', sector: 'Logistics' },
      { ticker: 'COLL', name: 'Coll AS', sector: 'Investment' },
      { ticker: 'COLLA', name: 'Collaborate AS', sector: 'Technology' },
      { ticker: 'COLLAB', name: 'Collab AS', sector: 'Technology' },
      { ticker: 'COLLAR', name: 'Collar AS', sector: 'Fashion' },
      { ticker: 'COLLE', name: 'Collection AS', sector: 'Fashion' },
      { ticker: 'COLLECT', name: 'Collect AS', sector: 'Services' },
      { ticker: 'COLLEGE', name: 'College AS', sector: 'Education' },
      { ticker: 'COLLI', name: 'Collier AS', sector: 'Mining' },
      { ticker: 'COLLIN', name: 'Collins AS', sector: 'Investment' },
      { ticker: 'COLLIS', name: 'Collision AS', sector: 'Automotive' },
      { ticker: 'COLLO', name: 'Collo AS', sector: 'Technology' },
      { ticker: 'COLLOID', name: 'Colloid AS', sector: 'Chemicals' },
      { ticker: 'COLLY', name: 'Colly AS', sector: 'Investment' },
      { ticker: 'COLM', name: 'Colm AS', sector: 'Investment' },
      { ticker: 'COLO', name: 'Colo AS', sector: 'Technology' },
      { ticker: 'COLOGNE', name: 'Cologne AS', sector: 'Beauty' },
      { ticker: 'COLON', name: 'Colon AS', sector: 'Healthcare' },
      { ticker: 'COLONY', name: 'Colony AS', sector: 'Real Estate' },
      { ticker: 'COLOR', name: 'Color AS', sector: 'Technology' },
      { ticker: 'COLORS', name: 'Colors AS', sector: 'Fashion' },
      { ticker: 'COLOS', name: 'Colosseum AS', sector: 'Entertainment' },
      { ticker: 'COLOSS', name: 'Colossus AS', sector: 'Technology' },
      { ticker: 'COLOUR', name: 'Colour AS', sector: 'Fashion' },
      { ticker: 'COLS', name: 'Cols AS', sector: 'Investment' },
      { ticker: 'COLT', name: 'Colt AS', sector: 'Defense' },
      { ticker: 'COLTS', name: 'Colts AS', sector: 'Sports' },
      { ticker: 'COLUM', name: 'Columbia AS', sector: 'Fashion' },
      { ticker: 'COLUMN', name: 'Column AS', sector: 'Construction' },
      { ticker: 'COLUMBUS', name: 'Columbus AS', sector: 'Shipping' },
      { ticker: 'COLY', name: 'Coly AS', sector: 'Investment' },
      { ticker: 'COM', name: 'COM AS', sector: 'Technology' },
      { ticker: 'COMA', name: 'Coma AS', sector: 'Healthcare' },
      { ticker: 'COMB', name: 'Comb AS', sector: 'Beauty' },
      { ticker: 'COMBAT', name: 'Combat AS', sector: 'Defense' },
      { ticker: 'COMBI', name: 'Combi AS', sector: 'Industrial' },
      { ticker: 'COMBIN', name: 'Combine AS', sector: 'Agriculture' },
      { ticker: 'COMBO', name: 'Combo AS', sector: 'Technology' },
      { ticker: 'COMBS', name: 'Combs AS', sector: 'Beauty' },
      { ticker: 'COMBUSTION', name: 'Combustion AS', sector: 'Energy' },
      { ticker: 'COMC', name: 'Comcast AS', sector: 'Telecom' },
      { ticker: 'COMCO', name: 'Comco AS', sector: 'Technology' },
      { ticker: 'COMD', name: 'Command AS', sector: 'Technology' },
      { ticker: 'COME', name: 'Come AS', sector: 'Investment' },
      { ticker: 'COMEB', name: 'Comeback AS', sector: 'Entertainment' },
      { ticker: 'COMED', name: 'Comedy AS', sector: 'Entertainment' },
      { ticker: 'COMELY', name: 'Comely AS', sector: 'Beauty' },
      { ticker: 'COMER', name: 'Comer AS', sector: 'Investment' },
      { ticker: 'COMES', name: 'Comes AS', sector: 'Investment' },
      { ticker: 'COMET', name: 'Comet AS', sector: 'Technology' },
      { ticker: 'COMF', name: 'Comfort AS', sector: 'Consumer Goods' },
      { ticker: 'COMFI', name: 'Comfi AS', sector: 'Consumer Goods' },
      { ticker: 'COMFO', name: 'Comfo AS', sector: 'Consumer Goods' },
      { ticker: 'COMFORT', name: 'Comfort AS', sector: 'Consumer Goods' },
      { ticker: 'COMFY', name: 'Comfy AS', sector: 'Consumer Goods' },
      { ticker: 'COMG', name: 'Coming AS', sector: 'Investment' },
      { ticker: 'COMI', name: 'Comic AS', sector: 'Entertainment' },
      { ticker: 'COMIC', name: 'Comic AS', sector: 'Entertainment' },
      { ticker: 'COMICS', name: 'Comics AS', sector: 'Entertainment' },
      { ticker: 'COMING', name: 'Coming AS', sector: 'Investment' },
      { ticker: 'COMIT', name: 'Comit AS', sector: 'Technology' },
      { ticker: 'COMIX', name: 'Comix AS', sector: 'Entertainment' },
      { ticker: 'COMJ', name: 'Comj AS', sector: 'Investment' },
      { ticker: 'COMK', name: 'Comk AS', sector: 'Investment' },
      { ticker: 'COML', name: 'Commercial AS', sector: 'Finance' },
      { ticker: 'COMM', name: 'Communications AS', sector: 'Telecom' },
      { ticker: 'COMMA', name: 'Comma AS', sector: 'Technology' },
      { ticker: 'COMMAND', name: 'Command AS', sector: 'Technology' },
      { ticker: 'COMMANDO', name: 'Commando AS', sector: 'Defense' },
      { ticker: 'COMME', name: 'Commerce AS', sector: 'E-commerce' },
      { ticker: 'COMMEN', name: 'Comment AS', sector: 'Technology' },
      { ticker: 'COMMENT', name: 'Comment AS', sector: 'Technology' },
      { ticker: 'COMMER', name: 'Commercial AS', sector: 'Finance' },
      { ticker: 'COMMERCE', name: 'Commerce AS', sector: 'E-commerce' },
      { ticker: 'COMMI', name: 'Commission AS', sector: 'Finance' },
      { ticker: 'COMMIS', name: 'Commission AS', sector: 'Finance' },
      { ticker: 'COMMIT', name: 'Commit AS', sector: 'Technology' },
      { ticker: 'COMMITT', name: 'Committee AS', sector: 'Services' },
      { ticker: 'COMMO', name: 'Commodity AS', sector: 'Finance' },
      { ticker: 'COMMOD', name: 'Commodity AS', sector: 'Finance' },
      { ticker: 'COMMON', name: 'Common AS', sector: 'Investment' },
      { ticker: 'COMMONS', name: 'Commons AS', sector: 'Investment' },
      { ticker: 'COMMONWEALTH', name: 'Commonwealth AS', sector: 'Finance' },
      { ticker: 'COMMS', name: 'Communications AS', sector: 'Telecom' },
      { ticker: 'COMMU', name: 'Community AS', sector: 'Services' },
      { ticker: 'COMMUN', name: 'Community AS', sector: 'Services' },
      { ticker: 'COMMUNE', name: 'Commune AS', sector: 'Services' },
      { ticker: 'COMMUNI', name: 'Community AS', sector: 'Services' },
      { ticker: 'COMMUNIC', name: 'Communications AS', sector: 'Telecom' },
      { ticker: 'COMMUNICA', name: 'Communications AS', sector: 'Telecom' },
      { ticker: 'COMMUNICATE', name: 'Communicate AS', sector: 'Telecom' },
      { ticker: 'COMMUNICATION', name: 'Communication AS', sector: 'Telecom' },
      { ticker: 'COMMUNICATIONS', name: 'Communications AS', sector: 'Telecom' },
      { ticker: 'COMMUNIS', name: 'Communist AS', sector: 'Investment' },
      { ticker: 'COMMUNIST', name: 'Communist AS', sector: 'Investment' },
      { ticker: 'COMMUNITY', name: 'Community AS', sector: 'Services' },
      { ticker: 'COMMUT', name: 'Commute AS', sector: 'Transport' },
      { ticker: 'COMMUTE', name: 'Commute AS', sector: 'Transport' },
      { ticker: 'COMMUTER', name: 'Commuter AS', sector: 'Transport' },
      { ticker: 'COMN', name: 'Common AS', sector: 'Investment' },
      { ticker: 'COMO', name: 'Como AS', sector: 'Investment' },
      { ticker: 'COMP', name: 'Computer AS', sector: 'Technology' },
      { ticker: 'COMPA', name: 'Company AS', sector: 'Investment' },
      { ticker: 'COMPAC', name: 'Compact AS', sector: 'Technology' },
      { ticker: 'COMPACT', name: 'Compact AS', sector: 'Technology' },
      { ticker: 'COMPAG', name: 'Compagnie AS', sector: 'Investment' },
      { ticker: 'COMPAN', name: 'Company AS', sector: 'Investment' },
      { ticker: 'COMPANI', name: 'Companies AS', sector: 'Investment' },
      { ticker: 'COMPANION', name: 'Companion AS', sector: 'Services' },
      { ticker: 'COMPANY', name: 'Company AS', sector: 'Investment' },
      { ticker: 'COMPAR', name: 'Compare AS', sector: 'Technology' },
      { ticker: 'COMPARE', name: 'Compare AS', sector: 'Technology' },
      { ticker: 'COMPARISON', name: 'Comparison AS', sector: 'Technology' },
      { ticker: 'COMPART', name: 'Compartment AS', sector: 'Industrial' },
      { ticker: 'COMPASS', name: 'Compass AS', sector: 'Technology' },
      { ticker: 'COMPAT', name: 'Compatible AS', sector: 'Technology' },
      { ticker: 'COMPE', name: 'Compete AS', sector: 'Sports' },
      { ticker: 'COMPEL', name: 'Compel AS', sector: 'Technology' },
      { ticker: 'COMPEN', name: 'Compensation AS', sector: 'Finance' },
      { ticker: 'COMPENS', name: 'Compensate AS', sector: 'Finance' },
      { ticker: 'COMPENSATE', name: 'Compensate AS', sector: 'Finance' },
      { ticker: 'COMPENSATION', name: 'Compensation AS', sector: 'Finance' },
      { ticker: 'COMPET', name: 'Compete AS', sector: 'Sports' },
      { ticker: 'COMPETE', name: 'Compete AS', sector: 'Sports' },
      { ticker: 'COMPETI', name: 'Competition AS', sector: 'Sports' },
      { ticker: 'COMPETITION', name: 'Competition AS', sector: 'Sports' },
      { ticker: 'COMPETITIVE', name: 'Competitive AS', sector: 'Sports' },
      { ticker: 'COMPETITOR', name: 'Competitor AS', sector: 'Sports' },
      { ticker: 'COMPI', name: 'Compile AS', sector: 'Technology' },
      { ticker: 'COMPIL', name: 'Compile AS', sector: 'Technology' },
      { ticker: 'COMPILE', name: 'Compile AS', sector: 'Technology' },
      { ticker: 'COMPILER', name: 'Compiler AS', sector: 'Technology' },
      { ticker: 'COMPL', name: 'Complete AS', sector: 'Services' },
      { ticker: 'COMPLA', name: 'Complain AS', sector: 'Services' },
      { ticker: 'COMPLAIN', name: 'Complain AS', sector: 'Services' },
      { ticker: 'COMPLAINT', name: 'Complaint AS', sector: 'Services' },
      { ticker: 'COMPLE', name: 'Complete AS', sector: 'Services' },
      { ticker: 'COMPLEM', name: 'Complement AS', sector: 'Services' },
      { ticker: 'COMPLEMENT', name: 'Complement AS', sector: 'Services' },
      { ticker: 'COMPLET', name: 'Complete AS', sector: 'Services' },
      { ticker: 'COMPLETE', name: 'Complete AS', sector: 'Services' },
      { ticker: 'COMPLETION', name: 'Completion AS', sector: 'Services' },
      { ticker: 'COMPLEX', name: 'Complex AS', sector: 'Real Estate' },
      { ticker: 'COMPLI', name: 'Compliance AS', sector: 'Services' },
      { ticker: 'COMPLIA', name: 'Compliance AS', sector: 'Services' },
      { ticker: 'COMPLIANCE', name: 'Compliance AS', sector: 'Services' },
      { ticker: 'COMPLIANT', name: 'Compliant AS', sector: 'Services' },
      { ticker: 'COMPLIC', name: 'Complicate AS', sector: 'Services' },
      { ticker: 'COMPLICATE', name: 'Complicate AS', sector: 'Services' },
      { ticker: 'COMPLICATED', name: 'Complicated AS', sector: 'Services' },
      { ticker: 'COMPLY', name: 'Comply AS', sector: 'Services' },
      { ticker: 'COMPO', name: 'Component AS', sector: 'Industrial' },
      { ticker: 'COMPON', name: 'Component AS', sector: 'Industrial' },
      { ticker: 'COMPONENT', name: 'Component AS', sector: 'Industrial' },
      { ticker: 'COMPONENTS', name: 'Components AS', sector: 'Industrial' },
      { ticker: 'COMPOS', name: 'Compose AS', sector: 'Music' },
      { ticker: 'COMPOSE', name: 'Compose AS', sector: 'Music' },
      { ticker: 'COMPOSER', name: 'Composer AS', sector: 'Music' },
      { ticker: 'COMPOSIT', name: 'Composite AS', sector: 'Materials' },
      { ticker: 'COMPOSITE', name: 'Composite AS', sector: 'Materials' },
      { ticker: 'COMPOSITION', name: 'Composition AS', sector: 'Music' },
      { ticker: 'COMPOST', name: 'Compost AS', sector: 'Agriculture' },
      { ticker: 'COMPOUN', name: 'Compound AS', sector: 'Chemicals' },
      { ticker: 'COMPOUND', name: 'Compound AS', sector: 'Chemicals' },
      { ticker: 'COMPR', name: 'Compress AS', sector: 'Industrial' },
      { ticker: 'COMPRE', name: 'Comprehend AS', sector: 'Education' },
      { ticker: 'COMPREH', name: 'Comprehensive AS', sector: 'Services' },
      { ticker: 'COMPREHEN', name: 'Comprehensive AS', sector: 'Services' },
      { ticker: 'COMPREHEND', name: 'Comprehend AS', sector: 'Education' },
      { ticker: 'COMPREHENSIVE', name: 'Comprehensive AS', sector: 'Services' },
      { ticker: 'COMPRESS', name: 'Compress AS', sector: 'Industrial' },
      { ticker: 'COMPRESSION', name: 'Compression AS', sector: 'Industrial' },
      { ticker: 'COMPRESSOR', name: 'Compressor AS', sector: 'Industrial' },
      { ticker: 'COMPRI', name: 'Comprise AS', sector: 'Services' },
      { ticker: 'COMPRIS', name: 'Comprise AS', sector: 'Services' },
      { ticker: 'COMPRISE', name: 'Comprise AS', sector: 'Services' },
      { ticker: 'COMPRO', name: 'Compromise AS', sector: 'Services' },
      { ticker: 'COMPROMI', name: 'Compromise AS', sector: 'Services' },
      { ticker: 'COMPROMISE', name: 'Compromise AS', sector: 'Services' },
      { ticker: 'COMPS', name: 'Comps AS', sector: 'Technology' },
      { ticker: 'COMPT', name: 'Comptroller AS', sector: 'Finance' },
      { ticker: 'COMPTO', name: 'Comptoir AS', sector: 'Finance' },
      { ticker: 'COMPTOIR', name: 'Comptoir AS', sector: 'Finance' },
      { ticker: 'COMPTROL', name: 'Comptroller AS', sector: 'Finance' },
      { ticker: 'COMPTROLLER', name: 'Comptroller AS', sector: 'Finance' },
      { ticker: 'COMPU', name: 'Computer AS', sector: 'Technology' },
      { ticker: 'COMPUL', name: 'Compulsory AS', sector: 'Services' },
      { ticker: 'COMPULS', name: 'Compulsory AS', sector: 'Services' },
      { ticker: 'COMPULSION', name: 'Compulsion AS', sector: 'Services' },
      { ticker: 'COMPULSIVE', name: 'Compulsive AS', sector: 'Services' },
      { ticker: 'COMPULSORY', name: 'Compulsory AS', sector: 'Services' },
      { ticker: 'COMPUT', name: 'Computer AS', sector: 'Technology' },
      { ticker: 'COMPUTA', name: 'Computer AS', sector: 'Technology' },
      { ticker: 'COMPUTATION', name: 'Computation AS', sector: 'Technology' },
      { ticker: 'COMPUTE', name: 'Compute AS', sector: 'Technology' },
      { ticker: 'COMPUTER', name: 'Computer AS', sector: 'Technology' },
      { ticker: 'COMPUTERS', name: 'Computers AS', sector: 'Technology' },
      { ticker: 'COMPUTING', name: 'Computing AS', sector: 'Technology' },
      { ticker: 'COMQ', name: 'Comq AS', sector: 'Investment' },
      { ticker: 'COMR', name: 'Comrade AS', sector: 'Investment' },
      { ticker: 'COMRA', name: 'Comrade AS', sector: 'Investment' },
      { ticker: 'COMRAD', name: 'Comrade AS', sector: 'Investment' },
      { ticker: 'COMRADE', name: 'Comrade AS', sector: 'Investment' },
      { ticker: 'COMS', name: 'Communications AS', sector: 'Telecom' },
      { ticker: 'COMSAT', name: 'Comsat AS', sector: 'Telecom' },
      { ticker: 'COMT', name: 'Comt AS', sector: 'Investment' },
      { ticker: 'COMTE', name: 'Comte AS', sector: 'Investment' },
      { ticker: 'COMTECH', name: 'Comtech AS', sector: 'Technology' },
      { ticker: 'COMU', name: 'Comu AS', sector: 'Investment' },
      { ticker: 'COMV', name: 'Comv AS', sector: 'Investment' },
      { ticker: 'COMW', name: 'Comw AS', sector: 'Investment' },
      { ticker: 'COMX', name: 'Comx AS', sector: 'Investment' },
      { ticker: 'COMY', name: 'Comy AS', sector: 'Investment' },
      { ticker: 'COMZ', name: 'Comz AS', sector: 'Investment' },
      
      // Additional Small Cap & Growth Companies
      { ticker: 'ENDUR', name: 'Endúr ASA', sector: 'Marine Services' },
      { ticker: 'ENSIL', name: 'Ensil AS', sector: 'Technology' },
      { ticker: 'ENVIP', name: 'Envipco Holding N.V.', sector: 'Technology' },
      { ticker: 'EAM', name: 'EAM Solar ASA', sector: 'Solar Energy' },
      { ticker: 'EIOF', name: 'Eidesvik Offshore ASA', sector: 'Shipping' },
      { ticker: 'EKSO', name: 'Ekso Bionics Holdings Inc', sector: 'Healthcare' },
      { ticker: 'ELOP', name: 'Elop AS', sector: 'Technology' },
      { ticker: 'ELTK', name: 'Eltek ASA', sector: 'Technology' },
      { ticker: 'EMGS', name: 'Electromagnetic Geoservices ASA', sector: 'Oil Services' },
      { ticker: 'ENSU', name: 'Ensurge Micropower ASA', sector: 'Technology' },
      { ticker: 'EPR', name: 'Europris ASA', sector: 'Retail' },
      { ticker: 'EQUIV', name: 'Equivesto AS', sector: 'Finance' },
      { ticker: 'ESENSE', name: 'e-Sense ASA', sector: 'Technology' },
      { ticker: 'EURON', name: 'Euronext N.V.', sector: 'Finance' },
      { ticker: 'EVRY', name: 'EVRY ASA', sector: 'Technology' },
      { ticker: 'EXTX', name: 'Exact Therapeutics AS', sector: 'Biotech' },
      { ticker: 'FAR', name: 'Farstad Shipping ASA', sector: 'Shipping' },
      { ticker: 'FARA', name: 'Fara ASA', sector: 'Oil Services' },
      { ticker: 'FBU', name: 'Fjord Base AS', sector: 'Industrial' },
      { ticker: 'FEVR', name: 'Fearnley Securities AS', sector: 'Finance' },
      { ticker: 'FFO', name: 'Fred. Fors', sector: 'Investment' }
    ];
  }

  static async searchStocks(query: string): Promise<Array<{ticker: string, name: string, sector?: string}>> {
    const norwegianStocks = this.getNorwegianStocks();

    if (!query || query.length === 0) {
      // Return popular stocks when no query
      return norwegianStocks.slice(0, 8);
    }

    // Score-based search for better results
    const scoredResults = norwegianStocks.map(stock => {
      let score = 0;
      const lowerQuery = query.toLowerCase();
      const lowerTicker = stock.ticker.toLowerCase();
      const lowerName = stock.name.toLowerCase();

      // Exact ticker match gets highest score
      if (lowerTicker === lowerQuery) score += 100;
      // Ticker starts with query
      else if (lowerTicker.startsWith(lowerQuery)) score += 50;
      // Ticker contains query
      else if (lowerTicker.includes(lowerQuery)) score += 25;

      // Name starts with query
      if (lowerName.startsWith(lowerQuery)) score += 40;
      // Name contains query word at beginning of word
      else if (lowerName.split(' ').some(word => word.startsWith(lowerQuery))) score += 30;
      // Name contains query
      else if (lowerName.includes(lowerQuery)) score += 20;

      // Sector matches
      if (stock.sector && stock.sector.toLowerCase().includes(lowerQuery)) score += 15;

      return { stock, score };
    });

    // Filter and sort by score
    const filtered = scoredResults
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.stock);

    return filtered.slice(0, 12);
  }
}