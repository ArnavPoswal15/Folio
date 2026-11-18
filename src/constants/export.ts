import { ExportDurationOption } from '../types/export';

/** Time-range export options offered in the CSV Export modal. */
export const EXPORT_DURATION_OPTIONS: ExportDurationOption[] = [
  { id: '1w', label: '1 Week', shortLabel: '1-week' },
  { id: '2w', label: '2 Weeks', shortLabel: '2-weeks' },
  { id: '1m', label: '1 Month', shortLabel: '1-month' },
  { id: '3m', label: '3 Months', shortLabel: '3-months' },
  { id: '6m', label: '6 Months', shortLabel: '6-months' },
  { id: '12m', label: '12 Months', shortLabel: '12-months' },
  { id: 'all', label: 'All Time', shortLabel: 'all-time' },
];

/** Ordered column headers written into exported journal CSV files. */
export const EXPORT_CSV_HEADERS: readonly string[] = [
  'Date',
  'Weekday',
  'Setting / Mood',
  'Ink Tone',
  'Paper Style',
  'Left Page',
  'Right Page',
  'Last Updated',
];
