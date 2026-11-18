import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BOOKMARK_RIBBON_CONFIG } from '../constants/bookmark';
import { RibbonDragMeta, RibbonPhysics } from '../types/bookmark';
import {
  buildRibbonPaths,
  computeRibbonLateralTip,
  computeRibbonRubberStretch,
} from '../utils/bookmarkRibbon';
import { prefersReducedMotion } from '../utils/viewport';

/**
 * Drives the woven silk bookmark ribbon spring physics in a ref-only rAF loop without per-frame React re-renders.
 * @param isMobile - Whether single-page mobile viewport sizing is active.
 * @param motionPulseKey - Key that triggers a reactive breeze sway when the book opens/closes or pages turn.
 * @returns SVG element refs, drag cursor state, and pointer/keyboard event handlers.
 */
export function useBookmarkRibbon(
  isMobile: boolean,
  motionPulseKey?: string | number
) {
  const maxStretch = isMobile
    ? BOOKMARK_RIBBON_CONFIG.MAX_STRETCH_MOBILE
    : BOOKMARK_RIBBON_CONFIG.MAX_STRETCH_DESKTOP;

  const ribbonPathRef = useRef<SVGPathElement | null>(null);
  const weavePathRef = useRef<SVGPathElement | null>(null);
  const sheenPathRef = useRef<SVGPathElement | null>(null);
  const edgeHighlightRef = useRef<SVGPathElement | null>(null);
  const shadowPathRef = useRef<SVGPathElement | null>(null);
  const creasePathRef = useRef<SVGPathElement | null>(null);
  const hitPathRef = useRef<SVGPathElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  const physicsRef = useRef<RibbonPhysics>({
    stretch: 0,
    stretchVel: 0,
    tipX: 0,
    tipXVel: 0,
    midLag: 0,
    midLagVel: 0,
    curl: 0,
    curlVel: 0,
    rippleAmp: 0,
    ripplePhase: 0,
    targetStretch: 0,
    targetTipX: 0,
    dragging: false,
  });

  const dragMetaRef = useRef<RibbonDragMeta>({
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    lastClientX: 0,
    lastTimeMs: 0,
    flingVelX: 0,
    hasMoved: false,
  });

  const rafIdRef = useRef<number | null>(null);
  const lastFrameMsRef = useRef<number>(0);

  const paintRibbon = useCallback(
    (nowMs: number) => {
      const p = physicsRef.current;
      const geo = buildRibbonPaths(p, maxStretch, nowMs * 0.001);

      ribbonPathRef.current?.setAttribute('d', geo.ribbonPath);
      weavePathRef.current?.setAttribute('d', geo.ribbonPath);

      if (sheenPathRef.current) {
        sheenPathRef.current.setAttribute('d', geo.ribbonPath);
        sheenPathRef.current.style.opacity = geo.sheenOpacity.toFixed(3);
      }

      if (edgeHighlightRef.current) {
        edgeHighlightRef.current.setAttribute('d', geo.edgeHighlightPath);
        edgeHighlightRef.current.style.opacity =
          geo.edgeHighlightOpacity.toFixed(3);
      }

      if (shadowPathRef.current) {
        shadowPathRef.current.setAttribute('d', geo.shadowPath);
        shadowPathRef.current.setAttribute(
          'transform',
          `translate(${geo.shadowOffsetX.toFixed(2)}, ${geo.shadowOffsetY.toFixed(2)})`
        );
        shadowPathRef.current.style.opacity = geo.shadowBlurOpacity.toFixed(3);
      }

      if (creasePathRef.current) {
        creasePathRef.current.setAttribute('d', geo.ribbonPath);
        creasePathRef.current.style.opacity = geo.creaseOpacity.toFixed(3);
      }

      hitPathRef.current?.setAttribute('d', geo.centerlinePath);
    },
    [maxStretch]
  );

  const ensureAnimationLoop = useCallback(() => {
    if (rafIdRef.current !== null) return;
    lastFrameMsRef.current = performance.now();

    const step = (nowMs: number) => {
      const cfg = BOOKMARK_RIBBON_CONFIG;
      const dt = Math.min(
        0.032,
        Math.max(0.004, (nowMs - lastFrameMsRef.current) / 1000)
      );
      lastFrameMsRef.current = nowMs;
      const p = physicsRef.current;

      if (prefersReducedMotion()) {
        p.stretch += (p.targetStretch - p.stretch) * Math.min(1, dt * 18);
        p.tipX += (p.targetTipX - p.tipX) * Math.min(1, dt * 18);
        p.midLag *= Math.exp(-16 * dt);
        p.curl *= Math.exp(-16 * dt);
        p.rippleAmp = 0;
      } else if (p.dragging) {
        const sAcc =
          (p.targetStretch - p.stretch) * cfg.DRAG_STRETCH_K -
          p.stretchVel * cfg.DRAG_STRETCH_C;
        p.stretchVel += sAcc * dt;
        p.stretch += p.stretchVel * dt;

        const xAcc =
          (p.targetTipX - p.tipX) * cfg.DRAG_X_K - p.tipXVel * cfg.DRAG_X_C;
        p.tipXVel += xAcc * dt;
        p.tipX += p.tipXVel * dt;

        const desiredMid = -p.tipX * 0.24 - p.tipXVel * 0.018;
        const mAcc =
          (desiredMid - p.midLag) * cfg.DRAG_MID_K - p.midLagVel * cfg.DRAG_MID_C;
        p.midLagVel += mAcc * dt;
        p.midLag += p.midLagVel * dt;

        const desiredCurl = -p.tipX * 0.012;
        const cAcc =
          (desiredCurl - p.curl) * cfg.DRAG_CURL_K - p.curlVel * cfg.DRAG_CURL_C;
        p.curlVel += cAcc * dt;
        p.curl += p.curlVel * dt;

        p.rippleAmp *= Math.exp(-7 * dt);
        p.ripplePhase += dt * 14;
      } else {
        const stretchAcc =
          -cfg.FREE_STRETCH_K * p.stretch - cfg.FREE_STRETCH_C * p.stretchVel;
        p.stretchVel += stretchAcc * dt;
        p.stretch += p.stretchVel * dt;

        const tipAcc =
          -cfg.FREE_TIP_K * p.tipX - cfg.FREE_TIP_C * p.tipXVel;
        p.tipXVel += tipAcc * dt;
        p.tipX += p.tipXVel * dt;

        const midAcc =
          -cfg.FREE_MID_K * p.midLag -
          cfg.FREE_MID_C * p.midLagVel -
          p.tipXVel * 1.4;
        p.midLagVel += midAcc * dt;
        p.midLag += p.midLagVel * dt;

        const curlAcc =
          -cfg.FREE_CURL_K * p.curl -
          cfg.FREE_CURL_C * p.curlVel +
          p.midLagVel * 0.05;
        p.curlVel += curlAcc * dt;
        p.curl += p.curlVel * dt;

        p.ripplePhase += dt * 23;
        p.rippleAmp *= Math.exp(-3.1 * dt);
      }

      paintRibbon(nowMs);

      const isSettled =
        !p.dragging &&
        Math.abs(p.stretch) < cfg.SETTLE_POS_EPS &&
        Math.abs(p.stretchVel) < cfg.SETTLE_VEL_EPS &&
        Math.abs(p.tipX) < cfg.SETTLE_POS_EPS &&
        Math.abs(p.tipXVel) < cfg.SETTLE_VEL_EPS &&
        Math.abs(p.midLag) < cfg.SETTLE_POS_EPS &&
        Math.abs(p.midLagVel) < cfg.SETTLE_VEL_EPS &&
        Math.abs(p.curl) < cfg.SETTLE_CURL_EPS &&
        p.rippleAmp < cfg.SETTLE_POS_EPS;

      if (isSettled) {
        p.stretch = 0;
        p.stretchVel = 0;
        p.tipX = 0;
        p.tipXVel = 0;
        p.midLag = 0;
        p.midLagVel = 0;
        p.curl = 0;
        p.curlVel = 0;
        p.rippleAmp = 0;
        paintRibbon(nowMs);
        rafIdRef.current = null;
        return;
      }

      rafIdRef.current = requestAnimationFrame(step);
    };

    rafIdRef.current = requestAnimationFrame(step);
  }, [paintRibbon]);

  useEffect(() => {
    paintRibbon(performance.now());
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [paintRibbon]);

  const prevPulseRef = useRef(motionPulseKey);
  useEffect(() => {
    if (prevPulseRef.current === motionPulseKey) return;
    prevPulseRef.current = motionPulseKey;
    if (prefersReducedMotion()) return;
    const p = physicsRef.current;
    if (p.dragging) return;
    p.tipXVel += (Math.random() > 0.5 ? 1 : -1) * 42;
    p.midLagVel += (Math.random() - 0.5) * 32;
    p.rippleAmp = Math.max(p.rippleAmp, 1.8);
    ensureAnimationLoop();
  }, [ensureAnimationLoop, motionPulseKey]);

  const releaseRibbon = useCallback(
    (quickTap: boolean, flingVelX = 0) => {
      const p = physicsRef.current;
      p.dragging = false;
      p.targetStretch = 0;
      p.targetTipX = 0;
      setIsDragging(false);

      if (quickTap) {
        p.stretch = Math.max(p.stretch, 17);
        p.stretchVel = -165;
        const side = Math.random() > 0.5 ? 1 : -1;
        p.tipXVel += side * 95;
        p.midLagVel -= side * 120;
        p.curlVel += side * 3.8;
        p.rippleAmp = Math.max(p.rippleAmp, 4.8);
        p.ripplePhase = 0;
      } else {
        const releaseTension = Math.max(
          0.18,
          Math.min(1, p.stretch / maxStretch)
        );
        const clampedFling = Math.max(-220, Math.min(220, flingVelX * 0.45));
        p.stretchVel -= releaseTension * 240;
        p.tipXVel += clampedFling;
        p.midLagVel +=
          -p.tipX * 8.5 +
          (p.tipX >= 0 ? 1 : -1) * releaseTension * 75 -
          clampedFling * 0.55;
        p.curlVel += (p.tipX >= 0 ? -1 : 1) * releaseTension * 5.2;
        p.rippleAmp = Math.max(
          p.rippleAmp,
          2.5 +
            releaseTension * 8.5 +
            Math.min(3.5, Math.abs(clampedFling) * 0.02)
        );
        p.ripplePhase = 0;
      }

      ensureAnimationLoop();
    },
    [ensureAnimationLoop, maxStretch]
  );

  useEffect(() => {
    const onBlur = () => {
      if (dragMetaRef.current.pointerId !== null) {
        dragMetaRef.current.pointerId = null;
        releaseRibbon(false);
      }
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [releaseRibbon]);

  const handlePointerEnter = useCallback(
    (e: React.PointerEvent<SVGPathElement>) => {
      if (prefersReducedMotion()) return;
      const p = physicsRef.current;
      if (p.dragging) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = e.clientX - (rect.left + rect.width / 2);
      const kickDir = relX >= 0 ? -1 : 1;
      p.tipXVel += kickDir * 58;
      p.midLagVel -= kickDir * 72;
      p.rippleAmp = Math.max(p.rippleAmp, 2.2);
      ensureAnimationLoop();
    },
    [ensureAnimationLoop]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGPathElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const p = physicsRef.current;
      p.dragging = true;
      p.targetStretch = p.stretch;
      p.targetTipX = p.tipX;

      dragMetaRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        lastClientX: e.clientX,
        lastTimeMs: performance.now(),
        flingVelX: 0,
        hasMoved: false,
      };
      setIsDragging(true);

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic events
      }

      ensureAnimationLoop();
    },
    [ensureAnimationLoop]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGPathElement>) => {
      const meta = dragMetaRef.current;
      const p = physicsRef.current;
      if (!p.dragging || meta.pointerId !== e.pointerId) return;

      const dx = e.clientX - meta.startClientX;
      const dy = e.clientY - meta.startClientY;
      if (Math.hypot(dx, dy) > BOOKMARK_RIBBON_CONFIG.DRAG_MOVE_THRESHOLD_PX) {
        meta.hasMoved = true;
      }

      p.targetStretch = computeRibbonRubberStretch(dy, maxStretch);
      p.targetTipX = computeRibbonLateralTip(dx);

      const nowMs = performance.now();
      const dtSec = Math.max(0.008, (nowMs - meta.lastTimeMs) / 1000);
      const instantVx = (e.clientX - meta.lastClientX) / dtSec;
      meta.flingVelX = meta.flingVelX * 0.45 + instantVx * 0.55;
      meta.lastClientX = e.clientX;
      meta.lastTimeMs = nowMs;
      ensureAnimationLoop();
    },
    [ensureAnimationLoop, maxStretch]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGPathElement>) => {
      const meta = dragMetaRef.current;
      if (meta.pointerId !== e.pointerId) return;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore release errors
      }
      meta.pointerId = null;
      const isFreshFling =
        performance.now() - meta.lastTimeMs <
        BOOKMARK_RIBBON_CONFIG.FRESH_FLING_WINDOW_MS;
      releaseRibbon(!meta.hasMoved, isFreshFling ? meta.flingVelX : 0);
    },
    [releaseRibbon]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        releaseRibbon(true);
      }
    },
    [releaseRibbon]
  );

  return {
    isDragging,
    refs: {
      ribbonPathRef,
      weavePathRef,
      sheenPathRef,
      edgeHighlightRef,
      shadowPathRef,
      creasePathRef,
      hitPathRef,
    },
    handlers: {
      handlePointerEnter,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handleKeyDown,
    },
  };
}
