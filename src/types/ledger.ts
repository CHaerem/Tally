import type { Account } from './account';
import type { Instrument } from './instrument';
import type { LedgerEvent } from './event';
import type { DataQualityWarning } from './warning';

export const LEDGER_VERSION = 2;

export interface LedgerState {
  version: number;
  accounts: Account[];
  instruments: Instrument[];
  events: LedgerEvent[];
  warnings: DataQualityWarning[];
  lastModified: string;
}

export function createEmptyLedger(): LedgerState {
  return {
    version: LEDGER_VERSION,
    accounts: [],
    instruments: [],
    events: [],
    warnings: [],
    lastModified: new Date().toISOString(),
  };
}
