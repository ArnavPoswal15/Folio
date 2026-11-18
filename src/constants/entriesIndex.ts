import { RangePresetOption } from '../types/entriesIndex';

/** Quick date-range filter pills displayed in the Entries Index filter bar. */
export const ENTRY_RANGE_PRESET_OPTIONS: RangePresetOption[] = [
  { id: 'all', label: 'All dates' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '3 months' },
  { id: 'custom', label: 'Custom range' },
];
