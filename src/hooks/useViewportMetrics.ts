import { useEffect, useState } from 'react';
import { VIEWPORT_LAYOUT } from '../constants/workspace';
import { ViewportMetrics } from '../types/book';
import { computeViewportMetrics } from '../utils/viewport';

/**
 * Tracks window dimensions and computes responsive single-page mobile or dual-page desktop metrics.
 * @returns Current ViewportMetrics (`pageW`, `pageH`, `isMobile`, `isLandscapeMobile`).
 */
export function useViewportMetrics(): ViewportMetrics {
  const [metrics, setMetrics] = useState<ViewportMetrics>(() =>
    computeViewportMetrics(
      typeof window !== 'undefined'
        ? window.innerWidth
        : VIEWPORT_LAYOUT.DEFAULT_WIDTH,
      typeof window !== 'undefined'
        ? window.innerHeight
        : VIEWPORT_LAYOUT.DEFAULT_HEIGHT
    )
  );

  useEffect(() => {
    const onResize = () => {
      setMetrics(
        computeViewportMetrics(window.innerWidth, window.innerHeight)
      );
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return metrics;
}
