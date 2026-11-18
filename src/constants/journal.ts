import {
  JournalFontId,
  JournalFontOption,
  JournalSpread,
  PaperStyle,
} from '../types/journal';

/** LocalStorage keys used for spreads, per-user cache, theme, and writing font. */
export const JOURNAL_STORAGE_KEYS = {
  SPREADS: 'folio_journal_spreads_v1',
  CLOUD_CACHE_PREFIX: 'folio_journal_cloud_',
  THEME: 'folio-theme',
  FONT: 'folio-journal-font',
} as const;

/** Schema ceilings matching Firestore security rules validation constraints. */
export const SPREAD_LIMITS = {
  MAX_ID_LEN: 128,
  MAX_CONTEXT_LEN: 240,
  MAX_BODY_LEN: 20000,
  MAX_INK_LEN: 160000,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
} as const;

/** Firestore cloud synchronization timings, batch limits, and default seed date. */
export const JOURNAL_SYNC_CONFIG = {
  DEBOUNCE_WRITE_MS: 600,
  BATCH_CHUNK_SIZE: 380,
  MAX_DISPLAY_NAME_LEN: 120,
  MAX_EMAIL_LEN: 320,
  INITIAL_FOCUS_DATE: '2026-11-14',
} as const;

/** Ordered list of selectable journal writing font IDs. */
export const JOURNAL_FONT_ORDER: JournalFontId[] = [
  'caveat',
  'patrick',
  'kalam',
  'lora',
];

/** Display names, CSS font stacks, and optical size scales for each journal font. */
export const JOURNAL_FONTS: Record<JournalFontId, JournalFontOption> = {
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

/** Ordered paper ruling options with human-readable labels. */
export const PAPER_STYLE_OPTIONS: Array<{ id: PaperStyle; label: string }> = [
  { id: 'ruled', label: 'Ruled' },
  { id: 'dotted', label: 'Dotted' },
  { id: 'blank', label: 'Blank' },
];

/** Fixed page typography and ruled-sheet geometry constants. */
export const PAGE_SHEET_METRICS = {
  LINE_HEIGHT_PX: 32,
  BASE_HAND_FONT_PX: 23,
  BASE_CONTEXT_FONT_PX: 19,
  REFERENCE_PAGE_W: 470,
  MIN_SCALE_RATIO: 0.76,
  MOBILE_PAD_X: 24,
  MOBILE_PAD_TOP: 20,
  MOBILE_PAD_BOTTOM: 18,
  DESKTOP_PAD_X: 42,
  DESKTOP_PAD_TOP: 30,
  DESKTOP_PAD_BOTTOM: 26,
  OVERFLOW_WORD_LOOKBACK: 42,
  WRITABLE_PAD_PX: 2,
  OVERFLOW_THRESHOLD_PAD_PX: 6,
} as const;

/** Default guest sample spreads loaded on first visit when localStorage is empty. */
export const DEFAULT_SPREADS: JournalSpread[] = [
  {
    id: 'spread-1',
    date: '2026-11-12',
    contextNote: 'Late afternoon rain · Window cracked open',
    inkColor: 'sepia',
    paperStyle: 'ruled',
    leftBody:
      'Picked up a fine nib on the walk back from the station and spent twenty quiet minutes watching rain collect along the sill.\n\nFunny how much slower thoughts move without a bright screen sitting beside the teacup. Half the things that felt urgent on Tuesday turned out to be noise once I wrote them in plain sentences.\n\nBefore Friday:\n- Walk before checking messages\n- Finish the essays on light and proportion\n- Call Sam before the weekend',
    rightBody:
      'Evening:\n\nRoasted squash with thyme and garlic while listening to old Bill Evans records. Kept only the corner lamp lit.\n\nNote for the studio work—let one physical object carry the room and leave the rest open.',
    leftInk: '',
    rightInk: '',
    updatedAt: 1794518400000,
  },
  {
    id: 'spread-2',
    date: '2026-11-13',
    contextNote: 'Cold morning · Cedar & black coffee',
    inkColor: 'midnight',
    paperStyle: 'ruled',
    leftBody:
      'Woke early before the street stirred. Crisp air through the hallway, pale silver sky behind the rooftops.\n\nSpent an hour sketching margins and proportions on scrap paper—a pencil still solves things faster than sliding boxes around with a trackpad.\n\nSimplicity is rarely what you remove first; it is what stays honest after the extra ornament drops away.',
    rightBody:
      'Afternoon walk across the park. The sycamore leaves are almost completely down now, leaving dark ink-like branches against the sky.\n\nTomorrow:\nKeep the morning unscheduled until ten-thirty so the day has somewhere quiet to start.',
    leftInk: '',
    rightInk: '',
    updatedAt: 1794604800000,
  },
  {
    id: 'spread-3',
    date: '2026-11-14',
    contextNote: 'Saturday · Clear light through the south window',
    inkColor: 'charcoal',
    paperStyle: 'ruled',
    leftBody:
      'Slow Saturday. Made pour-over at eleven and cleared off the desk so only the notebook and a pen were sitting out.\n\nBooks to look for next week:\n- The Poetics of Space\n- In Praise of Shadows\n\nWant to spend a few hours this afternoon sorting the autumn film rolls and writing down the ones worth printing.',
    rightBody:
      'Afternoon thoughts:\n\nNotice how quickly a week disappears when every hour gets booked back-to-back. Keeping one blank afternoon feels less like doing nothing and more like catching up with yourself.\n\nDinner plan: pasta with lemon, capers, and toasted breadcrumbs.',
    leftInk: '',
    rightInk: '',
    updatedAt: 1794691200000,
  },
  {
    id: 'spread-4',
    date: '2026-11-15',
    contextNote: 'Sunday morning',
    inkColor: 'charcoal',
    paperStyle: 'dotted',
    leftBody: '',
    rightBody: '',
    leftInk: '',
    rightInk: '',
    updatedAt: 1794691201000,
  },
];
