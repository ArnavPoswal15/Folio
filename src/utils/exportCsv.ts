import { formatJournalDateParts } from '../data/initialEntries';
import { formatLocalIsoDate, INK_COLORS, JournalSpread } from '../types/journal';

export type ExportDurationId = '1w' | '2w' | '1m' | '3m' | '6m' | '12m' | 'all';

export interface ExportDurationOption {
  id: ExportDurationId;
  label: string;
  shortLabel: string;
}

export const EXPORT_DURATION_OPTIONS: ExportDurationOption[] = [
  { id: '1w', label: '1 Week', shortLabel: '1-week' },
  { id: '2w', label: '2 Weeks', shortLabel: '2-weeks' },
  { id: '1m', label: '1 Month', shortLabel: '1-month' },
  { id: '3m', label: '3 Months', shortLabel: '3-months' },
  { id: '6m', label: '6 Months', shortLabel: '6-months' },
  { id: '12m', label: '12 Months', shortLabel: '12-months' },
  { id: 'all', label: 'All Time', shortLabel: 'all-time' },
];

function parseIsoLocal(isoDate: string): Date | null {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

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

function escapeCsvCell(value: string): string {
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

export function buildJournalCsv(spreads: JournalSpread[]): string {
  const headers = [
    'Date',
    'Weekday',
    'Setting / Mood',
    'Ink Tone',
    'Paper Style',
    'Left Page',
    'Right Page',
    'Last Updated',
  ];

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

  // Prefix UTF-8 BOM for clean Unicode / Excel compatibility
  return '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}

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
