import { BOOKMARK_RIBBON_CONFIG } from '../constants/bookmark';
import { RibbonPathFrame } from '../types/bookmark';

const { L, W, BASE_LENGTH } = BOOKMARK_RIBBON_CONFIG;

/**
 * Nonlinear vertical resistance while dragging — exponential saturation downward.
 */
export function ribbonRubber(d: number): number {
  if (d <= 0) return Math.max(d * 0.24, -10);
  return L * (1 - Math.exp(-d / L));
}

/**
 * Inverse of ribbonRubber so re-grabs mid-bounce stay seamless (no jump).
 */
export function ribbonInverse(pull: number): number {
  if (pull <= 0) return pull / 0.24;
  return -L * Math.log(1 - Math.min(pull, L * 0.999) / L);
}

/**
 * Builds the simple swallowtail ribbon path and sheen from pull + lateral sway.
 */
export function buildRibbonPath(pull: number, sway: number): RibbonPathFrame {
  const cx = W / 2;
  const topHalfW = W / 2;
  const stretch = Math.max(-0.25, Math.min(1, pull / L));
  const tailHalfW = topHalfW * (1 - 0.34 * stretch);

  const tipY = Math.max(14, BASE_LENGTH + pull);
  const notchDepth = Math.max(6, 9 * (1 - 0.16 * Math.max(0, stretch)));
  const notchY = tipY - notchDepth;
  const tipCx = cx + sway;

  const leftTop = cx - topHalfW;
  const rightTop = cx + topHalfW;
  const leftTip = tipCx - tailHalfW;
  const rightTip = tipCx + tailHalfW;

  const midY = tipY * 0.55;
  const ctrlHalfW = topHalfW * 0.45 + tailHalfW * 0.55;
  const leftCtrlX = cx + sway * 0.28 - ctrlHalfW;
  const rightCtrlX = cx + sway * 0.28 + ctrlHalfW;

  const d = [
    `M ${leftTop.toFixed(2)} 0`,
    `Q ${leftCtrlX.toFixed(2)} ${midY.toFixed(2)} ${leftTip.toFixed(2)} ${tipY.toFixed(2)}`,
    `L ${tipCx.toFixed(2)} ${notchY.toFixed(2)}`,
    `L ${rightTip.toFixed(2)} ${tipY.toFixed(2)}`,
    `Q ${rightCtrlX.toFixed(2)} ${midY.toFixed(2)} ${rightTop.toFixed(2)} 0`,
    'Z',
  ].join(' ');

  const sheenOpacity = Math.max(0, Math.min(0.4, stretch * 0.4));
  return { d, sheenOpacity };
}

export const INITIAL_RIBBON_PATH = buildRibbonPath(0, 0).d;