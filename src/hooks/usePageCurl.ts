import gsap from 'gsap';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IDLE_CURL, PAGE_CURL_CONFIG } from '../constants/pageCurl';
import { BookPhase } from '../types/book';
import { JournalSpread } from '../types/journal';
import { PageFocusRequest } from '../types/pageContent';
import {
  CornerAnchor,
  CurlDragInfo,
  CurlGeometry,
  CurlRuntimeState,
  Point,
  TurnDirection,
} from '../types/pageCurl';
import {
  computeCurlGeometry,
  getAnchorPoint,
  getTargetPoint,
} from '../utils/pageCurlGeometry';
import { mergeOverflowText } from '../utils/spread';
import { prefersReducedMotion } from '../utils/viewport';

/** Options accepted by the usePageCurl hook. */
interface UsePageCurlOptions {
  bookPhase: BookPhase;
  pageW: number;
  pageH: number;
  isMobile: boolean;
  mobileSide: 'left' | 'right';
  currentIndex: number;
  currentSpread: JournalSpread;
  canTurnPrev: boolean;
  isVoiceBusy: boolean;
  showWelcome: boolean;
  isSignedIn: boolean;
  spreadRef: React.RefObject<HTMLDivElement | null>;
  onCommitTurn: (direction: TurnDirection) => void;
  onDismissWelcome: () => void;
  onUpdateSpread: (index: number, patch: Partial<JournalSpread>) => void;
  onStageContinuationSpread?: (
    index: number,
    rightBodyFit: string,
    overflowLeftBody: string
  ) => number;
  onRequestFocus?: (req: Omit<PageFocusRequest, 'nonce'>) => void;
}

/**
 * Manages page-corner hover peeks, pointer drag gestures with spine constraints, GSAP curl tweens, keyboard turn shortcuts, and overflow page turns.
 * @param options - Book phase, page dimensions, navigation gates, and spread mutation callbacks.
 * @returns Computed CurlGeometry, lock/interaction state flags, stylus palm-guard callback, and corner/overflow handlers.
 */
export function usePageCurl({
  bookPhase,
  pageW,
  pageH,
  isMobile,
  mobileSide,
  currentIndex,
  currentSpread,
  canTurnPrev,
  isVoiceBusy,
  showWelcome,
  isSignedIn,
  spreadRef,
  onCommitTurn,
  onDismissWelcome,
  onUpdateSpread,
  onStageContinuationSpread,
  onRequestFocus,
}: UsePageCurlOptions) {
  const curlTweenRef = useRef<gsap.core.Tween | null>(null);
  const curlProxyRef = useRef<{ x: number; y: number; t: number }>({
    x: 0,
    y: 0,
    t: 0,
  });

  const [curlState, setCurlState] = useState<CurlRuntimeState>(IDLE_CURL);
  const curlRef = useRef<CurlRuntimeState>(IDLE_CURL);
  const lastPenActivityRef = useRef<number>(0);

  const dragInfoRef = useRef<CurlDragInfo>({
    pointerId: null,
    direction: 'next',
    corner: 'bottom',
    startClientX: 0,
    startClientY: 0,
    grabLocalY: 0,
    hasMoved: false,
    lastX: 0,
    lastTime: 0,
    velocityX: 0,
  });

  const updateCurl = useCallback((next: CurlRuntimeState) => {
    curlRef.current = next;
    setCurlState(next);
  }, []);

  const cancelCurlTween = useCallback(() => {
    curlTweenRef.current?.kill();
    curlTweenRef.current = null;
  }, []);

  const resetCurlImmediately = useCallback(() => {
    cancelCurlTween();
    updateCurl(IDLE_CURL);
  }, [cancelCurlTween, updateCurl]);

  const handlePenActivity = useCallback(() => {
    lastPenActivityRef.current = performance.now();
  }, []);

  const commitTurnOrWelcome = useCallback(
    (direction: TurnDirection) => {
      if (showWelcome && direction === 'next') {
        onDismissWelcome();
        return;
      }
      onCommitTurn(direction);
    },
    [onCommitTurn, onDismissWelcome, showWelcome]
  );

  const clientToSpread = useCallback(
    (clientX: number, clientY: number): Point => {
      const el = spreadRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    [spreadRef]
  );

  const animateCurlTo = useCallback(
    (
      direction: TurnDirection,
      corner: CornerAnchor,
      fromPt: Point,
      toPt: Point,
      durationSec: number,
      withArcLift: boolean,
      onDone: () => void
    ) => {
      cancelCurlTween();
      if (prefersReducedMotion() || durationSec <= 0) {
        onDone();
        return;
      }

      curlProxyRef.current = { x: fromPt.x, y: fromPt.y, t: 0 };
      curlTweenRef.current = gsap.to(curlProxyRef.current, {
        t: 1,
        duration: durationSec,
        ease: withArcLift ? 'power2.inOut' : 'power3.out',
        onUpdate: () => {
          const progress = curlProxyRef.current.t;
          const x = fromPt.x + (toPt.x - fromPt.x) * progress;
          let y = fromPt.y + (toPt.y - fromPt.y) * progress;

          if (withArcLift) {
            const lift =
              Math.sin(progress * Math.PI) *
              Math.min(
                PAGE_CURL_CONFIG.MAX_ARC_LIFT_PX,
                pageH * PAGE_CURL_CONFIG.ARC_LIFT_HEIGHT_RATIO
              );
            y += corner === 'bottom' ? -lift : lift;
          }

          updateCurl({
            active: true,
            mode: 'animating',
            direction,
            corner,
            pointer: { x, y },
          });
        },
        onComplete: () => {
          curlTweenRef.current = null;
          onDone();
        },
      });
    },
    [cancelCurlTween, pageH, updateCurl]
  );

  const triggerProgrammaticTurn = useCallback(
    (
      direction: TurnDirection,
      corner: CornerAnchor = 'bottom',
      durationSec: number = PAGE_CURL_CONFIG.DEFAULT_TURN_DURATION_SEC
    ) => {
      if (bookPhase !== 'open') return;
      if (isVoiceBusy) return;
      if (direction === 'prev' && !canTurnPrev) return;
      if (curlRef.current.mode === 'animating') return;

      const anchor = getAnchorPoint(direction, corner, pageW, pageH, isMobile);
      const startPt: Point =
        curlRef.current.active && curlRef.current.direction === direction
          ? curlRef.current.pointer
          : {
              x:
                direction === 'next'
                  ? anchor.x - PAGE_CURL_CONFIG.PROGRAMMATIC_START_OFFSET_X
                  : anchor.x + PAGE_CURL_CONFIG.PROGRAMMATIC_START_OFFSET_X,
              y:
                corner === 'bottom'
                  ? anchor.y - PAGE_CURL_CONFIG.PROGRAMMATIC_START_OFFSET_Y
                  : anchor.y + PAGE_CURL_CONFIG.PROGRAMMATIC_START_OFFSET_Y,
            };
      const target = getTargetPoint(direction, corner, pageW, pageH, isMobile);

      animateCurlTo(
        direction,
        corner,
        startPt,
        target,
        durationSec,
        true,
        () => {
          updateCurl(IDLE_CURL);
          commitTurnOrWelcome(direction);
        }
      );
    },
    [
      animateCurlTo,
      bookPhase,
      canTurnPrev,
      commitTurnOrWelcome,
      isMobile,
      isVoiceBusy,
      pageH,
      pageW,
      updateCurl,
    ]
  );

  const handlePageOverflow = useCallback(
    (
      side: 'left' | 'right',
      fitText: string,
      overflowText: string,
      moveFocus: boolean,
      caretOffset: number
    ) => {
      if (bookPhase !== 'open' || curlRef.current.mode === 'animating') {
        return;
      }

      if (side === 'left') {
        const mergedRight = mergeOverflowText(
          overflowText,
          currentSpread.rightBody ?? ''
        );

        onUpdateSpread(currentIndex, {
          leftBody: fitText,
          rightBody: mergedRight,
        });

        if (moveFocus) {
          onRequestFocus?.({
            spreadIndex: currentIndex,
            side: 'right',
            caretOffset,
          });
          if (isMobile && mobileSide === 'left') {
            triggerProgrammaticTurn(
              'next',
              'bottom',
              PAGE_CURL_CONFIG.OVERFLOW_TURN_DURATION_SEC
            );
          }
        }
        return;
      }

      const nextIdx = onStageContinuationSpread
        ? onStageContinuationSpread(currentIndex, fitText, overflowText)
        : currentIndex + 1;

      if (!onStageContinuationSpread) {
        onUpdateSpread(currentIndex, { rightBody: fitText });
      }

      if (moveFocus) {
        onRequestFocus?.({
          spreadIndex: nextIdx,
          side: 'left',
          caretOffset,
        });
        triggerProgrammaticTurn(
          'next',
          'bottom',
          PAGE_CURL_CONFIG.OVERFLOW_TURN_DURATION_SEC
        );
      }
    },
    [
      bookPhase,
      currentIndex,
      currentSpread.rightBody,
      isMobile,
      mobileSide,
      onRequestFocus,
      onStageContinuationSpread,
      onUpdateSpread,
      triggerProgrammaticTurn,
    ]
  );

  useEffect(() => {
    if (showWelcome && isSignedIn && bookPhase === 'open') {
      triggerProgrammaticTurn('next', 'bottom');
    }
  }, [bookPhase, isSignedIn, showWelcome, triggerProgrammaticTurn]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (bookPhase !== 'open') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'INPUT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        triggerProgrammaticTurn('next', 'bottom');
      } else if (e.key === 'ArrowLeft' && canTurnPrev) {
        e.preventDefault();
        triggerProgrammaticTurn('prev', 'bottom');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bookPhase, canTurnPrev, triggerProgrammaticTurn]);

  useEffect(() => {
    const handleWindowBlur = () => {
      cancelCurlTween();
      dragInfoRef.current.pointerId = null;
      updateCurl(IDLE_CURL);
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      cancelCurlTween();
    };
  }, [cancelCurlTween, updateCurl]);

  useEffect(() => {
    if (curlRef.current.mode === 'hover') {
      cancelCurlTween();
      updateCurl(IDLE_CURL);
    }
  }, [pageW, pageH, isMobile, cancelCurlTween, updateCurl]);

  const startHoverCurl = useCallback(
    (direction: TurnDirection, corner: CornerAnchor) => {
      if (bookPhase !== 'open') return;
      if (
        curlRef.current.mode === 'dragging' ||
        curlRef.current.mode === 'animating'
      ) {
        return;
      }
      if (direction === 'prev' && !canTurnPrev) return;
      if (prefersReducedMotion()) return;

      const anchor = getAnchorPoint(direction, corner, pageW, pageH, isMobile);
      const targetHover: Point = {
        x:
          direction === 'next'
            ? anchor.x - PAGE_CURL_CONFIG.HOVER_OFFSET_X
            : anchor.x + PAGE_CURL_CONFIG.HOVER_OFFSET_X,
        y:
          corner === 'bottom'
            ? anchor.y - PAGE_CURL_CONFIG.HOVER_OFFSET_Y
            : anchor.y + PAGE_CURL_CONFIG.HOVER_OFFSET_Y,
      };

      const startPt =
        curlRef.current.active && curlRef.current.direction === direction
          ? curlRef.current.pointer
          : anchor;

      cancelCurlTween();
      curlProxyRef.current = { x: startPt.x, y: startPt.y, t: 0 };
      curlTweenRef.current = gsap.to(curlProxyRef.current, {
        x: targetHover.x,
        y: targetHover.y,
        duration: PAGE_CURL_CONFIG.HOVER_IN_DURATION_SEC,
        ease: 'power2.out',
        onUpdate: () => {
          if (
            curlRef.current.mode === 'dragging' ||
            curlRef.current.mode === 'animating'
          ) {
            return;
          }
          updateCurl({
            active: true,
            mode: 'hover',
            direction,
            corner,
            pointer: {
              x: curlProxyRef.current.x,
              y: curlProxyRef.current.y,
            },
          });
        },
      });
    },
    [bookPhase, cancelCurlTween, canTurnPrev, isMobile, pageH, pageW, updateCurl]
  );

  const endHoverCurl = useCallback(() => {
    if (curlRef.current.mode !== 'hover') return;
    const { direction, corner, pointer } = curlRef.current;
    const anchor = getAnchorPoint(direction, corner, pageW, pageH, isMobile);

    cancelCurlTween();
    curlProxyRef.current = { x: pointer.x, y: pointer.y, t: 0 };
    curlTweenRef.current = gsap.to(curlProxyRef.current, {
      x: anchor.x,
      y: anchor.y,
      duration: PAGE_CURL_CONFIG.HOVER_OUT_DURATION_SEC,
      ease: 'power2.out',
      onUpdate: () => {
        if (curlRef.current.mode !== 'hover') return;
        updateCurl({
          active: true,
          mode: 'hover',
          direction,
          corner,
          pointer: {
            x: curlProxyRef.current.x,
            y: curlProxyRef.current.y,
          },
        });
      },
      onComplete: () => {
        curlTweenRef.current = null;
        if (curlRef.current.mode === 'hover') {
          updateCurl(IDLE_CURL);
        }
      },
    });
  }, [cancelCurlTween, isMobile, pageH, pageW, updateCurl]);

  const handleZonePointerDown = useCallback(
    (
      e: React.PointerEvent<HTMLDivElement>,
      direction: TurnDirection,
      preferredCorner?: CornerAnchor
    ) => {
      if (bookPhase !== 'open') return;
      if (isVoiceBusy) return;
      if (e.pointerType === 'pen') return;
      if (
        e.pointerType === 'touch' &&
        performance.now() - lastPenActivityRef.current <
          PAGE_CURL_CONFIG.PALM_GUARD_MS
      ) {
        return;
      }
      if (e.button !== 0) return;
      if (direction === 'prev' && !canTurnPrev) return;
      if (curlRef.current.mode === 'animating') return;

      e.preventDefault();
      e.stopPropagation();
      cancelCurlTween();

      const pt = clientToSpread(e.clientX, e.clientY);
      const corner: CornerAnchor =
        preferredCorner ??
        (pt.y < pageH * PAGE_CURL_CONFIG.TOP_CORNER_RATIO ? 'top' : 'bottom');

      dragInfoRef.current = {
        pointerId: e.pointerId,
        direction,
        corner,
        startClientX: e.clientX,
        startClientY: e.clientY,
        grabLocalY: pt.y,
        hasMoved: false,
        lastX: pt.x,
        lastTime: performance.now(),
        velocityX: 0,
      };

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic events
      }

      const anchor = getAnchorPoint(direction, corner, pageW, pageH, isMobile);
      const initialPt: Point =
        curlRef.current.active && curlRef.current.direction === direction
          ? curlRef.current.pointer
          : {
              x:
                direction === 'next'
                  ? anchor.x - PAGE_CURL_CONFIG.INITIAL_DRAG_OFFSET_X
                  : anchor.x + PAGE_CURL_CONFIG.INITIAL_DRAG_OFFSET_X,
              y:
                corner === 'bottom'
                  ? anchor.y - PAGE_CURL_CONFIG.INITIAL_DRAG_OFFSET_Y
                  : anchor.y + PAGE_CURL_CONFIG.INITIAL_DRAG_OFFSET_Y,
            };

      updateCurl({
        active: true,
        mode: 'dragging',
        direction,
        corner,
        pointer: initialPt,
      });
    },
    [
      bookPhase,
      cancelCurlTween,
      canTurnPrev,
      clientToSpread,
      isMobile,
      isVoiceBusy,
      pageH,
      pageW,
      updateCurl,
    ]
  );

  const handleZonePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const info = dragInfoRef.current;
      if (curlRef.current.mode !== 'dragging' || info.pointerId !== e.pointerId) {
        return;
      }

      const distMoved = Math.hypot(
        e.clientX - info.startClientX,
        e.clientY - info.startClientY
      );
      if (distMoved > PAGE_CURL_CONFIG.MOVE_THRESHOLD_PX) {
        info.hasMoved = true;
      }

      const pt = clientToSpread(e.clientX, e.clientY);
      const now = performance.now();
      const dt = Math.max(8, now - info.lastTime);
      info.velocityX = (pt.x - info.lastX) / dt;
      info.lastX = pt.x;
      info.lastTime = now;

      const isMiddleEdge =
        info.grabLocalY > pageH * PAGE_CURL_CONFIG.MIDDLE_EDGE_MIN_RATIO &&
        info.grabLocalY < pageH * PAGE_CURL_CONFIG.MIDDLE_EDGE_MAX_RATIO;

      let mappedY = pt.y;
      if (isMiddleEdge) {
        const dy = pt.y - info.grabLocalY;
        mappedY =
          info.corner === 'bottom'
            ? pageH + dy * PAGE_CURL_CONFIG.MIDDLE_EDGE_Y_DAMPING
            : dy * PAGE_CURL_CONFIG.MIDDLE_EDGE_Y_DAMPING;
      }

      updateCurl({
        active: true,
        mode: 'dragging',
        direction: info.direction,
        corner: info.corner,
        pointer: {
          x: pt.x,
          y: mappedY,
        },
      });
    },
    [clientToSpread, pageH, updateCurl]
  );

  const handleZonePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const info = dragInfoRef.current;
      if (curlRef.current.mode !== 'dragging' || info.pointerId !== e.pointerId) {
        return;
      }
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore release errors
      }
      info.pointerId = null;

      const { direction, corner, pointer } = curlRef.current;
      const anchor = getAnchorPoint(direction, corner, pageW, pageH, isMobile);
      const target = getTargetPoint(direction, corner, pageW, pageH, isMobile);

      if (!info.hasMoved) {
        animateCurlTo(
          direction,
          corner,
          pointer,
          target,
          PAGE_CURL_CONFIG.DEFAULT_TURN_DURATION_SEC,
          true,
          () => {
            updateCurl(IDLE_CURL);
            commitTurnOrWelcome(direction);
          }
        );
        return;
      }

      const progress = Math.abs(pointer.x - anchor.x) / (2 * pageW);
      const flickedForward =
        direction === 'next'
          ? info.velocityX < -PAGE_CURL_CONFIG.FLICK_VELOCITY_THRESHOLD
          : info.velocityX > PAGE_CURL_CONFIG.FLICK_VELOCITY_THRESHOLD;
      const shouldComplete =
        progress > PAGE_CURL_CONFIG.COMMIT_PROGRESS_THRESHOLD ||
        (progress > PAGE_CURL_CONFIG.FLICK_MIN_PROGRESS && flickedForward);

      if (shouldComplete) {
        const remainingDuration = Math.max(
          PAGE_CURL_CONFIG.MIN_COMPLETE_DURATION_SEC,
          (1 - progress) * PAGE_CURL_CONFIG.MAX_COMPLETE_DURATION_SEC
        );
        animateCurlTo(
          direction,
          corner,
          pointer,
          target,
          remainingDuration,
          false,
          () => {
            updateCurl(IDLE_CURL);
            commitTurnOrWelcome(direction);
          }
        );
      } else {
        const returnDuration = Math.max(
          PAGE_CURL_CONFIG.MIN_RETURN_DURATION_SEC,
          progress * PAGE_CURL_CONFIG.MAX_RETURN_DURATION_SEC
        );
        animateCurlTo(
          direction,
          corner,
          pointer,
          anchor,
          returnDuration,
          false,
          () => {
            updateCurl(IDLE_CURL);
          }
        );
      }
    },
    [
      animateCurlTo,
      commitTurnOrWelcome,
      isMobile,
      pageH,
      pageW,
      updateCurl,
    ]
  );

  const curl: CurlGeometry | null = curlState.active
    ? computeCurlGeometry(
        curlState.pointer,
        curlState.direction,
        curlState.corner,
        pageW,
        pageH,
        isMobile
      )
    : null;

  return {
    curl,
    curlMode: curlState.mode,
    resetCurlImmediately,
    handlePenActivity,
    triggerProgrammaticTurn,
    handlePageOverflow,
    startHoverCurl,
    endHoverCurl,
    handleZonePointerDown,
    handleZonePointerMove,
    handleZonePointerUp,
  };
}
