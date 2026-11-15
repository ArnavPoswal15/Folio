export type InkColorId = 'charcoal' | 'midnight' | 'sepia';

export type PaperStyle = 'ruled' | 'dotted' | 'blank';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export interface JournalSpread {
  id: string;
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Optional quiet mood / setting line below the date */
  contextNote: string;
  /** Left page handwritten body */
  leftBody: string;
  /** Right page handwritten body */
  rightBody: string;
  /** Ink tone for handwritten text on this spread */
  inkColor: InkColorId;
  /** Paper ruling style for this spread */
  paperStyle: PaperStyle;
  /** Last edited timestamp in epoch ms */
  updatedAt: number;
}

export const INK_COLORS: Record<
  InkColorId,
  { label: string; hex: string; swatch: string }
> = {
  charcoal: {
    label: 'Charcoal Ink',
    hex: '#24201c',
    swatch: '#2a2520',
  },
  midnight: {
    label: 'Fountain Blue',
    hex: '#1c3554',
    swatch: '#224268',
  },
  sepia: {
    label: 'Warm Sepia',
    hex: '#57361e',
    swatch: '#6b4226',
  },
};

export const SPREAD_LIMITS = {
  MAX_ID_LEN: 128,
  MAX_CONTEXT_LEN: 240,
  MAX_BODY_LEN: 20000,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
} as const;

export function sanitizeSpreadId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, SPREAD_LIMITS.MAX_ID_LEN);
  return cleaned.length > 0 && SPREAD_LIMITS.ID_PATTERN.test(cleaned)
    ? cleaned
    : `spread-${Date.now()}`;
}

export function sanitizeIsoDate(rawDate: string): string {
  if (SPREAD_LIMITS.DATE_PATTERN.test(rawDate)) return rawDate;
  return new Date().toISOString().slice(0, 10);
}

export function sanitizeSpreadPayload(spread: JournalSpread): JournalSpread {
  const safeInk: InkColorId =
    spread.inkColor === 'midnight' || spread.inkColor === 'sepia'
      ? spread.inkColor
      : 'charcoal';
  const safePaper: PaperStyle =
    spread.paperStyle === 'dotted' || spread.paperStyle === 'blank'
      ? spread.paperStyle
      : 'ruled';
  return {
    id: sanitizeSpreadId(spread.id),
    date: sanitizeIsoDate(spread.date),
    contextNote: (spread.contextNote ?? '').slice(0, SPREAD_LIMITS.MAX_CONTEXT_LEN),
    leftBody: (spread.leftBody ?? '').slice(0, SPREAD_LIMITS.MAX_BODY_LEN),
    rightBody: (spread.rightBody ?? '').slice(0, SPREAD_LIMITS.MAX_BODY_LEN),
    inkColor: safeInk,
    paperStyle: safePaper,
    updatedAt: Number.isFinite(spread.updatedAt) && spread.updatedAt >= 0 ? spread.updatedAt : Date.now(),
  };
}
