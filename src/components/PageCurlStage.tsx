import gsap from 'gsap';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { formatJournalDateParts } from '../data/initialEntries';
import { JournalSpread } from '../types/journal';
import { VoiceControl } from '../hooks/useVoiceRecorder';
import {
  computeCurlGeometry,
  CornerAnchor,
  getAnchorPoint,
  getTargetPoint,
  Point,
  TurnDirection,
} from '../utils/pageCurlGeometry';
import { InkToolConfig } from './InkCanvasLayer';
import { JournalPageContent, PageFocusRequest } from './JournalPageContent';
import { WelcomeSpreadContent } from './WelcomeSpreadContent';

export type BookPhase = 'closed' | 'opening' | 'open' | 'closing';

interface PageCurlStageProps {
  spreads: JournalSpread[];
  currentIndex: number;
  pageW: number;
  pageH: number;
  isMobile: boolean;
  mobileSide: 'left' | 'right';
  bookPhase: BookPhase;
  upcomingBlankSpread: JournalSpread;
  showWelcome: boolean;
  isSignedIn: boolean;
  authBusy: boolean;
  authError: string | null;
  onOpenBook: () => void;
  onOpenComplete: () => void;
  onCloseComplete: () => void;
  onUpdateSpread: (index: number, patch: Partial<JournalSpread>) => void;
  onCommitTurn: (direction: TurnDirection) => void;
  onNewSpread: () => void;
  onOpenIndex: () => void;
  onOpenExport: () => void;
  onOpenAccount: () => void;
  onSignInWithGoogle: () => void;
  onClearAuthError: () => void;
  onDismissWelcome: () => void;
  onCloseBook: () => void;
  voiceControl?: VoiceControl;
  inkConfig?: InkToolConfig;
  inkToolbarOpen?: boolean;
  onToggleInkToolbar?: (side: 'left' | 'right') => void;
  onCommitInk?: (
    spreadIndex: number,
    side: 'left' | 'right',
    nextSerialized: string
  ) => void;
  onStylusActive?: (spreadIndex: number, side: 'left' | 'right') => void;
  onInkCapacityWarning?: (message: string) => void;
  onStageContinuationSpread?: (
    index: number,
    rightBodyFit: string,
    overflowLeftBody: string
  ) => number;
  focusRequest?: PageFocusRequest | null;
  onRequestFocus?: (req: Omit<PageFocusRequest, 'nonce'>) => void;
  onClearFocusRequest?: (nonce: number) => void;
}

interface CurlRuntimeState {
  active: boolean;
  mode: 'idle' | 'hover' | 'dragging' | 'animating';
  direction: TurnDirection;
  corner: CornerAnchor;
  pointer: Point;
}

const IDLE_CURL: CurlRuntimeState = {
  active: false,
  mode: 'idle',
  direction: 'next',
  corner: 'bottom',
  pointer: { x: 0, y: 0 },
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const RIBBON_L = 68; // resistance: larger = looser, smaller = stiffer
const RIBBON_W = 16;
const RIBBON_BASE_LENGTH = 36; // 8px tucked inside binding + 28px hanging below
const RIBBON_K = 260; // spring stiffness
const RIBBON_ZETA = 0.2; // low damping ratio for lively "boing" bounce

function ribbonRubber(d: number): number {
  if (d <= 0) return Math.max(d * 0.24, -10);
  return RIBBON_L * (1 - Math.exp(-d / RIBBON_L));
}

function ribbonInverse(pull: number): number {
  if (pull <= 0) return pull / 0.24;
  return -RIBBON_L * Math.log(1 - Math.min(pull, RIBBON_L * 0.999) / RIBBON_L);
}

function buildRibbonPath(pull: number, sway: number): {
  d: string;
  sheenOpacity: number;
} {
  const cx = RIBBON_W / 2;
  const topHalfW = RIBBON_W / 2;
  const stretch = Math.max(-0.25, Math.min(1, pull / RIBBON_L));
  const tailHalfW = topHalfW * (1 - 0.34 * stretch);

  const tipY = Math.max(14, RIBBON_BASE_LENGTH + pull);
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

const INITIAL_RIBBON_PATH = buildRibbonPath(0, 0).d;

export const PageCurlStage: React.FC<PageCurlStageProps> = ({
  spreads,
  currentIndex,
  pageW,
  pageH,
  isMobile,
  mobileSide,
  bookPhase,
  upcomingBlankSpread,
  showWelcome,
  isSignedIn,
  authBusy,
  authError,
  onOpenBook,
  onOpenComplete,
  onCloseComplete,
  onUpdateSpread,
  onCommitTurn,
  onNewSpread,
  onOpenIndex,
  onOpenExport,
  onOpenAccount,
  onSignInWithGoogle,
  onClearAuthError,
  onDismissWelcome,
  onCloseBook,
  voiceControl,
  inkConfig,
  inkToolbarOpen = false,
  onToggleInkToolbar,
  onCommitInk,
  onStylusActive,
  onInkCapacityWarning,
  onStageContinuationSpread,
  focusRequest,
  onRequestFocus,
  onClearFocusRequest,
}) => {
  const { isDark } = useTheme();
  const spreadRef = useRef<HTMLDivElement | null>(null);
  const bookWrapperRef = useRef<HTMLDivElement | null>(null);
  const deskShadowRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const coverRef = useRef<HTMLDivElement | null>(null);
  const coverFrontRef = useRef<HTMLButtonElement | null>(null);
  const coverBackRef = useRef<HTMLDivElement | null>(null);
  const mobileBackFaceRef = useRef<HTMLDivElement | null>(null);
  const rightShadowRef = useRef<HTMLDivElement | null>(null);

  const ribbonPathRef = useRef<SVGPathElement | null>(null);
  const ribbonSheenPathRef = useRef<SVGPathElement | null>(null);
  const ribbonSimRef = useRef<{
    pull: number;
    vel: number;
    dragSway: number;
    dragSwayVel: number;
    rafId: number | null;
    lastTime: number;
    pointerId: number | null;
    startClientX: number;
    startClientY: number;
    hasMoved: boolean;
  }>({
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
  const [isTuggingRibbon, setIsTuggingRibbon] = useState(false);

  const coverProgressRef = useRef<{ p: number }>({ p: 0 });
  const coverTweenRef = useRef<gsap.core.Tween | null>(null);
  const curlTweenRef = useRef<gsap.core.Tween | null>(null);
  const curlProxyRef = useRef<{ x: number; y: number; t: number }>({
    x: 0,
    y: 0,
    t: 0,
  });

  const [curlState, setCurlState] = useState<CurlRuntimeState>(IDLE_CURL);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const curlRef = useRef<CurlRuntimeState>(IDLE_CURL);
  const lastPenActivityRef = useRef<number>(0);

  const handlePenActivity = useCallback(() => {
    lastPenActivityRef.current = performance.now();
  }, []);

  const updateCurl = useCallback((next: CurlRuntimeState) => {
    curlRef.current = next;
    setCurlState(next);
  }, []);

  const dragInfoRef = useRef<{
    pointerId: number | null;
    direction: TurnDirection;
    corner: CornerAnchor;
    startClientX: number;
    startClientY: number;
    grabLocalY: number;
    hasMoved: boolean;
    lastX: number;
    lastTime: number;
    velocityX: number;
  }>({
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

  const stageW = isMobile ? pageW : pageW * 2;
  const halfBookW = pageW + 11;
  const fullBookH = pageH + 22;

  const poseMetricsRef = useRef({ halfBookW, isMobile, pageW });
  poseMetricsRef.current = { halfBookW, isMobile, pageW };

  // Apply deterministic 3D book-cover pose without ever altering opacity on preserve-3d coverRef
  const applyCoverPose = useCallback((p: number, phase: BookPhase) => {
    const {
      halfBookW: hbw,
      isMobile: mobile,
      pageW: pw,
    } = poseMetricsRef.current;
    const clamped = Math.max(0, Math.min(1, p));
    const angle = mobile ? -clamped * 115 : -clamped * 180;
    const pastNinety = Math.abs(angle) > 90;

    const wrapper = bookWrapperRef.current;
    const deskShadow = deskShadowRef.current;
    const frame = frameRef.current;
    const cover = coverRef.current;
    const coverFront = coverFrontRef.current;
    const coverBack = coverBackRef.current;
    const mobileBack = mobileBackFaceRef.current;
    const rightShadow = rightShadowRef.current;

    if (wrapper) {
      const targetX = mobile ? 0 : (-(pw + 11) / 2) * (1 - clamped);
      gsap.set(wrapper, { x: targetX });
    }

    // Expand desk shadow leftward from the spine in smooth lockstep with the opening cover (> 90deg)
    if (deskShadow) {
      if (mobile) {
        gsap.set(deskShadow, { scaleX: 1, z: -6 });
      } else {
        const leftReach = Math.max(0, -Math.cos(clamped * Math.PI));
        gsap.set(deskShadow, { scaleX: 0.5 + 0.5 * leftReach, z: -6 });
      }
    }

    // Keep left half unclipped across the 0.992..1.0 overlap window so cover & spread hand off cleanly
    if (frame) {
      if (mobile || phase === 'open' || clamped >= 0.992) {
        frame.style.clipPath = 'none';
      } else {
        frame.style.clipPath = `inset(-80px -120px -180px ${hbw}px)`;
      }
    }

    if (cover) {
      if (phase === 'open') {
        cover.style.visibility = 'hidden';
        cover.style.pointerEvents = 'none';
        gsap.set(cover, { rotateY: mobile ? -115 : -180, z: 8 });
      } else {
        cover.style.visibility = 'visible';
        cover.style.pointerEvents = phase === 'closed' ? '' : 'none';
        gsap.set(cover, { rotateY: angle, z: 8 });
      }
    }

    if (coverFront) {
      coverFront.style.visibility = pastNinety ? 'hidden' : 'visible';
    }

    if (coverBack && !mobile) {
      coverBack.style.opacity = pastNinety ? '1' : '0';
    }

    if (mobileBack && mobile) {
      const fadeOut =
        clamped <= 0.72 ? 1 : Math.max(0, 1 - (clamped - 0.72) / 0.28);
      mobileBack.style.opacity = pastNinety ? fadeOut.toFixed(3) : '0';
    }

    if (rightShadow) {
      const shadowOpacity = mobile
        ? Math.max(0, 0.82 * Math.pow(Math.max(0, 1 - clamped / 0.78), 1.15))
        : Math.max(0, 0.34 * (1 - clamped / 0.45));
      rightShadow.style.opacity = shadowOpacity.toFixed(3);
    }
  }, []);

  // Sync GSAP 3D book cover animation with bookPhase
  useEffect(() => {
    coverTweenRef.current?.kill();

    if (bookPhase === 'closed') {
      coverProgressRef.current.p = 0;
      applyCoverPose(0, 'closed');
      return;
    }

    if (bookPhase === 'open') {
      coverProgressRef.current.p = 1;
      applyCoverPose(1, 'open');
      return;
    }

    if (prefersReducedMotion()) {
      const targetP = bookPhase === 'opening' ? 1 : 0;
      coverProgressRef.current.p = targetP;
      applyCoverPose(targetP, bookPhase === 'opening' ? 'open' : 'closed');
      if (bookPhase === 'opening') onOpenComplete();
      else onCloseComplete();
      return;
    }

    if (bookPhase === 'opening') {
      coverProgressRef.current.p = 0;
      applyCoverPose(0, 'opening');
      coverTweenRef.current = gsap.to(coverProgressRef.current, {
        p: 1,
        duration: isMobile ? 0.92 : 1.18,
        ease: 'power2.inOut',
        onUpdate: () => applyCoverPose(coverProgressRef.current.p, 'opening'),
        onComplete: () => {
          applyCoverPose(1, 'open');
          onOpenComplete();
        },
      });
    } else if (bookPhase === 'closing') {
      curlTweenRef.current?.kill();
      updateCurl(IDLE_CURL);

      coverProgressRef.current.p = 1;
      applyCoverPose(1, 'closing');
      coverTweenRef.current = gsap.to(coverProgressRef.current, {
        p: 0,
        duration: isMobile ? 0.88 : 1.12,
        ease: 'power2.inOut',
        onUpdate: () => applyCoverPose(coverProgressRef.current.p, 'closing'),
        onComplete: () => {
          applyCoverPose(0, 'closed');
          onCloseComplete();
        },
      });
    }
  }, [
    applyCoverPose,
    bookPhase,
    isMobile,
    onCloseComplete,
    onOpenComplete,
    updateCurl,
  ]);

  useEffect(() => {
    if (bookPhase === 'closed') applyCoverPose(0, 'closed');
    else if (bookPhase === 'open') applyCoverPose(1, 'open');
    else applyCoverPose(coverProgressRef.current.p, bookPhase);
  }, [applyCoverPose, bookPhase, pageW, pageH, isMobile]);

  const cancelCurlTween = useCallback(() => {
    curlTweenRef.current?.kill();
    curlTweenRef.current = null;
  }, []);

  const renderRibbon = useCallback(() => {
    const sim = ribbonSimRef.current;
    const speedSway = Math.max(-12, Math.min(12, sim.vel * 0.025));
    const sway = Math.max(-16, Math.min(16, sim.dragSway + speedSway));
    const { d, sheenOpacity } = buildRibbonPath(sim.pull, sway);

    if (ribbonPathRef.current) {
      ribbonPathRef.current.setAttribute('d', d);
    }
    if (ribbonSheenPathRef.current) {
      ribbonSheenPathRef.current.setAttribute('d', d);
      ribbonSheenPathRef.current.style.opacity = sheenOpacity.toFixed(3);
    }
  }, []);

  const stopRibbonSpring = useCallback(() => {
    const sim = ribbonSimRef.current;
    if (sim.rafId !== null) {
      cancelAnimationFrame(sim.rafId);
      sim.rafId = null;
    }
  }, []);

  const releaseRibbonSpring = useCallback(
    (initialVel = 0) => {
      stopRibbonSpring();
      const sim = ribbonSimRef.current;

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

        const c = 2 * RIBBON_ZETA * Math.sqrt(RIBBON_K);
        const accel = -RIBBON_K * sim.pull - c * sim.vel;
        sim.vel += accel * dt;
        sim.pull += sim.vel * dt;

        const swayAccel =
          -RIBBON_K * 0.85 * sim.dragSway - c * 1.15 * sim.dragSwayVel;
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

  const handleRibbonPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    stopRibbonSpring();

    const sim = ribbonSimRef.current;
    // Allow re-grabbing mid-bounce seamlessly with zero jump
    sim.pointerId = e.pointerId;
    sim.startClientY = e.clientY - ribbonInverse(sim.pull);
    sim.startClientX =
      e.clientX -
      65 * Math.atanh(Math.max(-0.99, Math.min(0.99, sim.dragSway / 14)));
    sim.vel = 0;
    sim.dragSwayVel = 0;
    sim.hasMoved = false;
    setIsTuggingRibbon(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events
    }
  };

  const handleRibbonPointerMove = (
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    const sim = ribbonSimRef.current;
    if (sim.pointerId !== e.pointerId) return;

    const dx = e.clientX - sim.startClientX;
    const dy = e.clientY - sim.startClientY;
    if (Math.hypot(dx, dy) > 4) {
      sim.hasMoved = true;
    }

    sim.pull = ribbonRubber(dy);
    sim.dragSway = 14 * Math.tanh(dx / 65);
    sim.vel = 0;
    renderRibbon();
  };

  const handleRibbonPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const sim = ribbonSimRef.current;
    if (sim.pointerId !== e.pointerId) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }
    sim.pointerId = null;
    setIsTuggingRibbon(false);

    if (!sim.hasMoved && Math.abs(sim.pull) < 2) {
      // Quick tap / click gives a playful mini boing
      sim.pull = 22;
      renderRibbon();
      releaseRibbonSpring(0);
      return;
    }

    releaseRibbonSpring(0);
  };

  const handleRibbonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      stopRibbonSpring();
      ribbonSimRef.current.pull = 26;
      renderRibbon();
      releaseRibbonSpring(0);
    }
  };

  useEffect(() => {
    const handleWindowBlur = () => {
      cancelCurlTween();
      dragInfoRef.current.pointerId = null;
      updateCurl(IDLE_CURL);

      if (ribbonSimRef.current.pointerId !== null) {
        ribbonSimRef.current.pointerId = null;
        setIsTuggingRibbon(false);
        releaseRibbonSpring(0);
      }
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      cancelCurlTween();
      coverTweenRef.current?.kill();
      stopRibbonSpring();
    };
  }, [cancelCurlTween, releaseRibbonSpring, stopRibbonSpring, updateCurl]);

  useEffect(() => {
    if (curlRef.current.mode === 'hover') {
      cancelCurlTween();
      updateCurl(IDLE_CURL);
    }
  }, [pageW, pageH, isMobile, cancelCurlTween, updateCurl]);

  const canTurnPrev = showWelcome
    ? false
    : isMobile
      ? currentIndex > 0 || mobileSide === 'right'
      : currentIndex > 0;
  const canTurnNext = true;

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

  const currentSpread = spreads[currentIndex] ?? spreads[0];
  const prevSpread = currentIndex > 0 ? spreads[currentIndex - 1] : null;
  const nextSpread =
    currentIndex < spreads.length - 1
      ? spreads[currentIndex + 1]
      : upcomingBlankSpread;

  const isSpreadContinuation = (
    idx: number,
    target?: JournalSpread | null
  ): boolean =>
    Boolean(target && idx > 0 && spreads[idx - 1]?.date === target.date);

  const isCurrentContinuation = isSpreadContinuation(currentIndex, currentSpread);

  const mobileNextTarget =
    mobileSide === 'left'
      ? { spread: currentSpread, side: 'right' as const, index: currentIndex }
      : { spread: nextSpread, side: 'left' as const, index: currentIndex + 1 };

  const mobilePrevTarget =
    mobileSide === 'right'
      ? { spread: currentSpread, side: 'left' as const, index: currentIndex }
      : prevSpread
        ? { spread: prevSpread, side: 'right' as const, index: currentIndex - 1 }
        : null;

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
    []
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
          let x = fromPt.x + (toPt.x - fromPt.x) * progress;
          let y = fromPt.y + (toPt.y - fromPt.y) * progress;

          if (withArcLift) {
            const lift =
              Math.sin(progress * Math.PI) * Math.min(92, pageH * 0.155);
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

  const isVoiceBusy = Boolean(
    voiceControl &&
      (voiceControl.status === 'recording' ||
        voiceControl.status === 'transcribing')
  );

  const triggerProgrammaticTurn = useCallback(
    (
      direction: TurnDirection,
      corner: CornerAnchor = 'bottom',
      durationSec = 1.05
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
              x: direction === 'next' ? anchor.x - 24 : anchor.x + 24,
              y: corner === 'bottom' ? anchor.y - 18 : anchor.y + 18,
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
        const existingRight = currentSpread.rightBody ?? '';
        const mergedRight =
          overflowText && existingRight
            ? `${overflowText}${
                /[\s\n]$/.test(overflowText) || /^[\s\n]/.test(existingRight)
                  ? ''
                  : '\n'
              }${existingRight}`
            : overflowText || existingRight;

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
            triggerProgrammaticTurn('next', 'bottom', 0.48);
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
        triggerProgrammaticTurn('next', 'bottom', 0.48);
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

  // Smoothly turn the welcome flyleaf straight into the journal once Google Sign-In completes
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
        x: direction === 'next' ? anchor.x - 36 : anchor.x + 36,
        y: corner === 'bottom' ? anchor.y - 28 : anchor.y + 28,
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
        duration: 0.34,
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
      duration: 0.32,
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

  const handleZonePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    direction: TurnDirection,
    preferredCorner?: CornerAnchor
  ) => {
    if (bookPhase !== 'open') return;
    if (isVoiceBusy) return;
    if (e.pointerType === 'pen') return;
    if (
      e.pointerType === 'touch' &&
      performance.now() - lastPenActivityRef.current < 450
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
      preferredCorner ?? (pt.y < pageH * 0.42 ? 'top' : 'bottom');

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
            x: direction === 'next' ? anchor.x - 28 : anchor.x + 28,
            y: corner === 'bottom' ? anchor.y - 22 : anchor.y + 22,
          };

    updateCurl({
      active: true,
      mode: 'dragging',
      direction,
      corner,
      pointer: initialPt,
    });
  };

  const handleZonePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const info = dragInfoRef.current;
    if (curlRef.current.mode !== 'dragging' || info.pointerId !== e.pointerId) {
      return;
    }

    const distMoved = Math.hypot(
      e.clientX - info.startClientX,
      e.clientY - info.startClientY
    );
    if (distMoved > 6) {
      info.hasMoved = true;
    }

    const pt = clientToSpread(e.clientX, e.clientY);
    const now = performance.now();
    const dt = Math.max(8, now - info.lastTime);
    info.velocityX = (pt.x - info.lastX) / dt;
    info.lastX = pt.x;
    info.lastTime = now;

    const isMiddleEdge =
      info.grabLocalY > pageH * 0.36 && info.grabLocalY < pageH * 0.64;

    let mappedY = pt.y;
    if (isMiddleEdge) {
      const dy = pt.y - info.grabLocalY;
      mappedY = info.corner === 'bottom' ? pageH + dy * 0.48 : dy * 0.48;
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
  };

  const handleZonePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
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
      animateCurlTo(direction, corner, pointer, target, 1.05, true, () => {
        updateCurl(IDLE_CURL);
        commitTurnOrWelcome(direction);
      });
      return;
    }

    const progress = Math.abs(pointer.x - anchor.x) / (2 * pageW);
    const flickedForward =
      direction === 'next' ? info.velocityX < -0.45 : info.velocityX > 0.45;
    const shouldComplete =
      progress > 0.28 || (progress > 0.08 && flickedForward);

    if (shouldComplete) {
      const remainingDuration = Math.max(0.42, (1 - progress) * 0.9);
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
      const returnDuration = Math.max(0.32, progress * 0.64);
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
  };

  const curl = curlState.active
    ? computeCurlGeometry(
        curlState.pointer,
        curlState.direction,
        curlState.corner,
        pageW,
        pageH,
        isMobile
      )
    : null;

  const isTurningNext = Boolean(curl?.isActive && curl.direction === 'next');
  const isTurningPrev = Boolean(curl?.isActive && curl.direction === 'prev');
  const isOpenInteractive = bookPhase === 'open';
  const isLocked =
    !isOpenInteractive ||
    isVoiceBusy ||
    curlState.mode === 'dragging' ||
    curlState.mode === 'animating';

  const dateParts = formatJournalDateParts(currentSpread.date);

  const renderFoldShadow = () => {
    if (!curl) return null;
    const shadowRgb = isDark ? '4, 3, 2' : '22, 15, 9';
    const peakAlpha = isDark ? 0.44 : 0.26;
    const midAlpha = isDark ? 0.16 : 0.09;
    return (
      <div
        style={{
          position: 'absolute',
          left: `${curl.foldMidpointLocal.x}px`,
          top: `${curl.foldMidpointLocal.y}px`,
          width: `${Math.hypot(pageW, pageH) * 2.4}px`,
          height: `${Math.hypot(pageW, pageH) * 2.4}px`,
          transform: `translate(-50%, -50%) rotate(${curl.foldNormalDeg}deg)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: '50%',
            width: `${Math.round(40 + curl.intensity * 36)}px`,
            background: `linear-gradient(to left, rgba(${shadowRgb}, ${(
              peakAlpha * curl.intensity
            ).toFixed(3)}) 0%, rgba(${shadowRgb}, ${(
              midAlpha * curl.intensity
            ).toFixed(3)}) 45%, transparent 100%)`,
          }}
        />
      </div>
    );
  };

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: `${stageW + 22}px`,
        height: `${fullBookH}px`,
        perspective: '2400px',
      }}
    >
      {/* Unified GSAP 3D Book Wrapper */}
      <div
        ref={bookWrapperRef}
        className="relative"
        style={{
          width: `${stageW + 22}px`,
          height: `${fullBookH}px`,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      >
        {/* Flat Desk Drop Shadow expanding smoothly leftward in sync with the opening cover */}
        <div
          ref={deskShadowRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 rounded-xl book-frame-shadow"
          style={{
            width: `${stageW + 22}px`,
            height: `${fullBookH}px`,
            transformOrigin: 'right center',
            transform: 'translateZ(-6px)',
            willChange: 'transform',
            zIndex: 0,
          }}
        />

        {/* ================= UNIFIED HARDBOUND FRAME + OPEN SPREAD ================= */}
        <div
          ref={frameRef}
          className="relative z-[1] cover-cloth book-frame-edge rounded-xl p-[11px]"
          style={{
            width: `${stageW + 22}px`,
            height: `${fullBookH}px`,
            transform: bookPhase === 'open' ? undefined : 'translateZ(-2px)',
            transformStyle: 'flat',
          }}
        >
          {/* Layered paper stack thickness along outer edges */}
          {!isMobile ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-[14px] bottom-[14px] left-[6px] w-[5px] rounded-l-sm paper-stack-left"
            />
          ) : null}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-[14px] bottom-[14px] right-[6px] w-[5px] rounded-r-sm paper-stack-right"
          />

          {/* Interactive woven burgundy bookmark ribbon (progressive tension + damped spring boing) */}
          <button
            type="button"
            aria-label="Bookmark ribbon"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={handleRibbonPointerDown}
            onPointerMove={handleRibbonPointerMove}
            onPointerUp={handleRibbonPointerUp}
            onPointerCancel={handleRibbonPointerUp}
            onKeyDown={handleRibbonKeyDown}
            className={`group absolute ${
              isMobile ? 'right-10' : 'right-14'
            } w-4 h-9 z-[1] appearance-none bg-transparent border-0 p-0 touch-none select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#deb488] rounded-b ${
              isTuggingRibbon ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            style={{
              top: 'calc(100% - 8px)',
              filter: 'drop-shadow(1px 4px 6px rgba(24, 16, 11, 0.34))',
            }}
          >
            {/* Generous invisible touch/grab zone strictly below the book bottom edge */}
            <span
              aria-hidden="true"
              className="absolute -inset-x-2.5 top-[8px] -bottom-3"
            />
            <svg
              width={RIBBON_W}
              height={RIBBON_BASE_LENGTH}
              viewBox={`0 0 ${RIBBON_W} ${RIBBON_BASE_LENGTH}`}
              overflow="visible"
              aria-hidden="true"
              className="pointer-events-none block overflow-visible"
            >
              <defs>
                <linearGradient
                  id="bookmark-silk-grad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#6e2226" />
                  <stop offset="48%" stopColor="#8f3136" />
                  <stop offset="100%" stopColor="#58191c" />
                </linearGradient>
                <linearGradient
                  id="bookmark-sheen-grad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="18%" stopColor="rgba(255, 232, 226, 0)" />
                  <stop offset="50%" stopColor="rgba(255, 232, 226, 0.45)" />
                  <stop offset="82%" stopColor="rgba(255, 232, 226, 0)" />
                </linearGradient>
              </defs>
              <path
                ref={ribbonPathRef}
                d={INITIAL_RIBBON_PATH}
                fill="url(#bookmark-silk-grad)"
              />
              <path
                ref={ribbonSheenPathRef}
                d={INITIAL_RIBBON_PATH}
                fill="url(#bookmark-sheen-grad)"
                style={{ opacity: 0 }}
              />
            </svg>
          </button>

          {/* STAGE CONTAINER */}
          <div
            ref={spreadRef}
            className={`relative z-[2] bg-[#efe8da] dark:bg-[#191614] rounded-[3px] shadow-inner ${
              isMobile ? 'overflow-hidden' : ''
            }`}
            style={{
              width: `${stageW}px`,
              height: `${pageH}px`,
              visibility: bookPhase === 'closed' ? 'hidden' : 'visible',
            }}
          >
            {isMobile ? (
              <div
                className="absolute top-0 left-0 z-0 isolate overflow-hidden rounded-[3px]"
                style={{ width: `${pageW}px`, height: `${pageH}px` }}
              >
                {showWelcome ? (
                  <WelcomeSpreadContent
                    side="right"
                    pageW={pageW}
                    pageH={pageH}
                    isMobile={true}
                    interactive={true}
                    locked={isLocked}
                    authBusy={authBusy}
                    authError={authError}
                    onSignInWithGoogle={onSignInWithGoogle}
                    onContinueLocal={() =>
                      triggerProgrammaticTurn('next', 'bottom')
                    }
                    onCloseBook={onCloseBook}
                    onClearAuthError={onClearAuthError}
                  />
                ) : (
                  <JournalPageContent
                    spread={currentSpread}
                    side={mobileSide}
                    spreadIndex={currentIndex}
                    pageW={pageW}
                    pageH={pageH}
                    isMobile={true}
                    isContinuation={isCurrentContinuation}
                    interactive={true}
                    locked={isLocked}
                    onUpdateSpread={(patch) =>
                      onUpdateSpread(currentIndex, patch)
                    }
                    onNewSpread={onNewSpread}
                    onOpenIndex={onOpenIndex}
                    onOpenExport={onOpenExport}
                    onOpenAccount={onOpenAccount}
                    isSignedIn={isSignedIn}
                    onCloseBook={onCloseBook}
                    onTriggerTurn={(dir) =>
                      triggerProgrammaticTurn(dir, 'bottom')
                    }
                    canTurnPrev={canTurnPrev}
                    canTurnNext={canTurnNext}
                    voiceControl={voiceControl}
                    onMenuOpenChange={setIsMenuOpen}
                    inkConfig={inkConfig}
                    inkToolbarOpen={inkToolbarOpen}
                    onToggleInkToolbar={onToggleInkToolbar}
                    onCommitInk={(pageSide, nextInk) =>
                      onCommitInk?.(currentIndex, pageSide, nextInk)
                    }
                    onPenActivity={handlePenActivity}
                    onStylusActive={(pageSide) =>
                      onStylusActive?.(currentIndex, pageSide)
                    }
                    onInkCapacityWarning={onInkCapacityWarning}
                    onPageOverflow={handlePageOverflow}
                    focusRequest={focusRequest}
                    onClearFocusRequest={onClearFocusRequest}
                  />
                )}
              </div>
            ) : (
              <>
                <div
                  className="absolute top-0 left-0 z-0 isolate overflow-hidden rounded-l-[3px]"
                  style={{ width: `${pageW}px`, height: `${pageH}px` }}
                >
                  {showWelcome ? (
                    <WelcomeSpreadContent
                      side="left"
                      pageW={pageW}
                      pageH={pageH}
                      interactive={true}
                      locked={isLocked}
                    />
                  ) : (
                    <JournalPageContent
                      spread={currentSpread}
                      side="left"
                      spreadIndex={currentIndex}
                      pageW={pageW}
                      pageH={pageH}
                      isContinuation={isCurrentContinuation}
                      interactive={true}
                      locked={isLocked}
                      onUpdateSpread={(patch) =>
                        onUpdateSpread(currentIndex, patch)
                      }
                      onTriggerTurn={(dir) =>
                        triggerProgrammaticTurn(dir, 'bottom')
                      }
                      canTurnPrev={canTurnPrev}
                      canTurnNext={canTurnNext}
                      voiceControl={voiceControl}
                      inkConfig={inkConfig}
                      inkToolbarOpen={inkToolbarOpen}
                      onToggleInkToolbar={onToggleInkToolbar}
                      onCommitInk={(pageSide, nextInk) =>
                        onCommitInk?.(currentIndex, pageSide, nextInk)
                      }
                      onPenActivity={handlePenActivity}
                      onStylusActive={(pageSide) =>
                        onStylusActive?.(currentIndex, pageSide)
                      }
                      onInkCapacityWarning={onInkCapacityWarning}
                      onPageOverflow={handlePageOverflow}
                      focusRequest={focusRequest}
                      onClearFocusRequest={onClearFocusRequest}
                    />
                  )}
                </div>

                <div
                  className="absolute top-0 z-0 isolate overflow-hidden rounded-r-[3px]"
                  style={{
                    left: `${pageW}px`,
                    width: `${pageW}px`,
                    height: `${pageH}px`,
                  }}
                >
                  {showWelcome ? (
                    <WelcomeSpreadContent
                      side="right"
                      pageW={pageW}
                      pageH={pageH}
                      interactive={true}
                      locked={isLocked}
                      authBusy={authBusy}
                      authError={authError}
                      onSignInWithGoogle={onSignInWithGoogle}
                      onContinueLocal={() =>
                        triggerProgrammaticTurn('next', 'bottom')
                      }
                      onCloseBook={onCloseBook}
                      onClearAuthError={onClearAuthError}
                    />
                  ) : (
                    <JournalPageContent
                      spread={currentSpread}
                      side="right"
                      spreadIndex={currentIndex}
                      pageW={pageW}
                      pageH={pageH}
                      interactive={true}
                      locked={isLocked}
                      onUpdateSpread={(patch) =>
                        onUpdateSpread(currentIndex, patch)
                      }
                      onNewSpread={onNewSpread}
                      onOpenIndex={onOpenIndex}
                      onOpenExport={onOpenExport}
                      onOpenAccount={onOpenAccount}
                      isSignedIn={isSignedIn}
                      onCloseBook={onCloseBook}
                      onTriggerTurn={(dir) =>
                        triggerProgrammaticTurn(dir, 'bottom')
                      }
                      canTurnPrev={canTurnPrev}
                      canTurnNext={canTurnNext}
                      voiceControl={voiceControl}
                      onMenuOpenChange={setIsMenuOpen}
                      inkConfig={inkConfig}
                      inkToolbarOpen={inkToolbarOpen}
                      onToggleInkToolbar={onToggleInkToolbar}
                      onCommitInk={(pageSide, nextInk) =>
                        onCommitInk?.(currentIndex, pageSide, nextInk)
                      }
                      onPenActivity={handlePenActivity}
                      onStylusActive={(pageSide) =>
                        onStylusActive?.(currentIndex, pageSide)
                      }
                      onInkCapacityWarning={onInkCapacityWarning}
                      onPageOverflow={handlePageOverflow}
                      focusRequest={focusRequest}
                      onClearFocusRequest={onClearFocusRequest}
                    />
                  )}
                </div>
              </>
            )}

            {/* Cast interior shadow on underlying page while cover lifts */}
            {bookPhase !== 'open' ? (
              <div
                ref={rightShadowRef}
                aria-hidden="true"
                className="pointer-events-none absolute top-0 z-20 bg-[#1a130d] dark:bg-black"
                style={{
                  left: isMobile ? '0px' : undefined,
                  right: isMobile ? undefined : '0px',
                  width: `${pageW}px`,
                  height: `${pageH}px`,
                  opacity:
                    bookPhase === 'closed' ? (isMobile ? 0.82 : 0.34) : 0,
                }}
              />
            ) : null}

            {/* REVEALED UNDERLYING PAGE (z-10, CLIPPED TO PEELED AREA) */}
            {isTurningNext && curl ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 z-10 isolate overflow-hidden rounded-r-[3px]"
                style={{
                  left: isMobile ? '0px' : `${pageW}px`,
                  width: `${pageW}px`,
                  height: `${pageH}px`,
                  clipPath: curl.underneathClip,
                }}
              >
                <JournalPageContent
                  spread={
                    showWelcome
                      ? currentSpread
                      : isMobile
                        ? mobileNextTarget.spread
                        : nextSpread
                  }
                  side={
                    showWelcome
                      ? isMobile
                        ? mobileSide
                        : 'right'
                      : isMobile
                        ? mobileNextTarget.side
                        : 'right'
                  }
                  spreadIndex={
                    showWelcome
                      ? currentIndex
                      : isMobile
                        ? mobileNextTarget.index
                        : currentIndex + 1
                  }
                  pageW={pageW}
                  pageH={pageH}
                  isMobile={isMobile}
                  isContinuation={
                    showWelcome
                      ? false
                      : isMobile
                        ? isSpreadContinuation(
                            mobileNextTarget.index,
                            mobileNextTarget.spread
                          )
                        : isSpreadContinuation(currentIndex + 1, nextSpread)
                  }
                  isSignedIn={isSignedIn}
                  interactive={false}
                />
                {renderFoldShadow()}
              </div>
            ) : null}

            {isTurningPrev &&
            curl &&
            (isMobile ? mobilePrevTarget : prevSpread) ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 left-0 z-10 isolate overflow-hidden rounded-l-[3px]"
                style={{
                  width: `${pageW}px`,
                  height: `${pageH}px`,
                  clipPath: curl.underneathClip,
                }}
              >
                <JournalPageContent
                  spread={
                    isMobile && mobilePrevTarget
                      ? mobilePrevTarget.spread
                      : prevSpread!
                  }
                  side={
                    isMobile && mobilePrevTarget ? mobilePrevTarget.side : 'left'
                  }
                  spreadIndex={
                    isMobile && mobilePrevTarget
                      ? mobilePrevTarget.index
                      : currentIndex - 1
                  }
                  pageW={pageW}
                  pageH={pageH}
                  isMobile={isMobile}
                  isContinuation={
                    isMobile && mobilePrevTarget
                      ? isSpreadContinuation(
                          mobilePrevTarget.index,
                          mobilePrevTarget.spread
                        )
                      : isSpreadContinuation(currentIndex - 1, prevSpread)
                  }
                  isSignedIn={isSignedIn}
                  interactive={false}
                />
                {renderFoldShadow()}
              </div>
            ) : null}

            {/* CENTER SPINE CREASE (DESKTOP 2-PAGE) */}
            {!isMobile ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 z-20"
                style={{
                  left: `${pageW - 2}px`,
                  width: '4px',
                  background: isDark
                    ? 'linear-gradient(to right, rgba(0,0,0,0.28), rgba(0,0,0,0.65), rgba(0,0,0,0.28))'
                    : 'linear-gradient(to right, rgba(35,24,14,0.12), rgba(35,24,14,0.32), rgba(35,24,14,0.12))',
                }}
              />
            ) : null}

            {/* FOLDED-OVER PAPER FLAP (z-30) */}
            {curl && curl.isActive ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-30 isolate"
                style={{
                  clipPath: curl.flapWrapperClip,
                  filter: `drop-shadow(${
                    curl.direction === 'next' ? '-6px' : '6px'
                  } 6px 14px rgba(18, 12, 7, ${(0.22 * curl.intensity).toFixed(
                    3
                  )}))`,
                }}
              >
                <div
                  className="absolute top-0 left-0 overflow-hidden"
                  style={{
                    width: `${pageW}px`,
                    height: `${pageH}px`,
                    transformOrigin: curl.backPageOrigin,
                    transform: curl.backPageTransform,
                    boxShadow: '0 0 1px rgba(80, 62, 42, 0.35)',
                  }}
                >
                  {curl.direction === 'next' ? (
                    <JournalPageContent
                      spread={
                        showWelcome
                          ? currentSpread
                          : isMobile
                            ? mobileNextTarget.spread
                            : nextSpread
                      }
                      side={
                        showWelcome
                          ? isMobile
                            ? mobileSide
                            : 'left'
                          : isMobile
                            ? mobileNextTarget.side
                            : 'left'
                      }
                      spreadIndex={
                        showWelcome
                          ? currentIndex
                          : isMobile
                            ? mobileNextTarget.index
                            : currentIndex + 1
                      }
                      pageW={pageW}
                      pageH={pageH}
                      isMobile={isMobile}
                      isContinuation={
                        showWelcome
                          ? false
                          : isMobile
                            ? isSpreadContinuation(
                                mobileNextTarget.index,
                                mobileNextTarget.spread
                              )
                            : isSpreadContinuation(currentIndex + 1, nextSpread)
                      }
                      isSignedIn={isSignedIn}
                      interactive={false}
                    />
                  ) : isMobile && mobilePrevTarget ? (
                    <JournalPageContent
                      spread={mobilePrevTarget.spread}
                      side={mobilePrevTarget.side}
                      spreadIndex={mobilePrevTarget.index}
                      pageW={pageW}
                      pageH={pageH}
                      isMobile={isMobile}
                      isContinuation={isSpreadContinuation(
                        mobilePrevTarget.index,
                        mobilePrevTarget.spread
                      )}
                      isSignedIn={isSignedIn}
                      interactive={false}
                    />
                  ) : prevSpread ? (
                    <JournalPageContent
                      spread={prevSpread}
                      side="right"
                      spreadIndex={currentIndex - 1}
                      pageW={pageW}
                      pageH={pageH}
                      isContinuation={isSpreadContinuation(
                        currentIndex - 1,
                        prevSpread
                      )}
                      isSignedIn={isSignedIn}
                      interactive={false}
                    />
                  ) : null}
                </div>

                <div
                  style={{
                    position: 'absolute',
                    left: `${curl.foldMidpoint.x}px`,
                    top: `${curl.foldMidpoint.y}px`,
                    width: `${Math.hypot(pageW, pageH) * 2.4}px`,
                    height: `${Math.hypot(pageW, pageH) * 2.4}px`,
                    transform: `translate(-50%, -50%) rotate(${curl.foldNormalDeg}deg)`,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: '50%',
                      width: `${Math.round(38 + curl.intensity * 32)}px`,
                      background: isDark
                        ? `linear-gradient(to right, rgba(5, 4, 3, ${(
                            0.36 * curl.intensity
                          ).toFixed(3)}) 0%, rgba(235, 222, 202, ${(
                            0.16 * curl.intensity
                          ).toFixed(3)}) 28%, rgba(235, 222, 202, ${(
                            0.05 * curl.intensity
                          ).toFixed(3)}) 62%, transparent 100%)`
                        : `linear-gradient(to right, rgba(45, 32, 18, ${(
                            0.14 * curl.intensity
                          ).toFixed(3)}) 0%, rgba(255, 252, 244, ${(
                            0.56 * curl.intensity
                          ).toFixed(3)}) 28%, rgba(255, 250, 240, ${(
                            0.16 * curl.intensity
                          ).toFixed(3)}) 62%, transparent 100%)`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            {/* INTERACTIVE CORNER & EDGE DRAG ZONES (z-40) */}
            {isOpenInteractive &&
            !isMenuOpen &&
            !(inkConfig?.drawArmed && inkConfig?.allowTouchDraw) ? (
              <>
                <div
                  role="button"
                  tabIndex={-1}
                  aria-label="Fold or click to turn to next page"
                  onPointerEnter={() => startHoverCurl('next', 'bottom')}
                  onPointerLeave={endHoverCurl}
                  onPointerDown={(e) => handleZonePointerDown(e, 'next')}
                  onPointerMove={handleZonePointerMove}
                  onPointerUp={handleZonePointerUp}
                  onPointerCancel={handleZonePointerUp}
                  className="absolute right-0 z-40 cursor-grab active:cursor-grabbing touch-none"
                  style={{
                    top: showWelcome ? '76px' : isMobile ? '168px' : '110px',
                    bottom: '92px',
                    width: inkToolbarOpen
                      ? '16px'
                      : isMobile
                        ? '34px'
                        : '40px',
                  }}
                />

                <div
                  role="button"
                  tabIndex={-1}
                  aria-label="Drag or click bottom right corner to turn page"
                  onPointerEnter={() => startHoverCurl('next', 'bottom')}
                  onPointerLeave={endHoverCurl}
                  onPointerDown={(e) =>
                    handleZonePointerDown(e, 'next', 'bottom')
                  }
                  onPointerMove={handleZonePointerMove}
                  onPointerUp={handleZonePointerUp}
                  onPointerCancel={handleZonePointerUp}
                  className="absolute right-0 bottom-0 z-40 cursor-grab active:cursor-grabbing touch-none"
                  style={{
                    width: inkToolbarOpen
                      ? '46px'
                      : isMobile
                        ? '84px'
                        : '104px',
                    height: inkToolbarOpen
                      ? '46px'
                      : isMobile
                        ? '78px'
                        : '92px',
                  }}
                />

                {canTurnPrev ? (
                  <>
                    <div
                      role="button"
                      tabIndex={-1}
                      aria-label="Fold or click to turn to previous page"
                      onPointerEnter={() => startHoverCurl('prev', 'bottom')}
                      onPointerLeave={endHoverCurl}
                      onPointerDown={(e) => handleZonePointerDown(e, 'prev')}
                      onPointerMove={handleZonePointerMove}
                      onPointerUp={handleZonePointerUp}
                      onPointerCancel={handleZonePointerUp}
                      className="absolute left-0 z-40 cursor-grab active:cursor-grabbing touch-none"
                      style={{
                        top: '132px',
                        bottom: '92px',
                        width: inkToolbarOpen
                          ? '16px'
                          : isMobile
                            ? '34px'
                            : '40px',
                      }}
                    />
                    <div
                      role="button"
                      tabIndex={-1}
                      aria-label="Drag or click bottom left corner to turn back"
                      onPointerEnter={() => startHoverCurl('prev', 'bottom')}
                      onPointerLeave={endHoverCurl}
                      onPointerDown={(e) =>
                        handleZonePointerDown(e, 'prev', 'bottom')
                      }
                      onPointerMove={handleZonePointerMove}
                      onPointerUp={handleZonePointerUp}
                      onPointerCancel={handleZonePointerUp}
                      className="absolute left-0 bottom-0 z-40 cursor-grab active:cursor-grabbing touch-none"
                      style={{
                        width: inkToolbarOpen
                          ? '46px'
                          : isMobile
                            ? '84px'
                            : '104px',
                        height: inkToolbarOpen
                          ? '46px'
                          : isMobile
                            ? '78px'
                            : '92px',
                      }}
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {/* ================= HINGED 3D FRONT COVER (OPACITY ALWAYS 1 ON PRESERVE-3D) ================= */}
        <div
          ref={coverRef}
          className="absolute top-0"
          style={{
            left: isMobile ? '0px' : `${halfBookW}px`,
            width: isMobile ? `${pageW + 22}px` : `${halfBookW}px`,
            height: `${fullBookH}px`,
            transformOrigin: 'left center',
            transformStyle: 'preserve-3d',
            willChange: 'transform',
            zIndex: 60,
          }}
        >
          {/* Front exterior cover */}
          <button
            ref={coverFrontRef}
            type="button"
            disabled={bookPhase !== 'closed'}
            onClick={bookPhase === 'closed' ? onOpenBook : undefined}
            aria-label="Open journal"
            className={`group absolute inset-0 cover-cloth book-cover-edge rounded-l-[4px] rounded-r-xl overflow-hidden flex flex-col justify-between opacity-100 ${
              isMobile ? 'p-8' : 'p-11'
            } text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c6b48] ${
              bookPhase === 'closed' ? 'cursor-pointer' : 'pointer-events-none'
            }`}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(0deg) translateZ(2px)',
            }}
          >
            {/* Spine hinge groove */}
            <div
              aria-hidden="true"
              className={`absolute inset-y-0 left-0 ${
                isMobile ? 'w-7' : 'w-9'
              }`}
              style={{
                background:
                  'linear-gradient(to right, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.12) 52%, rgba(255,220,180,0.08) 65%, transparent 100%)',
                borderRight: '1px solid rgba(0,0,0,0.35)',
              }}
            />

            {/* Debossed blind-tooled frame */}
            <div
              aria-hidden="true"
              className={`absolute ${
                isMobile ? 'inset-4 left-9' : 'inset-6 left-12'
              } rounded-sm pointer-events-none`}
              style={{
                border: '1px solid rgba(212, 180, 128, 0.28)',
                boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.25)',
              }}
            />

            {/* Subtle year stamp */}
            <div
              className={`relative z-10 ${
                isMobile ? 'pl-6 pt-1' : 'pl-8 pt-2'
              } flex items-center justify-end`}
            >
              <span className="text-xs tracking-[0.26em] text-[#d4bc96]/70 tabular-nums">
                {dateParts.year || '2026'}
              </span>
            </div>

            {/* Stamped gold-foil serif title */}
            <div
              className={`relative z-10 ${
                isMobile ? 'pl-6' : 'pl-8'
              } my-auto flex flex-col items-start`}
            >
              <h1
                className={`font-serif ${
                  isMobile ? 'text-4xl' : 'text-[42px]'
                } leading-none font-normal tracking-tight text-[#e8d5b3]`}
                style={{
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.45)',
                }}
              >
                Journal
              </h1>
              <div className="mt-4 w-12 h-px bg-[#d4b480]/35" />
              <p className="mt-3 font-serif italic text-base text-[#cbb086]/80">
                {dateParts.monthDay}
              </p>
            </div>

            {/* Quiet open cue */}
            <div
              className={`relative z-10 ${
                isMobile ? 'pl-6' : 'pl-8'
              } pb-1 flex items-center justify-end`}
            >
              <span className="text-xs tracking-wide text-[#dcc49e]/75 group-hover:text-[#f2dfc0] transition-colors">
                Open →
              </span>
            </div>
          </button>

          {/* Back interior face (carries Left Page cleanly without 3D textarea jitter) */}
          {isMobile ? (
            <div
              ref={mobileBackFaceRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 cover-cloth rounded-r-xl rounded-l-none p-[11px] pl-0"
              style={{
                backfaceVisibility: 'visible',
                WebkitBackfaceVisibility: 'visible',
                transform: 'rotateY(180deg) translateZ(2px)',
              }}
            >
              <div className="w-full h-full rounded-r-[3px] mobile-back-paper" />
            </div>
          ) : (
            <div
              ref={coverBackRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 cover-cloth book-frame-edge rounded-l-xl rounded-r-none"
              style={{
                backfaceVisibility: 'visible',
                WebkitBackfaceVisibility: 'visible',
                transform: 'rotateY(180deg) translateZ(2px)',
                paddingTop: '11px',
                paddingBottom: '11px',
                paddingLeft: '11px',
                paddingRight: '0px',
              }}
            >
              <div className="pointer-events-none absolute top-[14px] bottom-[14px] left-[6px] w-[5px] rounded-l-sm paper-stack-left" />
              <div
                className="relative overflow-hidden rounded-l-[3px]"
                style={{ width: `${pageW}px`, height: `${pageH}px` }}
              >
                {showWelcome ? (
                  <WelcomeSpreadContent
                    side="left"
                    pageW={pageW}
                    pageH={pageH}
                    interactive={false}
                  />
                ) : (
                  <JournalPageContent
                    spread={currentSpread}
                    side="left"
                    spreadIndex={currentIndex}
                    pageW={pageW}
                    pageH={pageH}
                    isContinuation={isCurrentContinuation}
                    interactive={false}
                    isSignedIn={isSignedIn}
                    showEmptyPlaceholders={true}
                    showCornerSheen={true}
                    canTurnPrev={canTurnPrev}
                    canTurnNext={canTurnNext}
                  />
                )}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 w-[2px] z-20"
                  style={{
                    background: isDark
                      ? 'linear-gradient(to right, rgba(0,0,0,0.26), rgba(0,0,0,0.6))'
                      : 'linear-gradient(to right, rgba(35,24,14,0.12), rgba(35,24,14,0.32))',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
