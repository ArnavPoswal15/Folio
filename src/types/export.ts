/** Selectable export window identifiers for CSV download. */
export type ExportDurationId = '1w' | '2w' | '1m' | '3m' | '6m' | '12m' | 'all';

/** Descriptor for an export time-range button option. */
export interface ExportDurationOption {
  id: ExportDurationId;
  label: string;
  shortLabel: string;
}
