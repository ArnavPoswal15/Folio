import React, { useLayoutEffect, useRef, useState } from 'react';
import { PAGE_SHEET_METRICS } from '../constants/journal';
import { JournalSpread } from '../types/journal';
import { PageFocusRequest } from '../types/pageContent';
import { RecordingStatus } from '../types/voice';
import { measureTextSplitAtBoundary } from '../utils/overflow';

/** Options accepted by the usePageOverflow hook. */
interface UsePageOverflowOptions {
  side: 'left' | 'right';
  spreadIndex: number;
  pageH: number;
  paddingTop: number;
  paddingBottom: number;
  isMobile: boolean;
  isCompactHeader: boolean;
  bodyText: string;
  interactive: boolean;
  locked: boolean;
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
}

/**
 * Measures physical sheet line capacity, splits overflowing typed or dictated prose across pages, and restores caret focus.
 * @param options - Page dimensions, prose content, focus request, and overflow callbacks.
 * @returns DOM refs for the sheet/textarea/mirror, exact writable height in pixels, and textarea change handler.
 */
export function usePageOverflow({
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
}: UsePageOverflowOptions) {
  const bodyContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overflowMeasureRef = useRef<HTMLDivElement | null>(null);
  const [bodyViewportHeight, setBodyViewportHeight] = useState<number>(0);

  useLayoutEffect(() => {
    const el = bodyContainerRef.current;
    if (!el) return;
    const sync = () => {
      const h = el.clientHeight || el.getBoundingClientRect().height;
      if (h > 0) {
        setBodyViewportHeight(h);
      }
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const estimatedBodyH = Math.max(
    160,
    pageH -
      paddingTop -
      paddingBottom -
      (!isCompactHeader ? (isMobile ? 168 : 135) : isMobile ? 105 : 64) -
      34
  );
  const effectiveViewportH =
    bodyViewportHeight > 0 ? bodyViewportHeight : estimatedBodyH;
  const maxLines = Math.max(
    1,
    Math.floor((effectiveViewportH - 2) / PAGE_SHEET_METRICS.LINE_HEIGHT_PX)
  );
  const writableHeightPx =
    maxLines * PAGE_SHEET_METRICS.LINE_HEIGHT_PX +
    PAGE_SHEET_METRICS.WRITABLE_PAD_PX;
  const overflowThresholdPx =
    maxLines * PAGE_SHEET_METRICS.LINE_HEIGHT_PX +
    PAGE_SHEET_METRICS.OVERFLOW_THRESHOLD_PAD_PX;

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    const field = side === 'left' ? 'leftBody' : 'rightBody';

    if (onPageOverflow && nextValue.length > bodyText.length) {
      const caretPos = e.target.selectionStart ?? nextValue.length;
      const split = measureTextSplitAtBoundary(
        overflowMeasureRef.current,
        nextValue,
        caretPos,
        overflowThresholdPx
      );
      if (split) {
        onPageOverflow(
          side,
          split.fitText,
          split.overflowText,
          split.moveFocus,
          split.caretOffset
        );
        return;
      }
    }

    onUpdateSpread?.({ [field]: nextValue });
  };

  useLayoutEffect(() => {
    if (
      !interactive ||
      locked ||
      !focusRequest ||
      focusRequest.spreadIndex !== spreadIndex ||
      focusRequest.side !== side
    ) {
      return;
    }
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = Math.max(
      0,
      Math.min(ta.value.length, focusRequest.caretOffset)
    );
    const rafId = requestAnimationFrame(() => {
      ta.focus({ preventScroll: true });
      try {
        ta.setSelectionRange(pos, pos);
      } catch {
        // Ignore selection errors
      }
      onClearFocusRequest?.(focusRequest.nonce);
    });
    return () => cancelAnimationFrame(rafId);
  }, [focusRequest, interactive, locked, onClearFocusRequest, side, spreadIndex]);

  const prevVoiceStatusRef = useRef<RecordingStatus | undefined>(voiceStatus);
  const thresholdRef = useRef(overflowThresholdPx);
  thresholdRef.current = overflowThresholdPx;

  useLayoutEffect(() => {
    const prevStatus = prevVoiceStatusRef.current;
    prevVoiceStatusRef.current = voiceStatus;

    if (
      !interactive ||
      locked ||
      !onPageOverflow ||
      prevStatus !== 'transcribing' ||
      voiceStatus !== 'idle' ||
      !bodyText
    ) {
      return;
    }

    const split = measureTextSplitAtBoundary(
      overflowMeasureRef.current,
      bodyText,
      bodyText.length,
      thresholdRef.current
    );
    if (split) {
      onPageOverflow(
        side,
        split.fitText,
        split.overflowText,
        true,
        split.caretOffset
      );
    }
  }, [bodyText, interactive, locked, onPageOverflow, side, voiceStatus]);

  return {
    refs: {
      bodyContainerRef,
      textareaRef,
      overflowMeasureRef,
    },
    writableHeightPx,
    handleBodyChange,
  };
}
