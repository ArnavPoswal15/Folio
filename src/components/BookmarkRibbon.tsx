import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

interface BookmarkRibbonProps {
  isMobile: boolean;
  /** Increment or change to trigger a gentle reactive sway when pages turn or book opens/closes */
  motionPulseKey?: string | number;
}

interface RibbonPhysics {
  stretch: number;
  stretchVel: number;
  tipX: number;
  tipXVel: number;
  midLag: number;
  midLagVel: number;
  curl: number;
  curlVel: number;
  rippleAmp: number;
  ripplePhase: number;
  targetStretch: number;
  targetTipX: number;
  dragging: boolean;
}

interface RibbonPaths {
  ribbonPath: string;
  shadowPath: string;
  centerlinePath: string;
  edgeHighlightPath: string;
  sheenOpacity: number;
  edgeHighlightOpacity: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlurOpacity: number;
  creaseOpacity: number;
  tension: number;
}

const SAMPLES = 14;
const BASE_SHAFT_LEN = 26; // Includes 6px tucked under book pages/cover
const BASE_HALF_W = 8;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function buildRibbonPaths(
  state: RibbonPhysics,
  maxStretch: number,
  timeSec: number
): RibbonPaths {
  const tension = Math.max(0, Math.min(1, state.stretch / maxStretch));
  const totalLen = Math.max(14, BASE_SHAFT_LEN + state.stretch);

  // Subtle resting silk drape when slack; pulls straight as tension builds
  const restDrapeX = 1.6 * (1 - tension);
  const restMidBend = -1.1 * (1 - tension);
  const effectiveTipX = state.tipX + restDrapeX;
  const effectiveMid = state.midLag + restMidBend;

  // High-tension fabric micro-hum when pulled near limit
  const tremorAmp =
    state.dragging && tension > 0.78
      ? Math.sin(timeSec * 52) * (tension - 0.78) * 3.6
      : 0;

  const cx: number[] = new Array(SAMPLES);
  const cy: number[] = new Array(SAMPLES);
  const hw: number[] = new Array(SAMPLES);

  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    // Smoothstep at anchor (t=0) so the ribbon wraps smoothly out from under the book edge
    const swingWeight = Math.pow(t, 1.48);
    const bellyWeight = Math.sin(t * Math.PI);
    const ripple =
      state.rippleAmp * Math.sin(t * 6.4 - state.ripplePhase) * Math.pow(t, 0.85);

    const x =
      effectiveTipX * swingWeight +
      effectiveMid * bellyWeight * (1 - 0.35 * tension) +
      ripple +
      tremorAmp * bellyWeight;

    // Slight geometric foreshortening when ribbon arcs sideways
    const foreshorten = (x * x) / Math.max(40, totalLen * 3.6);
    const y = -6 + totalLen * t - foreshorten * t;

    // Poisson fabric narrowing under stretch, slight squash widening on rebound
    const stretchFactor =
      state.stretch >= 0
        ? 1 - tension * 0.21 * (0.45 + 0.55 * bellyWeight)
        : 1 + Math.min(0.14, (-state.stretch / 14) * 0.12) * bellyWeight;

    cx[i] = x;
    cy[i] = y;
    hw[i] = BASE_HALF_W * Math.max(0.76, stretchFactor);
  }

  const leftX: number[] = new Array(SAMPLES);
  const leftY: number[] = new Array(SAMPLES);
  const rightX: number[] = new Array(SAMPLES);
  const rightY: number[] = new Array(SAMPLES);

  let lastTx = 0;
  let lastTy = 1;
  let lastNx = 1;
  let lastNy = 0;

  for (let i = 0; i < SAMPLES; i++) {
    const prev = Math.max(0, i - 1);
    const next = Math.min(SAMPLES - 1, i + 1);
    let tx = cx[next] - cx[prev];
    let ty = cy[next] - cy[prev];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;

    // Force top edge (i === 0) strictly horizontal where it wraps from the book binding
    if (i === 0) {
      tx = 0;
      ty = 1;
    }

    // Normal pointing to the ribbon's right edge
    const nx = ty;
    const ny = -tx;

    leftX[i] = cx[i] - nx * hw[i];
    leftY[i] = cy[i] - ny * hw[i];
    rightX[i] = cx[i] + nx * hw[i];
    rightY[i] = cy[i] + ny * hw[i];

    if (i === SAMPLES - 1) {
      lastTx = tx;
      lastTy = ty;
      lastNx = nx;
      lastNy = ny;
    }
  }

  // Swallowtail notch at the bottom tip aligned to tip tangent + subtle curl whip
  const lastIdx = SAMPLES - 1;
  const tipLenScale =
    state.stretch >= 0
      ? 1 + tension * 0.12
      : Math.max(0.84, 1 + state.stretch * 0.012);
  const tailDepth = 12 * tipLenScale;
  const notchDepth = 7.4 * tipLenScale;
  const tipCurlOffset = state.curl * 6.5;

  const endHw = hw[lastIdx];
  const tipBaseX = cx[lastIdx];
  const tipBaseY = cy[lastIdx];

  const leftTipX =
    tipBaseX + lastTx * tailDepth - lastNx * endHw + lastNx * tipCurlOffset;
  const leftTipY =
    tipBaseY + lastTy * tailDepth - lastNy * endHw + lastNy * tipCurlOffset;

  const notchX =
    tipBaseX + lastTx * notchDepth + lastNx * tipCurlOffset * 0.55;
  const notchY =
    tipBaseY + lastTy * notchDepth + lastNy * tipCurlOffset * 0.55;

  const rightTipX =
    tipBaseX + lastTx * tailDepth + lastNx * endHw + lastNx * tipCurlOffset;
  const rightTipY =
    tipBaseY + lastTy * tailDepth + lastNy * endHw + lastNy * tipCurlOffset;

  // Build smooth closed ribbon path
  const parts: string[] = [
    `M ${leftX[0].toFixed(2)} ${leftY[0].toFixed(2)}`,
  ];
  for (let i = 1; i < SAMPLES; i++) {
    parts.push(`L ${leftX[i].toFixed(2)} ${leftY[i].toFixed(2)}`);
  }
  parts.push(
    `L ${leftTipX.toFixed(2)} ${leftTipY.toFixed(2)}`,
    `L ${notchX.toFixed(2)} ${notchY.toFixed(2)}`,
    `L ${rightTipX.toFixed(2)} ${rightTipY.toFixed(2)}`
  );
  for (let i = SAMPLES - 1; i >= 0; i--) {
    parts.push(`L ${rightX[i].toFixed(2)} ${rightY[i].toFixed(2)}`);
  }
  parts.push('Z');

  const ribbonPath = parts.join(' ');

  // Centerline hit path (starts at y=2 just below book cloth edge to tip)
  const hitParts: string[] = [`M ${cx[1].toFixed(2)} ${Math.max(1, cy[1]).toFixed(2)}`];
  for (let i = 2; i < SAMPLES; i++) {
    hitParts.push(`L ${cx[i].toFixed(2)} ${cy[i].toFixed(2)}`);
  }
  hitParts.push(
    `L ${(tipBaseX + lastTx * (tailDepth * 0.85)).toFixed(2)} ${(
      tipBaseY +
      lastTy * (tailDepth * 0.85)
    ).toFixed(2)}`
  );

  // Dynamic convex-edge highlight so light rolls across the ribbon as it waves/wraps
  const highlightOnLeft = effectiveTipX + effectiveMid >= 0;
  const edgeT = highlightOnLeft ? 0.09 : 0.91;
  const edgeHighlightParts: string[] = [
    `M ${(leftX[0] + (rightX[0] - leftX[0]) * edgeT).toFixed(2)} ${(
      leftY[0] +
      (rightY[0] - leftY[0]) * edgeT
    ).toFixed(2)}`,
  ];
  for (let i = 1; i < SAMPLES; i++) {
    const ex = leftX[i] + (rightX[i] - leftX[i]) * edgeT;
    const ey = leftY[i] + (rightY[i] - leftY[i]) * edgeT;
    edgeHighlightParts.push(`L ${ex.toFixed(2)} ${ey.toFixed(2)}`);
  }

  return {
    ribbonPath,
    shadowPath: ribbonPath,
    centerlinePath: hitParts.join(' '),
    edgeHighlightPath: edgeHighlightParts.join(' '),
    sheenOpacity: Math.min(0.45, tension * 0.4 + Math.min(0.14, state.rippleAmp * 0.015)),
    edgeHighlightOpacity: Math.min(
      0.34,
      0.12 + tension * 0.14 + Math.min(0.12, Math.abs(state.midLag) * 0.01 + state.rippleAmp * 0.01)
    ),
    shadowOffsetX: 2.2 + state.tipX * 0.06 + tension * 1.6,
    shadowOffsetY: 4.5 + tension * 4.5,
    shadowBlurOpacity: 0.34 - tension * 0.08,
    creaseOpacity: 0.4 + tension * 0.32,
    tension,
  };
}

export const BookmarkRibbon: React.FC<BookmarkRibbonProps> = ({
  isMobile,
  motionPulseKey,
}) => {
  const uid = useId().replace(/:/g, '');
  const maxStretch = isMobile ? 56 : 76;

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

  const dragMetaRef = useRef<{
    pointerId: number | null;
    startClientX: number;
    startClientY: number;
    lastClientX: number;
    lastTimeMs: number;
    flingVelX: number;
    hasMoved: boolean;
  }>({
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
        edgeHighlightRef.current.style.opacity = geo.edgeHighlightOpacity.toFixed(3);
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
      const dt = Math.min(0.032, Math.max(0.004, (nowMs - lastFrameMsRef.current) / 1000));
      lastFrameMsRef.current = nowMs;
      const p = physicsRef.current;

      if (prefersReducedMotion()) {
        p.stretch += (p.targetStretch - p.stretch) * Math.min(1, dt * 18);
        p.tipX += (p.targetTipX - p.tipX) * Math.min(1, dt * 18);
        p.midLag *= Math.exp(-16 * dt);
        p.curl *= Math.exp(-16 * dt);
        p.rippleAmp = 0;
      } else if (p.dragging) {
        // Stiff responsive tracking while held, slight bend lag in mid-body
        const pullK = 420;
        const pullC = 28;
        const sAcc = (p.targetStretch - p.stretch) * pullK - p.stretchVel * pullC;
        p.stretchVel += sAcc * dt;
        p.stretch += p.stretchVel * dt;

        const xAcc = (p.targetTipX - p.tipX) * 300 - p.tipXVel * 24;
        p.tipXVel += xAcc * dt;
        p.tipX += p.tipXVel * dt;

        // Middle of ribbon arcs outward as it wraps around the book edge toward your hand
        const desiredMid = -p.tipX * 0.24 - p.tipXVel * 0.018;
        const mAcc = (desiredMid - p.midLag) * 220 - p.midLagVel * 20;
        p.midLagVel += mAcc * dt;
        p.midLag += p.midLagVel * dt;

        const desiredCurl = -p.tipX * 0.012;
        const cAcc = (desiredCurl - p.curl) * 180 - p.curlVel * 18;
        p.curlVel += cAcc * dt;
        p.curl += p.curlVel * dt;

        p.rippleAmp *= Math.exp(-7 * dt);
        p.ripplePhase += dt * 14;
      } else {
        // Underdamped "toing!" elastic rebound + fabric whip wave
        const stretchAcc = -335 * p.stretch - 8.2 * p.stretchVel;
        p.stretchVel += stretchAcc * dt;
        p.stretch += p.stretchVel * dt;

        const tipAcc = -155 * p.tipX - 5.4 * p.tipXVel;
        p.tipXVel += tipAcc * dt;
        p.tipX += p.tipXVel * dt;

        // Coupled mid-body S-curve whip driven by tip velocity
        const midAcc = -240 * p.midLag - 6.8 * p.midLagVel - p.tipXVel * 1.4;
        p.midLagVel += midAcc * dt;
        p.midLag += p.midLagVel * dt;

        const curlAcc = -210 * p.curl - 6.2 * p.curlVel + p.midLagVel * 0.05;
        p.curlVel += curlAcc * dt;
        p.curl += p.curlVel * dt;

        // Traveling silk wave down the ribbon
        p.ripplePhase += dt * 23;
        p.rippleAmp *= Math.exp(-3.1 * dt);
      }

      paintRibbon(nowMs);

      const isSettled =
        !p.dragging &&
        Math.abs(p.stretch) < 0.04 &&
        Math.abs(p.stretchVel) < 0.2 &&
        Math.abs(p.tipX) < 0.04 &&
        Math.abs(p.tipXVel) < 0.2 &&
        Math.abs(p.midLag) < 0.04 &&
        Math.abs(p.midLagVel) < 0.2 &&
        Math.abs(p.curl) < 0.01 &&
        p.rippleAmp < 0.04;

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

  // Initial paint + cleanup
  useEffect(() => {
    paintRibbon(performance.now());
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [paintRibbon]);

  // Gentle follow-through breeze whenever book opens/closes or a page turns
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
        // Playful tap flick -> snappy "toing!" ripple
        p.stretch = Math.max(p.stretch, 17);
        p.stretchVel = -165;
        const side = Math.random() > 0.5 ? 1 : -1;
        p.tipXVel += side * 95;
        p.midLagVel -= side * 120;
        p.curlVel += side * 3.8;
        p.rippleAmp = Math.max(p.rippleAmp, 4.8);
        p.ripplePhase = 0;
      } else {
        const releaseTension = Math.max(0.18, Math.min(1, p.stretch / maxStretch));
        const clampedFling = Math.max(-220, Math.min(220, flingVelX * 0.45));
        // Whip wave + underdamped snap proportional to stretch & release flick
        p.stretchVel -= releaseTension * 240;
        p.tipXVel += clampedFling;
        p.midLagVel +=
          -p.tipX * 8.5 +
          (p.tipX >= 0 ? 1 : -1) * releaseTension * 75 -
          clampedFling * 0.55;
        p.curlVel += (p.tipX >= 0 ? -1 : 1) * releaseTension * 5.2;
        p.rippleAmp = Math.max(
          p.rippleAmp,
          2.5 + releaseTension * 8.5 + Math.min(3.5, Math.abs(clampedFling) * 0.02)
        );
        p.ripplePhase = 0;
      }

      ensureAnimationLoop();
    },
    [ensureAnimationLoop, maxStretch]
  );

  // Release cleanly on window blur
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

  const handlePointerEnter = (e: React.PointerEvent<SVGPathElement>) => {
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
  };

  const handlePointerDown = (e: React.PointerEvent<SVGPathElement>) => {
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
  };

  const handlePointerMove = (e: React.PointerEvent<SVGPathElement>) => {
    const meta = dragMetaRef.current;
    const p = physicsRef.current;
    if (!p.dragging || meta.pointerId !== e.pointerId) return;

    const dx = e.clientX - meta.startClientX;
    const dy = e.clientY - meta.startClientY;
    if (Math.hypot(dx, dy) > 4) {
      meta.hasMoved = true;
    }

    // Nonlinear resistance: resistance climbs steadily as you stretch further down
    p.targetStretch =
      dy >= 0
        ? maxStretch * (1 - Math.exp(-dy / 84))
        : Math.max(-4, dy * 0.2);

    // Ribbon wraps out smoothly toward lateral drag with realistic damping
    p.targetTipX = 44 * Math.tanh(dx / 85);

    const nowMs = performance.now();
    const dtSec = Math.max(0.008, (nowMs - meta.lastTimeMs) / 1000);
    const instantVx = (e.clientX - meta.lastClientX) / dtSec;
    meta.flingVelX = meta.flingVelX * 0.45 + instantVx * 0.55;
    meta.lastClientX = e.clientX;
    meta.lastTimeMs = nowMs;
    ensureAnimationLoop();
  };

  const handlePointerUp = (e: React.PointerEvent<SVGPathElement>) => {
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
    const isFreshFling = performance.now() - meta.lastTimeMs < 90;
    releaseRibbon(!meta.hasMoved, isFreshFling ? meta.flingVelX : 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      releaseRibbon(true);
    }
  };

  const gradId = `ribbon-silk-${uid}`;
  const weaveId = `ribbon-weave-${uid}`;
  const sheenId = `ribbon-sheen-${uid}`;
  const creaseId = `ribbon-crease-${uid}`;
  const shadowFilterId = `ribbon-shadow-${uid}`;

  return (
    <button
      type="button"
      aria-label="Bookmark ribbon"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}
      className={`pointer-events-none absolute ${
        isMobile ? 'right-10' : 'right-14'
      } w-4 h-9 z-[1] appearance-none bg-transparent border-0 p-0 touch-none select-none overflow-visible focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#deb488] rounded-b`}
      style={{
        top: 'calc(100% - 2px)',
      }}
    >
      <svg
        width="180"
        height="176"
        viewBox="-90 -6 180 176"
        overflow="visible"
        className="pointer-events-none absolute -top-[6px] -left-[82px]"
      >
        <defs>
          {/* Woven burgundy silk gradient across ribbon width */}
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#58191d" />
            <stop offset="16%" stopColor="#752429" />
            <stop offset="50%" stopColor="#943339" />
            <stop offset="84%" stopColor="#712226" />
            <stop offset="100%" stopColor="#4c1417" />
          </linearGradient>

          {/* Subtle horizontal grosgrain weave ribs */}
          <pattern
            id={weaveId}
            width="6"
            height="3"
            patternUnits="userSpaceOnUse"
          >
            <rect width="6" height="1.5" fill="rgba(255, 224, 214, 0.055)" />
            <rect
              y="1.5"
              width="6"
              height="1.5"
              fill="rgba(22, 6, 8, 0.14)"
            />
          </pattern>

          {/* Dynamic taut silk sheen */}
          <linearGradient id={sheenId} x1="0%" y1="0%" x2="100%" y2="85%">
            <stop offset="0%" stopColor="rgba(255, 232, 226, 0)" />
            <stop offset="42%" stopColor="rgba(255, 234, 228, 0.42)" />
            <stop offset="65%" stopColor="rgba(255, 234, 228, 0.16)" />
            <stop offset="100%" stopColor="rgba(255, 232, 226, 0)" />
          </linearGradient>

          {/* Anchored shadow where ribbon wraps out from under the bottom book edge */}
          <linearGradient
            id={creaseId}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="-6"
            x2="0"
            y2="7"
          >
            <stop offset="0%" stopColor="rgba(16, 6, 7, 0.78)" />
            <stop offset="55%" stopColor="rgba(16, 6, 7, 0.28)" />
            <stop offset="100%" stopColor="rgba(16, 6, 7, 0)" />
          </linearGradient>

          <filter
            id={shadowFilterId}
            x="-40%"
            y="-15%"
            width="180%"
            height="150%"
          >
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>

        {/* Soft desk cast shadow tracking the ribbon's curve */}
        <path
          ref={shadowPathRef}
          fill="rgba(16, 10, 7, 0.55)"
          filter={`url(#${shadowFilterId})`}
          style={{ opacity: 0.34 }}
        />

        {/* Base woven burgundy silk ribbon */}
        <path
          ref={ribbonPathRef}
          fill={`url(#${gradId})`}
          stroke="rgba(255, 224, 214, 0.14)"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />

        {/* Fine grosgrain rib texture */}
        <path ref={weavePathRef} fill={`url(#${weaveId})`} />

        {/* Taut silk specular sheen */}
        <path
          ref={sheenPathRef}
          fill={`url(#${sheenId})`}
          style={{ opacity: 0 }}
        />

        {/* Curved silk edge highlight */}
        <path
          ref={edgeHighlightRef}
          fill="none"
          stroke="rgba(255, 230, 224, 0.42)"
          strokeWidth="1.05"
          strokeLinecap="round"
          style={{ opacity: 0.14 }}
        />

        {/* Book-edge wrap crease shading */}
        <path
          ref={creasePathRef}
          fill={`url(#${creaseId})`}
          style={{ opacity: 0.4 }}
        />

        {/* Generous curved hit target strictly along the hanging ribbon */}
        <path
          ref={hitPathRef}
          fill="none"
          stroke="transparent"
          strokeWidth="34"
          strokeLinecap="round"
          onPointerEnter={handlePointerEnter}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`pointer-events-auto touch-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        />
      </svg>
    </button>
  );
};
