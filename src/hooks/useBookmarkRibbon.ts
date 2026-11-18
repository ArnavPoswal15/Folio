import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BOOKMARK_RIBBON_CONFIG } from '../constants/bookmark';
import { RibbonSimState } from '../types/bookmark';
import {
  buildRibbonPath,
  ribbonInverse,
  ribbonRubber,
} from '../utils/bookmarkRibbon';
import { prefersReducedMotion } from '../utils/viewport';

const cfg = BOOKMARK_RIBBON_CONFIG;

const createInitialSim = (): RibbonSimState => ({
  pull: 0,
  vel: 0,
  dragSway: 0,
  dragSwayVel: 0,
  rafId: null,
  lastTime: 0,
  pointerId: null,
  startClientX: 0,
  startClientY: 0,
  hasMoved: false,
});

/**
 * Damped spring bookmark ribbon (master inline physics): rubber pull + lively release bounce.
 */
export function useBookmarkRibbon() {
  const ribbonPathRef = useRef<SVGPathElement | null>(null);
  const ribbonSheenPathRef = useRef<SVGPathElement | null>(null);
  const simRef = useRef<RibbonSimState>(createInitialSim());
  const [isTugging, setIsTugging] = useState(false);

  const renderRibbon = useCallback(() => {
    const sim = simRef.current;
    const speedSway = Math.max(-12, Math.min(12, sim.vel * 0.025));
    const sway = Math.max(-16, Math.min(16, sim.dragSway + speedSway));
    const { d, sheenOpacity } = buildRibbonPath(sim.pull, sway);

    ribbonPathRef.current?.setAttribute('d', d);
    if (ribbonSheenPathRef.current) {
      ribbonSheenPathRef.current.setAttribute('d', d);
      ribbonSheenPathRef.current.style.opacity = sheenOpacity.toFixed(3);
    }
  }, []);

  const stopRibbonSpring = useCallback(() => {
    const sim = simRef.current;
    if (sim.rafId !== null) {
      cancelAnimationFrame(sim.rafId);
      sim.rafId = null;
    }
  }, []);

  const releaseRibbonSpring = useCallback(
    (initialVel = 0) => {
      stopRibbonSpring();
      const sim = simRef.current;

      if (prefersReducedMotion()) {
        sim.pull = 0;
        sim.vel = 0;
        sim.dragSway = 0;
        sim.dragSwayVel = 0;
        renderRibbon();
        return;
      }

      sim.vel = initialVel;
      sim.dragSwayVel = 0;
      sim.lastTime = performance.now();

      const step = (now: number) => {
        const dt = Math.min(0.032, (now - sim.lastTime) / 1000);
        sim.lastTime = now;

        const c = 2 * cfg.ZETA * Math.sqrt(cfg.K);
        const accel = -cfg.K * sim.pull - c * sim.vel;
        sim.vel += accel * dt;
        sim.pull += sim.vel * dt;

        const swayAccel =
          -cfg.K * 0.85 * sim.dragSway - c * 1.15 * sim.dragSwayVel;
        sim.dragSwayVel += swayAccel * dt;
        sim.dragSway += sim.dragSwayVel * dt;

        if (
          Math.abs(sim.pull) < 0.1 &&
          Math.abs(sim.vel) < 1 &&
          Math.abs(sim.dragSway) < 0.1 &&
          Math.abs(sim.dragSwayVel) < 1
        ) {
          sim.pull = 0;
          sim.vel = 0;
          sim.dragSway = 0;
          sim.dragSwayVel = 0;
          sim.rafId = null;
          renderRibbon();
          return;
        }

        renderRibbon();
        sim.rafId = requestAnimationFrame(step);
      };

      sim.rafId = requestAnimationFrame(step);
    },
    [renderRibbon, stopRibbonSpring]
  );

  useEffect(() => {
    renderRibbon();
    return () => stopRibbonSpring();
  }, [renderRibbon, stopRibbonSpring]);

  useEffect(() => {
    const onBlur = () => {
      const sim = simRef.current;
      if (sim.pointerId !== null) {
        sim.pointerId = null;
        setIsTugging(false);
        releaseRibbonSpring(0);
      }
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [releaseRibbonSpring]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      stopRibbonSpring();

      const sim = simRef.current;
      sim.pointerId = e.pointerId;
      sim.startClientY = e.clientY - ribbonInverse(sim.pull);
      sim.startClientX =
        e.clientX -
        cfg.SWAY_MAX *
          Math.atanh(
            Math.max(-0.99, Math.min(0.99, sim.dragSway / cfg.SWAY_MAX))
          );
      sim.vel = 0;
      sim.dragSwayVel = 0;
      sim.hasMoved = false;
      setIsTugging(true);

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic events
      }
    },
    [stopRibbonSpring]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const sim = simRef.current;
      if (sim.pointerId !== e.pointerId) return;

      const dx = e.clientX - sim.startClientX;
      const dy = e.clientY - sim.startClientY;
      if (Math.hypot(dx, dy) > cfg.DRAG_MOVE_THRESHOLD_PX) {
        sim.hasMoved = true;
      }

      sim.pull = ribbonRubber(dy);
      sim.dragSway =
        cfg.SWAY_MAX * Math.tanh(dx / cfg.SWAY_INPUT_SCALE);
      sim.vel = 0;
      renderRibbon();
    },
    [renderRibbon]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const sim = simRef.current;
      if (sim.pointerId !== e.pointerId) return;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore release errors
      }
      sim.pointerId = null;
      setIsTugging(false);

      if (!sim.hasMoved && Math.abs(sim.pull) < 2) {
        sim.pull = cfg.TAP_PULL;
        renderRibbon();
        releaseRibbonSpring(0);
        return;
      }

      releaseRibbonSpring(0);
    },
    [releaseRibbonSpring, renderRibbon]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        stopRibbonSpring();
        simRef.current.pull = cfg.KEY_PULL;
        renderRibbon();
        releaseRibbonSpring(0);
      }
    },
    [releaseRibbonSpring, renderRibbon, stopRibbonSpring]
  );

  return {
    isTugging,
    ribbonPathRef,
    ribbonSheenPathRef,
    handlers: {
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handleKeyDown,
    },
  };
}