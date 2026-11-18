import gsap from 'gsap';
import { useCallback, useEffect, useRef } from 'react';
import { BOOK_COVER_CONFIG } from '../constants/book';
import { BookCoverRefs, BookPhase } from '../types/book';
import { prefersReducedMotion } from '../utils/viewport';

/** Options accepted by the useBookCoverAnimation hook. */
interface UseBookCoverAnimationOptions {
  bookPhase: BookPhase;
  pageW: number;
  pageH: number;
  isMobile: boolean;
  onOpenComplete: () => void;
  onCloseComplete: () => void;
  onBeforeClose?: () => void;
}

/**
 * Orchestrates 3D GSAP cover opening/closing choreography, desk shadow expansion, and mobile cover Z-occlusion.
 * @param options - Current book phase, responsive page geometry, and completion callbacks.
 * @returns BookCoverRefs forwarded to BookFrameChrome and BookCover DOM nodes.
 */
export function useBookCoverAnimation({
  bookPhase,
  pageW,
  pageH,
  isMobile,
  onOpenComplete,
  onCloseComplete,
  onBeforeClose,
}: UseBookCoverAnimationOptions): BookCoverRefs {
  const bookWrapperRef = useRef<HTMLDivElement | null>(null);
  const deskShadowRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const coverRef = useRef<HTMLDivElement | null>(null);
  const coverFrontRef = useRef<HTMLButtonElement | null>(null);
  const coverBackRef = useRef<HTMLDivElement | null>(null);
  const mobileBackFaceRef = useRef<HTMLDivElement | null>(null);
  const rightShadowRef = useRef<HTMLDivElement | null>(null);

  const coverProgressRef = useRef<{ p: number }>({ p: 0 });
  const coverTweenRef = useRef<gsap.core.Tween | null>(null);

  const halfBookW = pageW + BOOK_COVER_CONFIG.FRAME_PAD_HALF_PX;
  const poseMetricsRef = useRef({ halfBookW, isMobile, pageW });
  poseMetricsRef.current = { halfBookW, isMobile, pageW };

  const onBeforeCloseRef = useRef(onBeforeClose);
  onBeforeCloseRef.current = onBeforeClose;

  const applyCoverPose = useCallback((p: number, phase: BookPhase) => {
    const cfg = BOOK_COVER_CONFIG;
    const {
      halfBookW: hbw,
      isMobile: mobile,
      pageW: pw,
    } = poseMetricsRef.current;
    const clamped = Math.max(0, Math.min(1, p));
    const angle = mobile
      ? clamped * cfg.MOBILE_OPEN_ANGLE_DEG
      : clamped * cfg.DESKTOP_OPEN_ANGLE_DEG;
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
      const targetX = mobile
        ? 0
        : (-(pw + cfg.FRAME_PAD_HALF_PX) / 2) * (1 - clamped);
      gsap.set(wrapper, { x: targetX });
    }

    if (deskShadow) {
      if (mobile) {
        gsap.set(deskShadow, { scaleX: 1, z: cfg.DESK_SHADOW_Z });
      } else {
        const leftReach = Math.max(0, -Math.cos(clamped * Math.PI));
        gsap.set(deskShadow, {
          scaleX: 0.5 + 0.5 * leftReach,
          z: cfg.DESK_SHADOW_Z,
        });
      }
    }

    if (frame) {
      if (
        mobile ||
        phase === 'open' ||
        clamped >= cfg.DESKTOP_CLIP_RELEASE_P
      ) {
        frame.style.clipPath = 'none';
      } else {
        frame.style.clipPath = `inset(-80px -120px -180px ${hbw}px)`;
      }
    }

    if (cover) {
      if (phase === 'open') {
        cover.style.visibility = 'hidden';
        cover.style.pointerEvents = 'none';
        gsap.set(cover, {
          rotateY: mobile
            ? cfg.MOBILE_OPEN_ANGLE_DEG
            : cfg.DESKTOP_OPEN_ANGLE_DEG,
          z: cfg.COVER_Z,
        });
      } else {
        cover.style.visibility = 'visible';
        cover.style.pointerEvents = phase === 'closed' ? '' : 'none';
        gsap.set(cover, { rotateY: angle, z: cfg.COVER_Z });
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
        clamped <= cfg.MOBILE_BACK_FADE_START_P
          ? 1
          : Math.max(
              0,
              1 -
                (clamped - cfg.MOBILE_BACK_FADE_START_P) /
                  cfg.MOBILE_BACK_FADE_SPAN_P
            );
      mobileBack.style.opacity = pastNinety ? fadeOut.toFixed(3) : '0';
    }

    if (rightShadow) {
      const shadowOpacity = mobile
        ? Math.max(
            0,
            cfg.MOBILE_SHADOW_MAX_OPACITY *
              Math.pow(
                Math.max(0, 1 - clamped / cfg.MOBILE_SHADOW_CLEAR_P),
                cfg.MOBILE_SHADOW_GAMMA
              )
          )
        : Math.max(
            0,
            cfg.DESKTOP_SHADOW_MAX_OPACITY *
              (1 - clamped / cfg.DESKTOP_SHADOW_CLEAR_P)
          );
      rightShadow.style.opacity = shadowOpacity.toFixed(3);
    }
  }, []);

  useEffect(() => {
    const cfg = BOOK_COVER_CONFIG;
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
        duration: isMobile
          ? cfg.MOBILE_OPEN_DURATION_SEC
          : cfg.DESKTOP_OPEN_DURATION_SEC,
        ease: 'power2.inOut',
        onUpdate: () => applyCoverPose(coverProgressRef.current.p, 'opening'),
        onComplete: () => {
          applyCoverPose(1, 'open');
          onOpenComplete();
        },
      });
    } else if (bookPhase === 'closing') {
      onBeforeCloseRef.current?.();
      coverProgressRef.current.p = 1;
      applyCoverPose(1, 'closing');
      coverTweenRef.current = gsap.to(coverProgressRef.current, {
        p: 0,
        duration: isMobile
          ? cfg.MOBILE_CLOSE_DURATION_SEC
          : cfg.DESKTOP_CLOSE_DURATION_SEC,
        ease: 'power2.inOut',
        onUpdate: () => applyCoverPose(coverProgressRef.current.p, 'closing'),
        onComplete: () => {
          applyCoverPose(0, 'closed');
          onCloseComplete();
        },
      });
    }
  }, [applyCoverPose, bookPhase, isMobile, onCloseComplete, onOpenComplete]);

  useEffect(() => {
    if (bookPhase === 'closed') applyCoverPose(0, 'closed');
    else if (bookPhase === 'open') applyCoverPose(1, 'open');
    else applyCoverPose(coverProgressRef.current.p, bookPhase);
  }, [applyCoverPose, bookPhase, pageW, pageH, isMobile]);

  useEffect(() => {
    return () => {
      coverTweenRef.current?.kill();
    };
  }, []);

  return {
    bookWrapperRef,
    deskShadowRef,
    frameRef,
    coverRef,
    coverFrontRef,
    coverBackRef,
    mobileBackFaceRef,
    rightShadowRef,
  };
}
