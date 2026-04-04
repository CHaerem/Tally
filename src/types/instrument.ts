export type InstrumentType = 'STOCK' | 'FUND';

export interface Instrument {
  isin: string;
  ticker: string;
  name: string;
  currency: 'NOK';
  instrumentType?: InstrumentType;
}
