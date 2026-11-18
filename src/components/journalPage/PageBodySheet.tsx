import React from 'react';
import { PAGE_SHEET_METRICS } from '../../constants/journal';
import { usePageOverflow } from '../../hooks/usePageOverflow';
import { InkToolConfig } from '../../types/ink';
import { JournalSpread } from '../../types/journal';
import { PageFocusRequest } from '../../types/pageContent';
import { RecordingStatus } from '../../types/voice';
import { InkCanvasLayer } from '../ink/InkCanvasLayer';

/** Props accepted by the PageBodySheet prose and ink canvas wrapper component. */
interface PageBodySheetProps {
  spread: JournalSpread;
  side: 'left' | 'right';
  spreadIndex: number;
  pageH: number;
  paddingTop: number;
  paddingBottom: number;
  isMobile: boolean;
  isContinuation: boolean;
  isCompactHeader: boolean;
  interactive: boolean;
  locked: boolean;
  isDark: boolean;
  activeInkHex: string;
  paperRuleClass: string;
  handFontFamily: string;
  handFontSize: number;
  inkConfig: InkToolConfig;
  showEmptyPlaceholders: boolean;
  focusRequest?: PageFocusRequest | null;
  voiceStatus?: RecordingStatus;
  onUpdateSpread?: (patch: Partial<JournalSpread>) => void;
  onPageOverflow?: (
    side: 'left' | 'right',
    fitText: string,
    overflowText: string,
    moveFocus: boolean,
    caretOffset: number
  ) => void;
  onClearFocusRequest?: (nonce: number) => void;
  onCommitInk?: (side: 'left' | 'right', nextSerialized: string) => void;
  onPenActivity?: () => void;
  onStylusActive?: (side: 'left' | 'right') => void;
  onInkCapacityWarning?: (message: string) => void;
}

/**
 * Renders the fixed physical ruled/dotted sheet combining prose editing, overflow mirroring, and stylus ink drawing.
 * @param props - Spread data, optical font styles, ink tool config, focus request, and edit/ink callbacks.
 * @returns Non-scrolling paper sheet region containing InkCanvasLayer and prose textarea or display block.
 */
export const PageBodySheet: React.FC<PageBodySheetProps> = ({
  spread,
  side,
  spreadIndex,
  pageH,
  paddingTop,
  paddingBottom,
  isMobile,
  isContinuation,
  isCompactHeader,
  interactive,
  locked,
  isDark,
  activeInkHex,
  paperRuleClass,
  handFontFamily,
  handFontSize,
  inkConfig,
  showEmptyPlaceholders,
  focusRequest,
  voiceStatus,
  onUpdateSpread,
  onPageOverflow,
  onClearFocusRequest,
  onCommitInk,
  onPenActivity,
  onStylusActive,
  onInkCapacityWarning,
}) => {
  const bodyText = side === 'left' ? spread.leftBody : spread.rightBody;
  const serializedInk = side === 'left' ? spread.leftInk : spread.rightInk;

  const { refs, writableHeightPx, handleBodyChange } = usePageOverflow({
    side,
    spreadIndex,
    pageH,
    paddingTop,
    paddingBottom,
    isMobile,
    isCompactHeader,
    bodyText,
    interactive,
    locked,
    focusRequest,
    voiceStatus,
    onUpdateSpread,
    onPageOverflow,
    onClearFocusRequest,
  });

  const placeholder =
    inkConfig.drawArmed || serializedInk
      ? ''
      : side === 'right'
        ? 'Continue your thoughts on the facing page...'
        : isContinuation
          ? 'Continue writing...'
          : "Begin writing today's page...";

  const textMetricsStyle: React.CSSProperties = {
    fontFamily: handFontFamily,
    fontSize: `${handFontSize}px`,
    lineHeight: `${PAGE_SHEET_METRICS.LINE_HEIGHT_PX}px`,
    paddingTop: '1px',
  };

  return (
    <div
      ref={refs.bodyContainerRef}
      className={`relative z-10 flex-1 min-h-0 overflow-hidden ${paperRuleClass}`}
    >
      <div
        ref={refs.overflowMeasureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute top-0 left-0 right-0 whitespace-pre-wrap break-words ink-prose m-0 p-0 border-0"
        style={textMetricsStyle}
      />

      <InkCanvasLayer
        serializedInk={serializedInk}
        interactive={interactive}
        locked={locked}
        isDark={isDark}
        inkConfig={inkConfig}
        onCommitInk={(nextInk) => onCommitInk?.(side, nextInk)}
        onPenActivity={onPenActivity}
        onStylusActive={() => onStylusActive?.(side)}
        onCapacityWarning={onInkCapacityWarning}
      >
        {interactive ? (
          <textarea
            ref={refs.textareaRef}
            value={bodyText}
            readOnly={locked}
            onChange={handleBodyChange}
            placeholder={placeholder}
            spellCheck={false}
            className="w-full resize-none overflow-hidden bg-transparent ink-prose focus:outline-none select-text placeholder:text-[#ab9c88]/70 dark:placeholder:text-[#6c6053] m-0 p-0 border-0"
            style={{
              height: `${writableHeightPx}px`,
              color: activeInkHex,
              ...textMetricsStyle,
            }}
          />
        ) : (
          <div
            className="w-full overflow-hidden whitespace-pre-wrap break-words ink-prose"
            style={{
              height: `${writableHeightPx}px`,
              color: activeInkHex,
              ...textMetricsStyle,
            }}
          >
            {bodyText && bodyText}
            {!bodyText &&
              side === 'left' &&
              showEmptyPlaceholders &&
              !serializedInk && (
                <span className="text-[#ab9c88]/70 dark:text-[#6c6053]">
                  {isContinuation
                    ? 'Continue writing...'
                    : "Begin writing today's page..."}
                </span>
              )}
          </div>
        )}
      </InkCanvasLayer>
    </div>
  );
};
