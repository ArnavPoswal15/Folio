import {
  IndexedSpread,
  RangePreset,
  SortOrder,
} from '../types/entriesIndex';
import { JournalSpread } from '../types/journal';
import { getCutoffIsoDate } from './date';

/**
 * Extracts distinct `YYYY-MM` month keys present across spreads sorted newest-first.
 * @param spreads - All journal spreads in the store.
 * @returns Array of `YYYY-MM` strings in reverse chronological order.
 */
export function extractAvailableMonths(spreads: JournalSpread[]): string[] {
  const months = new Set<string>();
  for (const spread of spreads) {
    if (/^\d{4}-\d{2}/.test(spread.date)) {
      months.add(spread.date.slice(0, 7));
    }
  }
  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

/**
 * Filters spreads by month, preset, or custom date range and sorts them chronologically.
 * @param spreads - Full chronological array of journal spreads.
 * @param sortOrder - Sort direction (`desc` newest-first or `asc` oldest-first).
 * @param monthFilter - Selected `YYYY-MM` filter key or `'all'`.
 * @param rangePreset - Selected quick range preset (`all`, `7d`, `30d`, `90d`, `custom`).
 * @param fromDate - Inclusive lower bound (`YYYY-MM-DD`) when `rangePreset === 'custom'`.
 * @param toDate - Inclusive upper bound (`YYYY-MM-DD`) when `rangePreset === 'custom'`.
 * @returns Filtered and sorted list of spreads paired with their original store indices.
 */
export function filterAndSortSpreads(
  spreads: JournalSpread[],
  sortOrder: SortOrder,
  monthFilter: string,
  rangePreset: RangePreset,
  fromDate: string,
  toDate: string
): IndexedSpread[] {
  const presetCutoff =
    rangePreset === '7d'
      ? getCutoffIsoDate(7)
      : rangePreset === '30d'
        ? getCutoffIsoDate(30)
        : rangePreset === '90d'
          ? getCutoffIsoDate(90)
          : null;

  const indexed: IndexedSpread[] = spreads.map((spread, originalIndex) => ({
    spread,
    originalIndex,
  }));

  const filtered = indexed.filter(({ spread }) => {
    if (monthFilter !== 'all' && !spread.date.startsWith(monthFilter)) {
      return false;
    }
    if (presetCutoff && spread.date < presetCutoff) {
      return false;
    }
    if (rangePreset === 'custom') {
      if (fromDate && spread.date < fromDate) return false;
      if (toDate && spread.date > toDate) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    const cmp =
      a.spread.date.localeCompare(b.spread.date) ||
      a.originalIndex - b.originalIndex;
    return sortOrder === 'desc' ? -cmp : cmp;
  });

  return filtered;
}

/**
 * Produces a compact single-line text preview or ink fallback label for an index row.
 * @param spread - Journal spread to summarize.
 * @returns Normalized single-line preview string.
 */
export function getEntrySnippet(spread: JournalSpread): string {
  const prose = (spread.leftBody || spread.rightBody || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (prose) return prose;
  if (spread.leftInk || spread.rightInk) return 'Handwritten ink notes';
  return 'Blank sheet';
}
