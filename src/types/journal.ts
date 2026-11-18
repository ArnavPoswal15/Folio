import { InkColorId } from './ink';

/** Paper ruling style available on each journal spread. */
export type PaperStyle = 'ruled' | 'dotted' | 'blank';

/** Selectable writing font identifiers across the journal pages. */
export type JournalFontId = 'caveat' | 'patrick' | 'kalam' | 'lora';

/** Metadata describing a selectable journal writing font and its optical scale. */
export interface JournalFontOption {
  label: string;
  shortLabel: string;
  cssFamily: string;
  sizeScale: number;
  contextScale: number;
}

/** Cloud synchronization status displayed in account and index views. */
export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

/** Two-page spread entity persisted in localStorage and Firestore. */
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

/** Formatted display date components derived from an ISO date string. */
export interface JournalDateParts {
  weekday: string;
  monthDay: string;
  year: string;
  full: string;
}

/** Reducer state holding all chronological spreads and the active index. */
export interface JournalState {
  spreads: JournalSpread[];
  currentIndex: number;
}

/** Reducer actions driving spread CRUD, navigation, overflow continuation, and cloud sync. */
export type JournalAction =
  | {
      type: 'UPDATE_SPREAD';
      index: number;
      patch: Partial<JournalSpread>;
      updatedAt: number;
    }
  | { type: 'GO_TO_SPREAD'; index: number }
  | { type: 'TURN_PREV' }
  | { type: 'TURN_NEXT'; createdSpread?: JournalSpread }
  | { type: 'CREATE_SPREAD'; createdSpread: JournalSpread }
  | {
      type: 'STAGE_CONTINUATION';
      afterSpreadId: string;
      rightBodyFit: string;
      continuationSpread: JournalSpread;
      isNew: boolean;
      updatedAt: number;
    }
  | { type: 'DELETE_SPREAD'; index: number }
  | {
      type: 'APPLY_CLOUD_SPREADS';
      spreads: JournalSpread[];
      preserveSpreadId?: string;
    }
  | { type: 'PREPARE_SIGNED_IN'; cachedSpreads: JournalSpread[] }
  | { type: 'RESET_TO_LOCAL'; spreads: JournalSpread[] };
