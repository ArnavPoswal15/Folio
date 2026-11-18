import { InkToolConfig } from './ink';
import { JournalSpread } from './journal';
import { VoiceControl } from './voice';

/** Focus and caret restoration instruction dispatched when typing overflows to the next page. */
export interface PageFocusRequest {
  nonce: number;
  spreadIndex: number;
  side: 'left' | 'right';
  caretOffset: number;
}

/** Computed boundary split when page text exceeds the physical sheet height. */
export interface OverflowSplitResult {
  fitText: string;
  overflowText: string;
  moveFocus: boolean;
  caretOffset: number;
}

/** Props accepted by JournalPageContent and forwarded across page header, body, and footer. */
export interface JournalPageContentProps {
  spread: JournalSpread;
  side: 'left' | 'right';
  spreadIndex: number;
  pageW: number;
  pageH: number;
  isMobile?: boolean;
  isContinuation?: boolean;
  interactive?: boolean;
  locked?: boolean;
  onUpdateSpread?: (patch: Partial<JournalSpread>) => void;
  onPageOverflow?: (
    side: 'left' | 'right',
    fitText: string,
    overflowText: string,
    moveFocus: boolean,
    caretOffset: number
  ) => void;
  focusRequest?: PageFocusRequest | null;
  onClearFocusRequest?: (nonce: number) => void;
  onNewSpread?: () => void;
  onOpenIndex?: () => void;
  onOpenExport?: () => void;
  onOpenAccount?: () => void;
  isSignedIn?: boolean;
  onCloseBook?: () => void;
  onTriggerTurn?: (direction: 'prev' | 'next') => void;
  canTurnPrev?: boolean;
  canTurnNext?: boolean;
  showEmptyPlaceholders?: boolean;
  showCornerSheen?: boolean;
  voiceControl?: VoiceControl;
  onMenuOpenChange?: (open: boolean) => void;
  inkConfig?: InkToolConfig;
  inkToolbarOpen?: boolean;
  onToggleInkToolbar?: (side: 'left' | 'right') => void;
  onCommitInk?: (side: 'left' | 'right', nextSerialized: string) => void;
  onPenActivity?: () => void;
  onStylusActive?: (side: 'left' | 'right') => void;
  onInkCapacityWarning?: (message: string) => void;
}
