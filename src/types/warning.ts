export type WarningSeverity = 'INFO' | 'WARNING' | 'ERROR';

export interface DataQualityWarning {
  id: string;
  severity: WarningSeverity;
  message: string;
  affectedEventIds?: string[];
  suggestedFix?: string;
}
