import React from 'react';
import { InkToolConfig } from './ink';
import { JournalSpread } from './journal';
import { PageFocusRequest } from './pageContent';
import { TurnDirection } from './pageCurl';
import { VoiceControl } from './voice';

/** Open/close animation lifecycle state of the hardbound journal cover. */
export type BookPhase = 'closed' | 'opening' | 'open' | 'closing';

/** Responsive page dimensions and device orientation flags computed from viewport size. */
export interface ViewportMetrics {
  pageW: number;
  pageH: number;
  isMobile: boolean;
  isLandscapeMobile: boolean;
}

/** DOM element refs shared between BookFrameChrome, BookCover, and useBookCoverAnimation. */
export interface BookCoverRefs {
  bookWrapperRef: React.RefObject<HTMLDivElement | null>;
  deskShadowRef: React.RefObject<HTMLDivElement | null>;
  frameRef: React.RefObject<HTMLDivElement | null>;
  coverRef: React.RefObject<HTMLDivElement | null>;
  coverFrontRef: React.RefObject<HTMLButtonElement | null>;
  coverBackRef: React.RefObject<HTMLDivElement | null>;
  mobileBackFaceRef: React.RefObject<HTMLDivElement | null>;
  rightShadowRef: React.RefObject<HTMLDivElement | null>;
}

/** Props accepted by the PageCurlStage book orchestrator component. */
export interface PageCurlStageProps {
  spreads: JournalSpread[];
  currentIndex: number;
  pageW: number;
  pageH: number;
  isMobile: boolean;
  mobileSide: 'left' | 'right';
  bookPhase: BookPhase;
  upcomingBlankSpread: JournalSpread;
  showWelcome: boolean;
  isSignedIn: boolean;
  authBusy: boolean;
  authError: string | null;
  onOpenBook: () => void;
  onOpenComplete: () => void;
  onCloseComplete: () => void;
  onUpdateSpread: (index: number, patch: Partial<JournalSpread>) => void;
  onCommitTurn: (direction: TurnDirection) => void;
  onNewSpread: () => void;
  onOpenIndex: () => void;
  onOpenExport: () => void;
  onOpenAccount: () => void;
  onSignInWithGoogle: () => void;
  onClearAuthError: () => void;
  onDismissWelcome: () => void;
  onCloseBook: () => void;
  voiceControl?: VoiceControl;
  inkConfig?: InkToolConfig;
  inkToolbarOpen?: boolean;
  inkToolbarSide?: 'left' | 'right';
  onToggleInkToolbar?: (side: 'left' | 'right') => void;
  onCommitInk?: (
    spreadIndex: number,
    side: 'left' | 'right',
    nextSerialized: string
  ) => void;
  onStylusActive?: (spreadIndex: number, side: 'left' | 'right') => void;
  onInkCapacityWarning?: (message: string) => void;
  onStageContinuationSpread?: (
    index: number,
    rightBodyFit: string,
    overflowLeftBody: string
  ) => number;
  focusRequest?: PageFocusRequest | null;
  onRequestFocus?: (req: Omit<PageFocusRequest, 'nonce'>) => void;
  onClearFocusRequest?: (nonce: number) => void;
}
