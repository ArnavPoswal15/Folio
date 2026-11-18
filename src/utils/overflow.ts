import { PAGE_SHEET_METRICS } from '../constants/journal';
import { OverflowSplitResult } from '../types/pageContent';

/**
 * Binary-searches rendered height in a hidden mirror element and computes a clean word-boundary overflow split.
 * @param measureEl - Hidden offscreen div sharing exact typography styles with the visible page textarea.
 * @param textValue - Candidate full text string to evaluate for vertical overflow.
 * @param caretPos - Current selection start offset within `textValue`.
 * @param overflowThresholdPx - Maximum vertical height in pixels before text overflows onto the next page.
 * @returns Fit/overflow split metadata and adjusted caret offset, or null when text fits cleanly.
 */
export function measureTextSplitAtBoundary(
  measureEl: HTMLElement | null,
  textValue: string,
  caretPos: number,
  overflowThresholdPx: number
): OverflowSplitResult | null {
  if (!measureEl || !textValue) return null;

  const measureH = (candidate: string): number => {
    if (!candidate) return 0;
    measureEl.textContent = candidate.endsWith('\n')
      ? `${candidate}\u200b`
      : candidate;
    return measureEl.offsetHeight || measureEl.getBoundingClientRect().height;
  };

  const fullH = measureH(textValue);
  if (fullH <= overflowThresholdPx) {
    measureEl.textContent = '';
    return null;
  }

  let low = 0;
  let high = textValue.length;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (measureH(textValue.slice(0, mid)) <= overflowThresholdPx) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  let splitIdx = low;
  if (
    splitIdx > 0 &&
    splitIdx < textValue.length &&
    !/\s/.test(textValue[splitIdx]) &&
    !/\s/.test(textValue[splitIdx - 1])
  ) {
    const windowStart = Math.max(
      0,
      splitIdx - PAGE_SHEET_METRICS.OVERFLOW_WORD_LOOKBACK
    );
    let foundWs = -1;
    for (let i = splitIdx - 1; i >= windowStart; i--) {
      if (/\s/.test(textValue[i])) {
        foundWs = i;
        break;
      }
    }
    if (foundWs > 0) {
      splitIdx = foundWs;
    }
  }

  const fitText = textValue.slice(0, splitIdx);
  const rawTail = textValue.slice(splitIdx);
  const overflowText = rawTail.replace(/^[ \n]/, '');
  const stripped = rawTail.length - overflowText.length;
  const moveFocus = caretPos >= splitIdx;
  const caretOffset = moveFocus
    ? Math.max(0, caretPos - fitText.length - stripped)
    : 0;

  measureEl.textContent = '';
  return { fitText, overflowText, moveFocus, caretOffset };
}
