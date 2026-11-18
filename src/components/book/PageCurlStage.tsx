import React, { useRef, useState } from 'react';
import { BOOK_COVER_CONFIG } from '../../constants/book';
import { useTheme } from '../../contexts/ThemeContext';
import { useBookCoverAnimation } from '../../hooks/useBookCoverAnimation';
import { usePageCurl } from '../../hooks/usePageCurl';
import { PageCurlStageProps } from '../../types/book';
import { formatJournalDateParts, formatLocalIsoDate } from '../../utils/date';
import { resolveCurlStageDescriptors } from '../../utils/pageCurlGeometry';
import { CurlFlapOverlay } from '../pageCurl/CurlFlapOverlay';
import { CurlInteractionZones } from '../pageCurl/CurlInteractionZones';
import { BookCover } from './BookCover';
import { BookFrameChrome } from './BookFrameChrome';
import { BookSpreadPages } from './BookSpreadPages';

/**
 * Coordinates the physical 3D book shell, hinged front cover, active single/dual pages, and interactive page curls.
 * @param props - Spread state, viewport geometry, cover phase, voice/ink configs, and navigation callbacks.
 * @returns Full 3D book workspace assembly.
 */
export const PageCurlStage: React.FC<PageCurlStageProps> = ({
  spreads,
  currentIndex,
  pageW,
  pageH,
  isMobile,
  mobileSide,
  bookPhase,
  upcomingBlankSpread,
  showWelcome,
  isSignedIn,
  authBusy,
  authError,
  onOpenBook,
  onOpenComplete,
  onCloseComplete,
  onUpdateSpread,
  onCommitTurn,
  onNewSpread,
  onOpenIndex,
  onOpenExport,
  onOpenAccount,
  onSignInWithGoogle,
  onClearAuthError,
  onDismissWelcome,
  onCloseBook,
  voiceControl,
  inkConfig,
  inkToolbarOpen = false,
  onToggleInkToolbar,
  onCommitInk,
  onStylusActive,
  onInkCapacityWarning,
  onStageContinuationSpread,
  focusRequest,
  onRequestFocus,
  onClearFocusRequest,
}) => {
  const { isDark } = useTheme();
  const spreadRef = useRef<HTMLDivElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const stageW = isMobile ? pageW : pageW * 2;
  const halfBookW = pageW + BOOK_COVER_CONFIG.FRAME_PAD_HALF_PX;
  const fullBookH = pageH + BOOK_COVER_CONFIG.FRAME_PAD_FULL_PX;

  const canTurnPrev = showWelcome
    ? false
    : isMobile
      ? currentIndex > 0 || mobileSide === 'right'
      : currentIndex > 0;
  const canTurnNext = true;

  const currentSpread = spreads[currentIndex] ?? spreads[0];
  const isVoiceBusy = Boolean(
    voiceControl &&
      (voiceControl.status === 'recording' ||
        voiceControl.status === 'transcribing')
  );

  const {
    curl,
    curlMode,
    resetCurlImmediately,
    handlePenActivity,
    triggerProgrammaticTurn,
    handlePageOverflow,
    startHoverCurl,
    endHoverCurl,
    handleZonePointerDown,
    handleZonePointerMove,
    handleZonePointerUp,
  } = usePageCurl({
    bookPhase,
    pageW,
    pageH,
    isMobile,
    mobileSide,
    currentIndex,
    currentSpread,
    canTurnPrev,
    isVoiceBusy,
    showWelcome,
    isSignedIn,
    spreadRef,
    onCommitTurn,
    onDismissWelcome,
    onUpdateSpread,
    onStageContinuationSpread,
    onRequestFocus,
  });

  const coverRefs = useBookCoverAnimation({
    bookPhase,
    pageW,
    pageH,
    isMobile,
    onOpenComplete,
    onCloseComplete,
    onBeforeClose: resetCurlImmediately,
  });

  const isOpenInteractive = bookPhase === 'open';
  const isLocked =
    !isOpenInteractive ||
    isVoiceBusy ||
    curlMode === 'dragging' ||
    curlMode === 'animating';

  const coverDateParts = formatJournalDateParts(formatLocalIsoDate());
  const { isCurrentContinuation, nextReveal, prevReveal, flapBack } =
    resolveCurlStageDescriptors({
      spreads,
      currentIndex,
      currentSpread,
      upcomingBlankSpread,
      isMobile,
      mobileSide,
      showWelcome,
      curlDirection: curl?.direction ?? null,
    });

  return (
    <BookFrameChrome
      stageW={stageW}
      pageH={pageH}
      fullBookH={fullBookH}
      isMobile={isMobile}
      bookPhase={bookPhase}
      bookWrapperRef={coverRefs.bookWrapperRef}
      deskShadowRef={coverRefs.deskShadowRef}
      frameRef={coverRefs.frameRef}
      spreadRef={spreadRef}
      coverNode={
        <BookCover
          bookPhase={bookPhase}
          isMobile={isMobile}
          isDark={isDark}
          pageW={pageW}
          pageH={pageH}
          halfBookW={halfBookW}
          fullBookH={fullBookH}
          dateParts={coverDateParts}
          showWelcome={showWelcome}
          currentSpread={currentSpread}
          currentIndex={currentIndex}
          isCurrentContinuation={isCurrentContinuation}
          isSignedIn={isSignedIn}
          canTurnPrev={canTurnPrev}
          canTurnNext={canTurnNext}
          coverRef={coverRefs.coverRef}
          coverFrontRef={coverRefs.coverFrontRef}
          coverBackRef={coverRefs.coverBackRef}
          mobileBackFaceRef={coverRefs.mobileBackFaceRef}
          onOpenBook={onOpenBook}
        />
      }
    >
      <BookSpreadPages
        currentSpread={currentSpread}
        currentIndex={currentIndex}
        pageW={pageW}
        pageH={pageH}
        isMobile={isMobile}
        mobileSide={mobileSide}
        showWelcome={showWelcome}
        isContinuation={isCurrentContinuation}
        isLocked={isLocked}
        isSignedIn={isSignedIn}
        authBusy={authBusy}
        authError={authError}
        canTurnPrev={canTurnPrev}
        canTurnNext={canTurnNext}
        voiceControl={voiceControl}
        inkConfig={inkConfig}
        inkToolbarOpen={inkToolbarOpen}
        focusRequest={focusRequest}
        onUpdateSpread={(patch) => onUpdateSpread(currentIndex, patch)}
        onTriggerTurn={(dir) => triggerProgrammaticTurn(dir, 'bottom')}
        onContinueLocal={() => triggerProgrammaticTurn('next', 'bottom')}
        onSignInWithGoogle={onSignInWithGoogle}
        onClearAuthError={onClearAuthError}
        onCloseBook={onCloseBook}
        onNewSpread={onNewSpread}
        onOpenIndex={onOpenIndex}
        onOpenExport={onOpenExport}
        onOpenAccount={onOpenAccount}
        onMenuOpenChange={setIsMenuOpen}
        onToggleInkToolbar={onToggleInkToolbar}
        onCommitInk={(side, nextInk) => onCommitInk?.(currentIndex, side, nextInk)}
        onPenActivity={handlePenActivity}
        onStylusActive={(side) => onStylusActive?.(currentIndex, side)}
        onInkCapacityWarning={onInkCapacityWarning}
        onPageOverflow={handlePageOverflow}
        onClearFocusRequest={onClearFocusRequest}
      />

      {bookPhase !== 'open' && (
        <div
          ref={coverRefs.rightShadowRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 z-20 bg-[#1a130d] dark:bg-black"
          style={{
            left: isMobile ? '0px' : undefined,
            right: isMobile ? undefined : '0px',
            width: `${pageW}px`,
            height: `${pageH}px`,
            opacity:
              bookPhase === 'closed'
                ? isMobile
                  ? BOOK_COVER_CONFIG.MOBILE_SHADOW_MAX_OPACITY
                  : BOOK_COVER_CONFIG.DESKTOP_SHADOW_MAX_OPACITY
                : 0,
          }}
        />
      )}

      <CurlFlapOverlay
        curl={curl}
        pageW={pageW}
        pageH={pageH}
        isMobile={isMobile}
        isDark={isDark}
        isSignedIn={isSignedIn}
        nextReveal={nextReveal}
        prevReveal={prevReveal}
        flapBack={flapBack}
      />

      <CurlInteractionZones
        enabled={
          isOpenInteractive &&
          !isMenuOpen &&
          !(inkConfig?.drawArmed && inkConfig?.allowTouchDraw)
        }
        isMobile={isMobile}
        showWelcome={showWelcome}
        inkToolbarOpen={inkToolbarOpen}
        canTurnPrev={canTurnPrev}
        onStartHoverCurl={startHoverCurl}
        onEndHoverCurl={endHoverCurl}
        onZonePointerDown={handleZonePointerDown}
        onZonePointerMove={handleZonePointerMove}
        onZonePointerUp={handleZonePointerUp}
      />
    </BookFrameChrome>
  );
};
