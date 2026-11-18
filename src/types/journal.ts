export type InkColorId = 'charcoal' | 'midnight' | 'sepia';

export type InkToolType = 'pen' | 'fountain' | 'highlighter' | 'eraser';

export type InkDrawToolType = 'pen' | 'fountain' | 'highlighter';

export type InkPaletteId =
  | 'charcoal'
  | 'midnight'
  | 'sepia'
  | 'burgundy'
  | 'sage'
  | 'amber';

export type InkWidthPreset = 1 | 2 | 3;

export type PaperStyle = 'ruled' | 'dotted' | 'blank';

export type JournalFontId = 'caveat' | 'patrick' | 'kalam' | 'lora';

export const JOURNAL_FONT_ORDER: JournalFontId[] = [
  'caveat',
  'patrick',
  'kalam',
  'lora',
];

export const JOURNAL_FONTS: Record<
  JournalFontId,
  {
    label: string;
    shortLabel: string;
    cssFamily: string;
    sizeScale: number;
    contextScale: number;
  }
> = {
  caveat: {
    label: 'Handwritten',
    shortLabel: 'Hand',
    cssFamily: '"Caveat", cursive',
    sizeScale: 1,
    contextScale: 1,
  },
  patrick: {
    label: 'Neat Print',
    shortLabel: 'Print',
    cssFamily: '"Patrick Hand", cursive',
    sizeScale: 0.85,
    contextScale: 0.86,
  },
  kalam: {
    label: 'Fountain Pen',
    shortLabel: 'Script',
    cssFamily: '"Kalam", cursive',
    sizeScale: 0.78,
    contextScale: 0.8,
  },
  lora: {
    label: 'Book Serif',
    shortLabel: 'Serif',
    cssFamily: '"Lora", Georgia, serif',
    sizeScale: 0.74,
    contextScale: 0.76,
  },
};

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export interface JournalSpread {
  id: string;
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Optional quiet mood / setting line below the date */
  contextNote: string;
  /** Left page handwritten/typed text body */
  leftBody: string;
  /** Right page handwritten/typed text body */
  rightBody: string;
  /** Compact serialized stylus strokes for the left page */
  leftInk: string;
  /** Compact serialized stylus strokes for the right page */
  rightInk: string;
  /** Ink tone for typed prose on this spread */
  inkColor: InkColorId;
  /** Paper ruling style for this spread */
  paperStyle: PaperStyle;
  /** Last edited timestamp in epoch ms */
  updatedAt: number;
}

export const INK_COLORS: Record<
  InkColorId,
  {
    label: string;
    hex: string;
    swatch: string;
    darkHex: string;
    darkSwatch: string;
  }
> = {
  charcoal: {
    label: 'Charcoal Ink',
    hex: '#24201c',
    swatch: '#2a2520',
    darkHex: '#e8dfd1',
    darkSwatch: '#dcd1bf',
  },
  midnight: {
    label: 'Fountain Blue',
    hex: '#1c3554',
    swatch: '#224268',
    darkHex: '#9bbce8',
    darkSwatch: '#85abde',
  },
  sepia: {
    label: 'Warm Sepia',
    hex: '#57361e',
    swatch: '#6b4226',
    darkHex: '#deb488',
    darkSwatch: '#d4a472',
  },
};

export const INK_PALETTE: Record<
  InkPaletteId,
  {
    label: string;
    lightHex: string;
    darkHex: string;
    lightHighlighter: string;
    darkHighlighter: string;
  }
> = {
  charcoal: {
    label: 'Charcoal Ink',
    lightHex: '#24201c',
    darkHex: '#e8dfd1',
    lightHighlighter: '#a99e8e',
    darkHighlighter: '#b9ac99',
  },
  midnight: {
    label: 'Fountain Blue',
    lightHex: '#1c3554',
    darkHex: '#9bbce8',
    lightHighlighter: '#6f9ad0',
    darkHighlighter: '#7baae6',
  },
  sepia: {
    label: 'Warm Sepia',
    lightHex: '#57361e',
    darkHex: '#deb488',
    lightHighlighter: '#c6935f',
    darkHighlighter: '#d9a774',
  },
  burgundy: {
    label: 'Burgundy Ribbon',
    lightHex: '#7a222b',
    darkHex: '#e4838a',
    lightHighlighter: '#d46b74',
    darkHighlighter: '#e07b82',
  },
  sage: {
    label: 'Olive Sage',
    lightHex: '#315238',
    darkHex: '#8db894',
    lightHighlighter: '#75a37b',
    darkHighlighter: '#84b58b',
  },
  amber: {
    label: 'Warm Amber',
    lightHex: '#b27514',
    darkHex: '#eab85b',
    lightHighlighter: '#e5b242',
    darkHighlighter: '#eab85b',
  },
};

export const INK_PALETTE_ORDER: InkPaletteId[] = [
  'charcoal',
  'midnight',
  'sepia',
  'burgundy',
  'sage',
  'amber',
];

export const SPREAD_LIMITS = {
  MAX_ID_LEN: 128,
  MAX_CONTEXT_LEN: 240,
  MAX_BODY_LEN: 20000,
  MAX_INK_LEN: 160000,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
} as const;

export function sanitizeSpreadId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, SPREAD_LIMITS.MAX_ID_LEN);
  return cleaned.length > 0 && SPREAD_LIMITS.ID_PATTERN.test(cleaned)
    ? cleaned
    : `spread-${Date.now()}`;
}

export function formatLocalIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function sanitizeIsoDate(rawDate: string): string {
  if (SPREAD_LIMITS.DATE_PATTERN.test(rawDate)) return rawDate;
  return formatLocalIsoDate();
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
  const safeLeftInk =
    typeof spread.leftInk === 'string'
      ? spread.leftInk.slice(0, SPREAD_LIMITS.MAX_INK_LEN)
      : '';
  const safeRightInk =
    typeof spread.rightInk === 'string'
      ? spread.rightInk.slice(0, SPREAD_LIMITS.MAX_INK_LEN)
      : '';
  return {
    id: sanitizeSpreadId(spread.id),
    date: sanitizeIsoDate(spread.date),
    contextNote: (spread.contextNote ?? '').slice(0, SPREAD_LIMITS.MAX_CONTEXT_LEN),
    leftBody: (spread.leftBody ?? '').slice(0, SPREAD_LIMITS.MAX_BODY_LEN),
    rightBody: (spread.rightBody ?? '').slice(0, SPREAD_LIMITS.MAX_BODY_LEN),
    leftInk: safeLeftInk,
    rightInk: safeRightInk,
    inkColor: safeInk,
    paperStyle: safePaper,
    updatedAt: Number.isFinite(spread.updatedAt) && spread.updatedAt >= 0 ? spread.updatedAt : Date.now(),
  };
}
