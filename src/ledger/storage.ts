import type { LedgerState, LedgerEvent, Instrument, DataQualityWarning } from '../types';
import { createEmptyLedger } from '../types';

const STORAGE_KEY = 'tally_ledger_v2';

export class LedgerStorage {
  static saveLedger(state: LedgerState): void {
    const toStore = { ...state, lastModified: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  }

  static loadLedger(): LedgerState | null {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as LedgerState;
  }

  static initializeLedger(): LedgerState {
    const existing = this.loadLedger();
    if (existing) return existing;

    const ledger = createEmptyLedger();
    ledger.accounts.push({
      id: 'default',
      name: 'Hovedkonto',
      type: 'VPS_ORDINARY',
      baseCurrency: 'NOK',
      createdAt: new Date().toISOString(),
    });
    this.saveLedger(ledger);
    return ledger;
  }

  static clearLedger(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  static addEvents(events: LedgerEvent[]): LedgerState {
    const ledger = this.loadLedger() || this.initializeLedger();
    ledger.events.push(...events);
    this.saveLedger(ledger);
    return ledger;
  }

  static upsertInstrument(instrument: Instrument): LedgerState {
    const ledger = this.loadLedger() || this.initializeLedger();
    const index = ledger.instruments.findIndex(i => i.isin === instrument.isin);
    if (index >= 0) ledger.instruments[index] = instrument;
    else ledger.instruments.push(instrument);
    this.saveLedger(ledger);
    return ledger;
  }

  static addWarning(warning: DataQualityWarning): LedgerState {
    const ledger = this.loadLedger() || this.initializeLedger();
    ledger.warnings.push(warning);
    this.saveLedger(ledger);
    return ledger;
  }

  static exportAsJSON(): string {
    const ledger = this.loadLedger();
    return JSON.stringify(ledger || createEmptyLedger(), null, 2);
  }
}
