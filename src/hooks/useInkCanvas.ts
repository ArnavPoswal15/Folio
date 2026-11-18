import React, { useCallback, useEffect, useRef } from 'react';
import {
  FOUNTAIN_PRESSURE_CONFIG,
  INK_CANVAS_MAX_DPR,
  INK_ERASER_RADIUS_NORM,
  INK_GRID_MAX,
  INK_MIN_POINT_STEP,
} from '../constants/ink';
import {
  ActiveInkPointerState,
  InkDrawToolType,
  InkPoint,
  InkStroke,
  InkToolConfig,
  InkToolType,
} from '../types/ink';
import {
  createInkStrokeId,
  parseInkStrokes,
  serializeInkStrokes,
} from '../utils/inkCodec';
import { hitTestStrokeEraser, simplifyInkPoints } from '../utils/inkMath';
import {
  applyFountainReleaseTaper,
  sampleFountainPressure,
} from '../utils/inkPressure';
import { renderInkStrokes } from '../utils/inkRenderer';

/** Options accepted by the useInkCanvas hook. */
interface UseInkCanvasOptions {
  serializedInk: string;
  interactive: boolean;
  locked: boolean;
  isDark: boolean;
  inkConfig: InkToolConfig;
  onCommitInk?: (nextSerialized: string) => void;
  onPenActivity?: () => void;
  onStylusActive?: () => void;
  onCapacityWarning?: (message: string) => void;
}

/**
 * Manages DPR-aware canvas rendering, Apple Pencil / touch / mouse pointer capture, barrel erasing, and fountain speed-pressure strokes.
 * @param options - Serialized ink string, tool configuration, theme flag, and commit callbacks.
 * @returns DOM element refs, derived cursor/touchAction styles, and pointer event handlers.
 */
export function useInkCanvas({
  serializedInk,
  interactive,
  locked,
  isDark,
  inkConfig,
  onCommitInk,
  onPenActivity,
  onStylusActive,
  onCapacityWarning,
}: UseInkCanvasOptions) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const eraserRingRef = useRef<HTMLDivElement | null>(null);

  const strokesRef = useRef<InkStroke[]>(parseInkStrokes(serializedInk));
  const activeStrokeRef = useRef<InkStroke | null>(null);
  const activePointerRef = useRef<ActiveInkPointerState | null>(null);

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

    const dpr = Math.min(INK_CANVAS_MAX_DPR, window.devicePixelRatio || 1);
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

  useEffect(() => {
    if (!activePointerRef.current) {
      strokesRef.current = parseInkStrokes(serializedInk);
      scheduleRedraw();
    }
  }, [serializedInk, scheduleRedraw]);

  useEffect(() => {
    scheduleRedraw();
  }, [isDark, scheduleRedraw]);

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
        Math.min(
          INK_GRID_MAX,
          Math.round(((clientX - rect.left) / w) * INK_GRID_MAX)
        )
      );
      const ny = Math.max(
        0,
        Math.min(
          INK_GRID_MAX,
          Math.round(((clientY - rect.top) / h) * INK_GRID_MAX)
        )
      );
      const cfg = FOUNTAIN_PRESSURE_CONFIG;
      const effectiveP =
        typeof overridePressure === 'number'
          ? Math.max(
              cfg.minPointPressure,
              Math.min(cfg.maxPointPressure, Math.round(overridePressure))
            )
          : pointerType === 'pen' && rawPressure > 0
            ? Math.max(
                cfg.minPointPressure,
                Math.min(cfg.maxPointPressure, Math.round(rawPressure * 100))
              )
            : cfg.defaultNonFountainPressure;
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

  const handlePointerDownCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive || locked) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      const cfg = inkConfigRef.current;
      const isStylus = e.pointerType === 'pen';
      const shouldDraw =
        isStylus ||
        (e.pointerType === 'mouse' && cfg.drawArmed) ||
        (e.pointerType === 'touch' && cfg.drawArmed && cfg.allowTouchDraw);

      if (!shouldDraw) return;

      e.preventDefault();
      e.stopPropagation();

      if (isStylus) {
        onPenActivity?.();
      }
      onStylusActive?.();

      const isBarrelEraser = isStylus && (e.buttons === 32 || e.button === 5);
      const effectiveTool: InkToolType = isBarrelEraser ? 'eraser' : cfg.tool;

      const pCfg = FOUNTAIN_PRESSURE_CONFIG;
      const initialHasHw =
        isStylus &&
        e.pressure > 0 &&
        Math.abs(e.pressure - 0.5) > pCfg.hardwarePressureDetectDelta;
      const initialFountainP = initialHasHw
        ? Math.max(
            pCfg.minPointPressure,
            Math.min(pCfg.maxPointPressure, e.pressure * 100)
          )
        : pCfg.initialDefaultPressure;

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
        smoothedVel: pCfg.initialVel,
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
          (s) =>
            !hitTestStrokeEraser(
              s,
              pt[0],
              pt[1],
              pt[0],
              pt[1],
              INK_ERASER_RADIUS_NORM
            )
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
    },
    [
      interactive,
      locked,
      onPenActivity,
      onStylusActive,
      scheduleRedraw,
      toNormalizedPoint,
      updateEraserRing,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const active = activePointerRef.current;

      if (!active) {
        const cfg = inkConfigRef.current;
        const isHoverEraser =
          interactive &&
          !locked &&
          cfg.tool === 'eraser' &&
          (e.pointerType === 'pen' ||
            (e.pointerType === 'mouse' && cfg.drawArmed));
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
                INK_ERASER_RADIUS_NORM
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
        const overridePressure =
          stroke.tool === 'fountain'
            ? sampleFountainPressure(
                active,
                ev.clientX,
                ev.clientY,
                ev.pressure,
                ev.timeStamp || performance.now()
              )
            : undefined;

        const pt = toNormalizedPoint(
          ev.clientX,
          ev.clientY,
          ev.pressure,
          active.pointerType,
          overridePressure
        );
        const last = stroke.points[stroke.points.length - 1];
        const minStep =
          stroke.tool === 'fountain'
            ? INK_MIN_POINT_STEP.fountain
            : INK_MIN_POINT_STEP.default;
        if (!last || Math.hypot(pt[0] - last[0], pt[1] - last[1]) >= minStep) {
          stroke.points.push(pt);
          added = true;
        }
      }
      if (added) {
        scheduleRedraw();
      }
    },
    [
      interactive,
      locked,
      onPenActivity,
      scheduleRedraw,
      toNormalizedPoint,
      updateEraserRing,
    ]
  );

  const finishActivePointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
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

      if (finished.tool === 'fountain') {
        applyFountainReleaseTaper(finished.points, endVel);
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
        onCapacityWarning?.(
          'Page ink limit reached — oldest stroke trimmed to fit sync quota.'
        );
      }
      onCommitInk?.(encoded);
    },
    [onCapacityWarning, onCommitInk, redrawCanvas, updateEraserRing]
  );

  const handlePointerLeave = useCallback(() => {
    updateEraserRing(0, 0, false);
  }, [updateEraserRing]);

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

  return {
    refs: {
      wrapperRef,
      canvasRef,
      eraserRingRef,
    },
    cursorClass,
    touchActionStyle,
    handlers: {
      handlePointerDownCapture,
      handlePointerMove,
      finishActivePointer,
      handlePointerLeave,
    },
  };
}
