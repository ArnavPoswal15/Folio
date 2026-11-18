import React, { useEffect, useState } from 'react';
import { DEFAULT_READONLY_INK_CONFIG, INK_COLORS } from '../../constants/ink';
import { JOURNAL_FONTS, PAGE_SHEET_METRICS } from '../../constants/journal';
import { useTheme } from '../../contexts/ThemeContext';
import { JournalPageContentProps } from '../../types/pageContent';
import { formatJournalDateParts } from '../../utils/date';
import { PageBodySheet } from './PageBodySheet';
import { PageCompactHeader } from './PageCompactHeader';
import { PageDateHeader } from './PageDateHeader';
import { PageFooterNav } from './PageFooterNav';

/**
 * Renders a single left or right physical journal sheet with spine shading, header, ruled writing surface, ink overlay, and footer nav.
 * @param props - Spread data, dimensions, layout flags, ink/voice configs, and edit/turn callbacks.
 * @returns Styled journal sheet container element.
 */
export const JournalPageContent: React.FC<JournalPageContentProps> = ({
  spread,
  side,
  spreadIndex,
  pageW,
  pageH,
  isMobile = false,
  isContinuation = false,
  interactive = true,
  locked = false,
  onUpdateSpread,
  onPageOverflow,
  focusRequest,
  onClearFocusRequest,
  onNewSpread,
  onOpenIndex,
  onOpenExport,
  onOpenAccount,
  isSignedIn = false,
  onCloseBook,
  onTriggerTurn,
  canTurnPrev = false,
  canTurnNext = true,
  showEmptyPlaceholders = false,
  showCornerSheen = false,
  voiceControl,
  onMenuOpenChange,
  inkConfig = DEFAULT_READONLY_INK_CONFIG,
  inkToolbarOpen = false,
  onToggleInkToolbar,
  onCommitInk,
  onPenActivity,
  onStylusActive,
  onInkCapacityWarning,
}) => {
  const { isDark, journalFont } = useTheme();
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);

  useEffect(() => {
    onMenuOpenChange?.(actionsMenuOpen || fontMenuOpen);
  }, [actionsMenuOpen, fontMenuOpen, onMenuOpenChange]);

  const ink = INK_COLORS[spread.inkColor] ?? INK_COLORS.charcoal;
  const activeInkHex = isDark ? ink.darkHex : ink.hex;
  const dateInfo = formatJournalDateParts(spread.date);
  const pageNumber = spreadIndex * 2 + (side === 'left' ? 1 : 2);

  const activeFont = JOURNAL_FONTS[journalFont] ?? JOURNAL_FONTS.caveat;
  const scaleRatio = Math.min(
    1,
    Math.max(
      PAGE_SHEET_METRICS.MIN_SCALE_RATIO,
      pageW / PAGE_SHEET_METRICS.REFERENCE_PAGE_W
    )
  );
  const handFontSize = Math.round(
    PAGE_SHEET_METRICS.BASE_HAND_FONT_PX * scaleRatio * activeFont.sizeScale
  );
  const contextFontSize = Math.round(
    PAGE_SHEET_METRICS.BASE_CONTEXT_FONT_PX * activeFont.contextScale
  );

  const paperRuleClass =
    spread.paperStyle === 'ruled'
      ? 'paper-ruled'
      : spread.paperStyle === 'dotted'
        ? 'paper-dotted'
        : '';

  const paddingX = Math.round(
    isMobile
      ? PAGE_SHEET_METRICS.MOBILE_PAD_X
      : PAGE_SHEET_METRICS.DESKTOP_PAD_X * scaleRatio
  );
  const paddingTop = Math.round(
    isMobile
      ? PAGE_SHEET_METRICS.MOBILE_PAD_TOP
      : PAGE_SHEET_METRICS.DESKTOP_PAD_TOP * scaleRatio
  );
  const paddingBottom = Math.round(
    isMobile
      ? PAGE_SHEET_METRICS.MOBILE_PAD_BOTTOM
      : PAGE_SHEET_METRICS.DESKTOP_PAD_BOTTOM * scaleRatio
  );

  const isCompactHeader = side === 'right' || isContinuation;

  return (
    <div
      className="relative isolate w-full h-full paper-grain overflow-hidden flex flex-col select-none"
      style={{
        width: `${pageW}px`,
        height: `${pageH}px`,
        paddingLeft: `${paddingX}px`,
        paddingRight: `${paddingX}px`,
        paddingTop: `${paddingTop}px`,
        paddingBottom: `${paddingBottom}px`,
      }}
    >
      {isMobile ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-7 spine-gutter-mobile"
        />
      ) : side === 'left' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-12 spine-gutter-left"
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-12 spine-gutter-right"
        />
      )}

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${
          side === 'left' ? 'paper-edge-left' : 'paper-edge-right'
        }`}
      />

      {!isCompactHeader ? (
        <PageDateHeader
          spread={spread}
          spreadIndex={spreadIndex}
          dateInfo={dateInfo}
          isMobile={isMobile}
          interactive={interactive}
          locked={locked}
          isSignedIn={isSignedIn}
          showEmptyPlaceholders={showEmptyPlaceholders}
          inkToolbarOpen={inkToolbarOpen}
          handFontFamily={activeFont.cssFamily}
          contextFontSize={contextFontSize}
          actionsMenuOpen={actionsMenuOpen}
          voiceControl={voiceControl}
          onUpdateSpread={onUpdateSpread}
          onToggleInkToolbar={onToggleInkToolbar}
          onNewSpread={onNewSpread}
          onOpenIndex={onOpenIndex}
          onOpenExport={onOpenExport}
          onOpenAccount={onOpenAccount}
          onCloseBook={onCloseBook}
          onActionsMenuOpenChange={setActionsMenuOpen}
          onFontMenuOpenChange={setFontMenuOpen}
        />
      ) : (
        <PageCompactHeader
          side={side}
          spreadIndex={spreadIndex}
          pageW={pageW}
          dateInfo={dateInfo}
          isMobile={isMobile}
          interactive={interactive}
          locked={locked}
          isSignedIn={isSignedIn}
          inkToolbarOpen={inkToolbarOpen}
          actionsMenuOpen={actionsMenuOpen}
          voiceControl={voiceControl}
          onToggleInkToolbar={onToggleInkToolbar}
          onNewSpread={onNewSpread}
          onOpenIndex={onOpenIndex}
          onOpenExport={onOpenExport}
          onOpenAccount={onOpenAccount}
          onCloseBook={onCloseBook}
          onActionsMenuOpenChange={setActionsMenuOpen}
        />
      )}

      <PageBodySheet
        spread={spread}
        side={side}
        spreadIndex={spreadIndex}
        pageH={pageH}
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
        isMobile={isMobile}
        isContinuation={isContinuation}
        isCompactHeader={isCompactHeader}
        interactive={interactive}
        locked={locked}
        isDark={isDark}
        activeInkHex={activeInkHex}
        paperRuleClass={paperRuleClass}
        handFontFamily={activeFont.cssFamily}
        handFontSize={handFontSize}
        inkConfig={inkConfig}
        showEmptyPlaceholders={showEmptyPlaceholders}
        focusRequest={focusRequest}
        voiceStatus={voiceControl?.status}
        onUpdateSpread={onUpdateSpread}
        onPageOverflow={onPageOverflow}
        onClearFocusRequest={onClearFocusRequest}
        onCommitInk={onCommitInk}
        onPenActivity={onPenActivity}
        onStylusActive={onStylusActive}
        onInkCapacityWarning={onInkCapacityWarning}
      />

      <PageFooterNav
        side={side}
        pageNumber={pageNumber}
        isMobile={isMobile}
        interactive={interactive}
        locked={locked}
        canTurnPrev={canTurnPrev}
        canTurnNext={canTurnNext}
        onTriggerTurn={onTriggerTurn}
      />

      {(interactive || showCornerSheen) &&
        ((side === 'right' && canTurnNext) ||
          (side === 'left' && canTurnPrev) ||
          (isMobile && canTurnNext)) && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 z-10 w-5 h-5 opacity-45 corner-sheen-right"
          style={{
            display: isMobile || side === 'right' ? 'block' : 'none',
          }}
        />
      )}
      {(interactive || showCornerSheen) &&
        !isMobile &&
        side === 'left' &&
        canTurnPrev && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 z-10 w-5 h-5 opacity-45 corner-sheen-left"
        />
      )}
    </div>
  );
};
