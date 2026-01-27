export type AccountType = 'ASK' | 'VPS_ORDINARY' | 'IPS';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  baseCurrency: 'NOK';
  createdAt: string;
}
