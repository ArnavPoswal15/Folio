import React, { useCallback, useEffect, useRef } from 'react';
import {
  InkDrawToolType,
  InkPaletteId,
  InkToolType,
  InkWidthPreset,
} from '../types/journal';
import {
  createInkStrokeId,
  hitTestStrokeEraser,
  INK_GRID_MAX,
  InkPoint,
  InkStroke,
  parseInkStrokes,
  renderInkStrokes,
  serializeInkStrokes,
  simplifyInkPoints,
} from '../utils/inkStrokes';

export interface InkToolConfig {
  tool: InkToolType;
  color: InkPaletteId;
  width: InkWidthPreset;
  drawArmed: boolean;
  allowTouchDraw: boolean;
}

interface InkCanvasLayerProps {
  serializedInk: string;
  interactive: boolean;
  locked?: boolean;
  isDark: boolean;
  inkConfig: InkToolConfig;
  onCommitInk?: (nextSerialized: string) => void;
  onPenActivity?: () => void;
  onStylusActive?: () => void;
  onCapacityWarning?: (message: string) => void;
  children: React.ReactNode;
}

export const InkCanvasLayer: React.FC<InkCanvasLayerProps> = ({
  serializedInk,
  interactive,
  locked = false,
  isDark,
  inkConfig,
  onCommitInk,
  onPenActivity,
  onStylusActive,
  onCapacityWarning,
  children,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const eraserRingRef = useRef<HTMLDivElement | null>(null);

  const strokesRef = useRef<InkStroke[]>(parseInkStrokes(serializedInk));
  const activeStrokeRef = useRef<InkStroke | null>(null);
  const activePointerRef = useRef<{
    pointerId: number;
    pointerType: string;
    effectiveTool: InkToolType;
    lastNormX: number;
    lastNormY: number;
    lastClientX: number;
    lastClientY: number;
    lastTimeMs: number;
    smoothedVel: number;
    smoothedPressure: number;
    initialRawPressure: number;
    hasHardwarePressure: boolean;
    erasedAny: boolean;
  } | null>(null);

  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const rafRef = useRef<number | null>(null);
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  const inkConfigRef = useRef(inkConfig);
  inkConfigRef.current = inkConfig;

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const { w, h } = sizeRef.current;
    if (!canvas || w <= 0 || h <= 0) return;

    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const targetW = Math.max(1, Math.round(w * dpr));
    const targetH = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const list = activeStrokeRef.current
      ? [...strokesRef.current, activeStrokeRef.current]
      : strokesRef.current;
    renderInkStrokes(ctx, list, w, h, isDarkRef.current);
  }, []);

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      redrawCanvas();
    });
  }, [redrawCanvas]);

  // Sync external stroke changes (spread navigation, undo/redo, Firestore snapshot)
  useEffect(() => {
    if (!activePointerRef.current) {
      strokesRef.current = parseInkStrokes(serializedInk);
      scheduleRedraw();
    }
  }, [serializedInk, scheduleRedraw]);

  // Redraw when light/dark theme changes
  useEffect(() => {
    scheduleRedraw();
  }, [isDark, scheduleRedraw]);

  // Keep canvas crisp on container resize / DPR changes
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const syncSize = () => {
      const w = wrapper.clientWidth || wrapper.getBoundingClientRect().width;
      const h = wrapper.clientHeight || wrapper.getBoundingClientRect().height;
      sizeRef.current = { w, h };
      redrawCanvas();
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(wrapper);

    return () => {
      observer.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [redrawCanvas]);

  // Native non-passive touchstart on iPadOS Safari so Apple Pencil ('stylus')
  // never triggers Scribble/zoom/scroll while finger touches ('direct') still behave normally.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !interactive || locked) return;

    const handleNativeTouchStart = (e: TouchEvent) => {
      const cfg = inkConfigRef.current;
      let hasStylus = false;
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i] as Touch & { touchType?: string };
        if (touch.touchType === 'stylus') {
          hasStylus = true;
          break;
        }
      }
      if (hasStylus || (cfg.drawArmed && cfg.allowTouchDraw)) {
        e.preventDefault();
      }
    };

    wrapper.addEventListener('touchstart', handleNativeTouchStart, {
      passive: false,
    });
    return () => {
      wrapper.removeEventListener('touchstart', handleNativeTouchStart);
    };
  }, [interactive, locked]);

  const toNormalizedPoint = useCallback(
    (
      clientX: number,
      clientY: number,
      rawPressure: number,
      pointerType: string,
      overridePressure?: number
    ): InkPoint => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return [0, 0, 50];
      const rect = wrapper.getBoundingClientRect();
      const w = Math.max(1, wrapper.clientWidth || rect.width);
      const h = Math.max(1, wrapper.clientHeight || rect.height);
      const nx = Math.max(
        0,
        Math.min(INK_GRID_MAX, Math.round(((clientX - rect.left) / w) * INK_GRID_MAX))
      );
      const ny = Math.max(
        0,
        Math.min(INK_GRID_MAX, Math.round(((clientY - rect.top) / h) * INK_GRID_MAX))
      );
      const effectiveP =
        typeof overridePressure === 'number'
          ? Math.max(8, Math.min(100, Math.round(overridePressure)))
          : pointerType === 'pen' && rawPressure > 0
            ? Math.max(8, Math.min(100, Math.round(rawPressure * 100)))
            : 55;
      return [nx, ny, effectiveP];
    },
    []
  );

  const updateEraserRing = useCallback(
    (clientX: number, clientY: number, visible: boolean) => {
      const ring = eraserRingRef.current;
      const wrapper = wrapperRef.current;
      if (!ring || !wrapper) return;
      if (!visible) {
        ring.style.opacity = '0';
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      ring.style.transform = `translate(${x - 10}px, ${y - 10}px)`;
      ring.style.opacity = '1';
    },
    []
  );

  const handlePointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || locked) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const cfg = inkConfigRef.current;
    const isStylus = e.pointerType === 'pen';
    const shouldDraw =
      isStylus ||
      (e.pointerType === 'mouse' && cfg.drawArmed) ||
      (e.pointerType === 'touch' && cfg.drawArmed && cfg.allowTouchDraw);

    if (!shouldDraw) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (isStylus) {
      onPenActivity?.();
    }
    onStylusActive?.();

    const isBarrelEraser = isStylus && (e.buttons === 32 || e.button === 5);
    const effectiveTool: InkToolType = isBarrelEraser ? 'eraser' : cfg.tool;

    const initialHasHw =
      isStylus && e.pressure > 0 && Math.abs(e.pressure - 0.5) > 0.015;
    const initialFountainP = initialHasHw
      ? Math.max(8, Math.min(100, e.pressure * 100))
      : 46;

    const pt = toNormalizedPoint(
      e.clientX,
      e.clientY,
      e.pressure,
      e.pointerType,
      effectiveTool === 'fountain' ? initialFountainP : undefined
    );

    activePointerRef.current = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      effectiveTool,
      lastNormX: pt[0],
      lastNormY: pt[1],
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      lastTimeMs: e.timeStamp || performance.now(),
      smoothedVel: 0.35,
      smoothedPressure: pt[2],
      initialRawPressure: e.pressure,
      hasHardwarePressure: initialHasHw,
      erasedAny: false,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events
    }

    if (effectiveTool === 'eraser') {
      updateEraserRing(e.clientX, e.clientY, true);
      const beforeLen = strokesRef.current.length;
      const remaining = strokesRef.current.filter(
        (s) => !hitTestStrokeEraser(s, pt[0], pt[1], pt[0], pt[1], 190)
      );
      if (remaining.length !== beforeLen) {
        strokesRef.current = remaining;
        activePointerRef.current.erasedAny = true;
        scheduleRedraw();
      }
      return;
    }

    const drawTool: InkDrawToolType = effectiveTool;
    activeStrokeRef.current = {
      id: createInkStrokeId(),
      tool: drawTool,
      color: cfg.color,
      width: cfg.width,
      points: [pt],
    };
    scheduleRedraw();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = activePointerRef.current;

    if (!active) {
      const cfg = inkConfigRef.current;
      const isHoverEraser =
        interactive &&
        !locked &&
        cfg.tool === 'eraser' &&
        (e.pointerType === 'pen' || (e.pointerType === 'mouse' && cfg.drawArmed));
      if (isHoverEraser) {
        updateEraserRing(e.clientX, e.clientY, true);
      }
      return;
    }

    if (active.pointerId !== e.pointerId) return;

    if (active.pointerType === 'pen') {
      onPenActivity?.();
    }

    const nativeEvent = e.nativeEvent;
    const coalesced =
      typeof nativeEvent.getCoalescedEvents === 'function'
        ? nativeEvent.getCoalescedEvents()
        : [nativeEvent];
    const events = coalesced.length > 0 ? coalesced : [nativeEvent];

    if (active.effectiveTool === 'eraser') {
      updateEraserRing(e.clientX, e.clientY, true);
      let erasedThisFrame = false;
      for (const ev of events) {
        const pt = toNormalizedPoint(
          ev.clientX,
          ev.clientY,
          ev.pressure,
          active.pointerType
        );
        const beforeLen = strokesRef.current.length;
        const remaining = strokesRef.current.filter(
          (s) =>
            !hitTestStrokeEraser(
              s,
              active.lastNormX,
              active.lastNormY,
              pt[0],
              pt[1],
              190
            )
        );
        active.lastNormX = pt[0];
        active.lastNormY = pt[1];
        if (remaining.length !== beforeLen) {
          strokesRef.current = remaining;
          active.erasedAny = true;
          erasedThisFrame = true;
        }
      }
      if (erasedThisFrame) {
        scheduleRedraw();
      }
      return;
    }

    const stroke = activeStrokeRef.current;
    if (!stroke) return;

    let added = false;
    for (const ev of events) {
      let overridePressure: number | undefined;

      if (stroke.tool === 'fountain') {
        const nowMs = ev.timeStamp || performance.now();
        const distPx = Math.hypot(
          ev.clientX - active.lastClientX,
          ev.clientY - active.lastClientY
        );

        if (distPx >= 0.45) {
          const dt = Math.max(4, Math.min(80, nowMs - active.lastTimeMs));
          const instVel = distPx / dt; // px/ms
          active.smoothedVel = active.smoothedVel * 0.65 + instVel * 0.35;
          active.lastClientX = ev.clientX;
          active.lastClientY = ev.clientY;
          active.lastTimeMs = nowMs;

          if (
            active.pointerType === 'pen' &&
            ev.pressure > 0 &&
            Math.abs(ev.pressure - active.initialRawPressure) > 0.02
          ) {
            active.hasHardwarePressure = true;
          }

          // Inverse speed-to-pressure curve: slow = broad swell (92), fast flick = hairline (14)
          const speedNorm = Math.max(
            0,
            Math.min(1, (active.smoothedVel - 0.1) / 1.35)
          );
          const velocityPressure = 14 + 78 * Math.pow(1 - speedNorm, 1.35);

          const targetPressure = active.hasHardwarePressure
            ? Math.max(8, Math.min(100, ev.pressure * 100)) * 0.78 +
              velocityPressure * 0.22
            : velocityPressure;

          active.smoothedPressure =
            active.smoothedPressure * 0.5 + targetPressure * 0.5;
        }

        overridePressure = active.smoothedPressure;
      }

      const pt = toNormalizedPoint(
        ev.clientX,
        ev.clientY,
        ev.pressure,
        active.pointerType,
        overridePressure
      );
      const last = stroke.points[stroke.points.length - 1];
      const minStep = stroke.tool === 'fountain' ? 12 : 8;
      if (!last || Math.hypot(pt[0] - last[0], pt[1] - last[1]) >= minStep) {
        stroke.points.push(pt);
        added = true;
      }
    }
    if (added) {
      scheduleRedraw();
    }
  };

  const finishActivePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = activePointerRef.current;
    if (!active || active.pointerId !== e.pointerId) return;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }

    updateEraserRing(e.clientX, e.clientY, false);

    if (active.effectiveTool === 'eraser') {
      const changed = active.erasedAny;
      activePointerRef.current = null;
      if (changed) {
        const { encoded } = serializeInkStrokes(strokesRef.current);
        onCommitInk?.(encoded);
      }
      return;
    }

    const finished = activeStrokeRef.current;
    const endVel = active.smoothedVel;
    activeStrokeRef.current = null;
    activePointerRef.current = null;

    if (!finished || finished.points.length === 0) {
      redrawCanvas();
      return;
    }

    // Add subtle hairline nib-lift taper on brisk release strokes
    if (
      finished.tool === 'fountain' &&
      finished.points.length >= 3 &&
      endVel > 0.65
    ) {
      const lastIdx = finished.points.length - 1;
      const lastPt = finished.points[lastIdx];
      finished.points[lastIdx] = [
        lastPt[0],
        lastPt[1],
        Math.max(10, Math.round(lastPt[2] * 0.68)),
      ];
    }

    const simplifiedStroke: InkStroke = {
      ...finished,
      points: simplifyInkPoints(
        finished.points,
        finished.tool === 'fountain'
      ),
    };

    const nextStrokes = [...strokesRef.current, simplifiedStroke];
    const { encoded, atCapacity } = serializeInkStrokes(nextStrokes);
    strokesRef.current = parseInkStrokes(encoded);
    redrawCanvas();

    if (atCapacity) {
      onCapacityWarning?.('Page ink limit reached — oldest stroke trimmed to fit sync quota.');
    }
    onCommitInk?.(encoded);
  };

  const cursorClass =
    interactive && !locked && inkConfig.drawArmed
      ? inkConfig.tool === 'eraser'
        ? 'cursor-none'
        : 'cursor-crosshair'
      : '';

  const touchActionStyle: React.CSSProperties['touchAction'] =
    interactive && !locked && inkConfig.drawArmed && inkConfig.allowTouchDraw
      ? 'none'
      : 'pan-y';

  return (
    <div
      ref={wrapperRef}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMove={handlePointerMove}
      onPointerUp={finishActivePointer}
      onPointerCancel={finishActivePointer}
      onPointerLeave={() => updateEraserRing(0, 0, false)}
      className={`relative w-full h-full ${cursorClass}`}
      style={{ touchAction: touchActionStyle }}
    >
      {children}

      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 w-full h-full z-10 select-none ${
          inkConfig.drawArmed ? 'opacity-100' : ''
        }`}
      />

      {interactive ? (
        <div
          ref={eraserRingRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 z-20 w-5 h-5 rounded-full border border-[#57361e]/80 dark:border-[#deb488]/85 bg-[#faf6ed]/35 dark:bg-[#1d1a17]/35 opacity-0 transition-opacity duration-75"
        />
      ) : null}
    </div>
  );
};
