import {
  EXPORT_CSV_HEADERS,
  EXPORT_DURATION_OPTIONS,
} from '../constants/export';
import { INK_COLORS } from '../constants/ink';
import { ExportDurationId } from '../types/export';
import { JournalSpread } from '../types/journal';
import {
  formatJournalDateParts,
  formatLocalIsoDate,
  parseIsoLocal,
} from './date';

/**
 * Computes the inclusive cutoff local Date for a CSV export duration option.
 * @param duration - Selected export duration window identifier.
 * @param referenceDate - Reference calendar date (defaults to current date).
 * @returns Cutoff local Date at midnight, or null for `'all'`.
 */
export function getCutoffDateForDuration(
  duration: ExportDurationId,
  referenceDate: Date = new Date()
): Date | null {
  if (duration === 'all') return null;
  const ref = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  switch (duration) {
    case '1w':
      ref.setDate(ref.getDate() - 7);
      return ref;
    case '2w':
      ref.setDate(ref.getDate() - 14);
      return ref;
    case '1m':
      ref.setMonth(ref.getMonth() - 1);
      return ref;
    case '3m':
      ref.setMonth(ref.getMonth() - 3);
      return ref;
    case '6m':
      ref.setMonth(ref.getMonth() - 6);
      return ref;
    case '12m':
      ref.setFullYear(ref.getFullYear() - 1);
      return ref;
    default:
      return null;
  }
}

/**
 * Filters and sorts spreads ascending by date within the requested export window.
 * @param spreads - Full array of journal spreads.
 * @param duration - Selected export duration window identifier.
 * @param referenceDate - Reference calendar date for cutoff math.
 * @returns Filtered spreads ordered chronologically.
 */
export function filterSpreadsByDuration(
  spreads: JournalSpread[],
  duration: ExportDurationId,
  referenceDate: Date = new Date()
): JournalSpread[] {
  const sorted = [...spreads].sort((a, b) => a.date.localeCompare(b.date));
  const cutoff = getCutoffDateForDuration(duration, referenceDate);
  if (!cutoff) return sorted;

  return sorted.filter((spread) => {
    const d = parseIsoLocal(spread.date);
    if (!d) return true;
    return d.getTime() >= cutoff.getTime();
  });
}

/**
 * Neutralizes CSV formula injection and properly quotes commas, quotes, and newlines.
 * @param value - Raw cell string value.
 * @returns RFC-4180 escaped and formula-safe CSV cell string.
 */
export function escapeCsvCell(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const formulaSafe = /^[=+\-@\t]/.test(normalized)
    ? `'${normalized}`
    : normalized;
  if (
    formulaSafe.includes(',') ||
    formulaSafe.includes('"') ||
    formulaSafe.includes('\n')
  ) {
    return `"${formulaSafe.replace(/"/g, '""')}"`;
  }
  return formulaSafe;
}

/**
 * Serializes journal spreads into a UTF-8 BOM prefixed CSV document for Excel compatibility.
 * @param spreads - Ordered array of spreads to include.
 * @returns Full CSV string with CRLF line endings.
 */
export function buildJournalCsv(spreads: JournalSpread[]): string {
  const rows = spreads.map((spread) => {
    const dateParts = formatJournalDateParts(spread.date);
    const inkLabel = INK_COLORS[spread.inkColor]?.label ?? spread.inkColor;
    const updatedIso = Number.isFinite(spread.updatedAt)
      ? new Date(spread.updatedAt).toISOString()
      : '';

    return [
      spread.date,
      dateParts.weekday,
      spread.contextNote || '',
      inkLabel,
      spread.paperStyle,
      spread.leftBody || '',
      spread.rightBody || '',
      updatedIso,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return (
    '\uFEFF' +
    [EXPORT_CSV_HEADERS.map(escapeCsvCell).join(','), ...rows].join('\r\n')
  );
}

/**
 * Generates and triggers a browser file download of matching spreads as CSV.
 * @param spreads - All journal spreads in the store.
 * @param duration - Selected export duration window identifier.
 * @returns Number of exported spreads included in the downloaded file.
 */
export function downloadJournalCsv(
  spreads: JournalSpread[],
  duration: ExportDurationId
): number {
  const filtered = filterSpreadsByDuration(spreads, duration);
  const csvContent = buildJournalCsv(filtered);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const opt = EXPORT_DURATION_OPTIONS.find((o) => o.id === duration);
  const stamp = formatLocalIsoDate();
  const filename = `folio-journal-${opt?.shortLabel ?? 'export'}-${stamp}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);

  return filtered.length;
}
