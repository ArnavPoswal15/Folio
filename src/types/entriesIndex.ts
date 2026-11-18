import { JournalSpread } from './journal';

/** Chronological sort direction in the Entries Index modal. */
export type SortOrder = 'desc' | 'asc';

/** Quick date-range preset identifiers in the Entries Index modal. */
export type RangePreset = 'all' | '7d' | '30d' | '90d' | 'custom';

/** Spread paired with its original index in the chronological journal store. */
export interface IndexedSpread {
  spread: JournalSpread;
  originalIndex: number;
}

/** Descriptor for a date range preset pill button. */
export interface RangePresetOption {
  id: RangePreset;
  label: string;
}
