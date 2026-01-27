export type EventType = 'TRADE_BUY' | 'TRADE_SELL' | 'DIVIDEND' | 'FEE' | 'CASH_IN' | 'CASH_OUT';
export type EventSource = 'MANUAL' | 'CSV_IMPORT';

export interface BaseEvent {
  id: string;
  accountId: string;
  date: string;
  type: EventType;
  amount: number;
  currency: 'NOK';
  createdAt: string;
  source: EventSource;
  notes?: string;
}

export interface TradeEvent extends BaseEvent {
  type: 'TRADE_BUY' | 'TRADE_SELL';
  isin: string;
  quantity: number;
  pricePerShare: number;
  fee?: number;
}

export interface DividendEvent extends BaseEvent {
  type: 'DIVIDEND';
  isin: string;
  quantity: number;
  perShare: number;
  withholdingTax?: number;
}

export interface FeeEvent extends BaseEvent {
  type: 'FEE';
  description: string;
}

export interface CashEvent extends BaseEvent {
  type: 'CASH_IN' | 'CASH_OUT';
}

export type LedgerEvent = TradeEvent | DividendEvent | FeeEvent | CashEvent;

export function isTradeEvent(event: LedgerEvent): event is TradeEvent {
  return event.type === 'TRADE_BUY' || event.type === 'TRADE_SELL';
}

export function isDividendEvent(event: LedgerEvent): event is DividendEvent {
  return event.type === 'DIVIDEND';
}

export function isFeeEvent(event: LedgerEvent): event is FeeEvent {
  return event.type === 'FEE';
}

export function isCashEvent(event: LedgerEvent): event is CashEvent {
  return event.type === 'CASH_IN' || event.type === 'CASH_OUT';
}
