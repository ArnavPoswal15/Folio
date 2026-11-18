import { VIEWPORT_LAYOUT } from '../constants/workspace';
import { ViewportMetrics } from '../types/book';

/**
 * Computes responsive single-page (mobile) or dual-page (desktop) book dimensions.
 * @param vw - Current viewport width in CSS pixels.
 * @param vh - Current viewport height in CSS pixels.
 * @returns Computed page dimensions and mobile/landscape flags.
 */
export function computeViewportMetrics(
  vw: number,
  vh: number
): ViewportMetrics {
  const isLandscapeMobile =
    vw > vh &&
    vh < VIEWPORT_LAYOUT.LANDSCAPE_MAX_HEIGHT_PX &&
    vw < VIEWPORT_LAYOUT.LANDSCAPE_MAX_WIDTH_PX;
  const isMobile =
    vw < VIEWPORT_LAYOUT.MOBILE_BREAKPOINT_PX || isLandscapeMobile;

  if (isMobile) {
    const availW = Math.max(200, vw - VIEWPORT_LAYOUT.MOBILE_MARGIN_X);
    const availH = Math.max(
      220,
      vh -
        (isLandscapeMobile
          ? VIEWPORT_LAYOUT.LANDSCAPE_MARGIN_Y
          : VIEWPORT_LAYOUT.MOBILE_MARGIN_Y)
    );
    const maxPageW = Math.min(VIEWPORT_LAYOUT.MOBILE_MAX_W, availW);
    const pageH = Math.min(
      availH,
      Math.round(maxPageW / VIEWPORT_LAYOUT.MOBILE_ASPECT)
    );
    const pageW = Math.max(
      VIEWPORT_LAYOUT.MOBILE_MIN_W,
      Math.min(maxPageW, Math.round(pageH * VIEWPORT_LAYOUT.MOBILE_ASPECT))
    );
    return { pageW, pageH, isMobile: true, isLandscapeMobile };
  }

  const availW = Math.max(540, vw - VIEWPORT_LAYOUT.DESKTOP_MARGIN_X);
  const availH = Math.max(360, vh - VIEWPORT_LAYOUT.DESKTOP_MARGIN_Y);

  const maxPageWByWidth = Math.floor(
    (availW - VIEWPORT_LAYOUT.FRAME_GUTTER_PX) / 2
  );
  const maxPageWByHeight = Math.floor(
    (availH - VIEWPORT_LAYOUT.FRAME_PAD_PX) * VIEWPORT_LAYOUT.DESKTOP_ASPECT
  );

  const pageW = Math.max(
    VIEWPORT_LAYOUT.DESKTOP_MIN_W,
    Math.min(
      VIEWPORT_LAYOUT.DESKTOP_MAX_W,
      maxPageWByWidth,
      maxPageWByHeight
    )
  );
  const pageH = Math.round(pageW / VIEWPORT_LAYOUT.DESKTOP_ASPECT);

  return { pageW, pageH, isMobile: false, isLandscapeMobile: false };
}

/**
 * Checks the user's operating system reduced-motion media preference safely.
 * @returns True when reduced motion is enabled in the browser.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
