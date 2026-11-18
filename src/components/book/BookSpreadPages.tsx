import React from 'react';
import { InkToolConfig } from '../../types/ink';
import { JournalSpread } from '../../types/journal';
import { PageFocusRequest } from '../../types/pageContent';
import { TurnDirection } from '../../types/pageCurl';
import { VoiceControl } from '../../types/voice';
import { JournalPageContent } from '../journalPage/JournalPageContent';
import { WelcomeSpreadContent } from '../welcome/WelcomeSpreadContent';

/** Props accepted by the BookSpreadPages component. */
interface BookSpreadPagesProps {
  currentSpread: JournalSpread;
  currentIndex: number;
  pageW: number;
  pageH: number;
  isMobile: boolean;
  mobileSide: 'left' | 'right';
  showWelcome: boolean;
  isContinuation: boolean;
  isLocked: boolean;
  isSignedIn: boolean;
  authBusy: boolean;
  authError: string | null;
  canTurnPrev: boolean;
  canTurnNext: boolean;
  voiceControl?: VoiceControl;
  inkConfig?: InkToolConfig;
  inkToolbarOpen: boolean;
  focusRequest?: PageFocusRequest | null;
  onUpdateSpread: (patch: Partial<JournalSpread>) => void;
  onTriggerTurn: (direction: TurnDirection) => void;
  onContinueLocal: () => void;
  onSignInWithGoogle: () => void;
  onClearAuthError: () => void;
  onCloseBook: () => void;
  onNewSpread: () => void;
  onOpenIndex: () => void;
  onOpenExport: () => void;
  onOpenAccount: () => void;
  onMenuOpenChange: (open: boolean) => void;
  onToggleInkToolbar?: (side: 'left' | 'right') => void;
  onCommitInk: (side: 'left' | 'right', nextInk: string) => void;
  onPenActivity: () => void;
  onStylusActive: (side: 'left' | 'right') => void;
  onInkCapacityWarning?: (message: string) => void;
  onPageOverflow: (
    side: 'left' | 'right',
    fitText: string,
    overflowText: string,
    moveFocus: boolean,
    caretOffset: number
  ) => void;
  onClearFocusRequest?: (nonce: number) => void;
}

/**
 * Renders either the active mobile single sheet or desktop left+right spread sheets inside the open book frame.
 * @param props - Active spread content, geometry, welcome state, voice/ink config, and page callbacks.
 * @returns Mobile single-page container or desktop dual-page containers.
 */
export const BookSpreadPages: React.FC<BookSpreadPagesProps> = ({
  currentSpread,
  currentIndex,
  pageW,
  pageH,
  isMobile,
  mobileSide,
  showWelcome,
  isContinuation,
  isLocked,
  isSignedIn,
  authBusy,
  authError,
  canTurnPrev,
  canTurnNext,
  voiceControl,
  inkConfig,
  inkToolbarOpen,
  focusRequest,
  onUpdateSpread,
  onTriggerTurn,
  onContinueLocal,
  onSignInWithGoogle,
  onClearAuthError,
  onCloseBook,
  onNewSpread,
  onOpenIndex,
  onOpenExport,
  onOpenAccount,
  onMenuOpenChange,
  onToggleInkToolbar,
  onCommitInk,
  onPenActivity,
  onStylusActive,
  onInkCapacityWarning,
  onPageOverflow,
  onClearFocusRequest,
}) => {
  const sharedPageProps = {
    isSignedIn,
    onUpdateSpread,
    onTriggerTurn,
    canTurnPrev,
    canTurnNext,
    voiceControl,
    inkConfig,
    inkToolbarOpen,
    onToggleInkToolbar,
    onCommitInk,
    onPenActivity,
    onStylusActive,
    onInkCapacityWarning,
    onPageOverflow,
    focusRequest,
    onClearFocusRequest,
  };

  if (isMobile) {
    return (
      <div
        className="absolute top-0 left-0 z-0 isolate overflow-hidden rounded-[3px]"
        style={{ width: `${pageW}px`, height: `${pageH}px` }}
      >
        {showWelcome ? (
          <WelcomeSpreadContent
            side="right"
            pageW={pageW}
            pageH={pageH}
            isMobile={true}
            interactive={true}
            locked={isLocked}
            authBusy={authBusy}
            authError={authError}
            onSignInWithGoogle={onSignInWithGoogle}
            onContinueLocal={onContinueLocal}
            onCloseBook={onCloseBook}
            onClearAuthError={onClearAuthError}
          />
        ) : (
          <JournalPageContent
            spread={currentSpread}
            side={mobileSide}
            spreadIndex={currentIndex}
            pageW={pageW}
            pageH={pageH}
            isMobile={true}
            isContinuation={isContinuation}
            interactive={true}
            locked={isLocked}
            onNewSpread={onNewSpread}
            onOpenIndex={onOpenIndex}
            onOpenExport={onOpenExport}
            onOpenAccount={onOpenAccount}
            onCloseBook={onCloseBook}
            onMenuOpenChange={onMenuOpenChange}
            {...sharedPageProps}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className="absolute top-0 left-0 z-0 isolate overflow-hidden rounded-l-[3px]"
        style={{ width: `${pageW}px`, height: `${pageH}px` }}
      >
        {showWelcome ? (
          <WelcomeSpreadContent
            side="left"
            pageW={pageW}
            pageH={pageH}
            interactive={true}
            locked={isLocked}
          />
        ) : (
          <JournalPageContent
            spread={currentSpread}
            side="left"
            spreadIndex={currentIndex}
            pageW={pageW}
            pageH={pageH}
            isContinuation={isContinuation}
            interactive={true}
            locked={isLocked}
            {...sharedPageProps}
          />
        )}
      </div>

      <div
        className="absolute top-0 z-0 isolate overflow-hidden rounded-r-[3px]"
        style={{
          left: `${pageW}px`,
          width: `${pageW}px`,
          height: `${pageH}px`,
        }}
      >
        {showWelcome ? (
          <WelcomeSpreadContent
            side="right"
            pageW={pageW}
            pageH={pageH}
            interactive={true}
            locked={isLocked}
            authBusy={authBusy}
            authError={authError}
            onSignInWithGoogle={onSignInWithGoogle}
            onContinueLocal={onContinueLocal}
            onCloseBook={onCloseBook}
            onClearAuthError={onClearAuthError}
          />
        ) : (
          <JournalPageContent
            spread={currentSpread}
            side="right"
            spreadIndex={currentIndex}
            pageW={pageW}
            pageH={pageH}
            interactive={true}
            locked={isLocked}
            onNewSpread={onNewSpread}
            onOpenIndex={onOpenIndex}
            onOpenExport={onOpenExport}
            onOpenAccount={onOpenAccount}
            onCloseBook={onCloseBook}
            onMenuOpenChange={onMenuOpenChange}
            {...sharedPageProps}
          />
        )}
      </div>
    </>
  );
};
