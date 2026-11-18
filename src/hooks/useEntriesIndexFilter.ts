import { useCallback, useMemo, useState } from 'react';
import { RangePreset, SortOrder } from '../types/entriesIndex';
import { JournalSpread } from '../types/journal';
import {
  extractAvailableMonths,
  filterAndSortSpreads,
} from '../utils/entriesFilter';
import { useEscapeKey } from './useEscapeKey';

/**
 * Manages sort order, month filter, quick range presets, and custom date bounds for the Entries Index modal.
 * @param isOpen - Whether the Entries Index modal is currently visible.
 * @param spreads - Full chronological list of journal spreads.
 * @param onClose - Callback invoked when dismissing via Escape.
 * @returns Filter state, computed month/entry lists, and filter action handlers.
 */
export function useEntriesIndexFilter(
  isOpen: boolean,
  spreads: JournalSpread[],
  onClose: () => void
) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [rangePreset, setRangePreset] = useState<RangePreset>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  useEscapeKey(isOpen, onClose);

  const availableMonths = useMemo(
    () => extractAvailableMonths(spreads),
    [spreads]
  );

  const filteredEntries = useMemo(
    () =>
      filterAndSortSpreads(
        spreads,
        sortOrder,
        monthFilter,
        rangePreset,
        fromDate,
        toDate
      ),
    [fromDate, monthFilter, rangePreset, sortOrder, spreads, toDate]
  );

  const hasActiveFilters =
    monthFilter !== 'all' ||
    rangePreset !== 'all' ||
    fromDate !== '' ||
    toDate !== '';

  const resetFilters = useCallback(() => {
    setMonthFilter('all');
    setRangePreset('all');
    setFromDate('');
    setToDate('');
  }, []);

  const handleSelectMonth = useCallback((value: string) => {
    setMonthFilter(value);
    if (value !== 'all') {
      setRangePreset('all');
    }
  }, []);

  const handleSelectRange = useCallback((preset: RangePreset) => {
    setRangePreset(preset);
    if (preset !== 'all') {
      setMonthFilter('all');
    }
  }, []);

  return {
    sortOrder,
    monthFilter,
    rangePreset,
    fromDate,
    toDate,
    availableMonths,
    filteredEntries,
    hasActiveFilters,
    setSortOrder,
    setFromDate,
    setToDate,
    resetFilters,
    handleSelectMonth,
    handleSelectRange,
  };
}
