import { CurlRuntimeState } from '../types/pageCurl';

/** Idle state reset when no page corner hover, drag, or turn animation is active. */
export const IDLE_CURL: CurlRuntimeState = {
  active: false,
  mode: 'idle',
  direction: 'next',
  corner: 'bottom',
  pointer: { x: 0, y: 0 },
};

/** Gesture thresholds, GSAP turn durations, and palm-guard timings for page curls. */
export const PAGE_CURL_CONFIG = {
  DEFAULT_TURN_DURATION_SEC: 1.05,
  OVERFLOW_TURN_DURATION_SEC: 0.48,
  HOVER_IN_DURATION_SEC: 0.34,
  HOVER_OUT_DURATION_SEC: 0.32,
  HOVER_OFFSET_X: 36,
  HOVER_OFFSET_Y: 28,
  INITIAL_DRAG_OFFSET_X: 28,
  INITIAL_DRAG_OFFSET_Y: 22,
  PROGRAMMATIC_START_OFFSET_X: 24,
  PROGRAMMATIC_START_OFFSET_Y: 18,
  MOVE_THRESHOLD_PX: 6,
  FLICK_VELOCITY_THRESHOLD: 0.45,
  COMMIT_PROGRESS_THRESHOLD: 0.28,
  FLICK_MIN_PROGRESS: 0.08,
  PALM_GUARD_MS: 450,
  TOP_CORNER_RATIO: 0.42,
  MIDDLE_EDGE_MIN_RATIO: 0.36,
  MIDDLE_EDGE_MAX_RATIO: 0.64,
  MIDDLE_EDGE_Y_DAMPING: 0.48,
  MAX_ARC_LIFT_PX: 92,
  ARC_LIFT_HEIGHT_RATIO: 0.155,
  MIN_COMPLETE_DURATION_SEC: 0.42,
  MAX_COMPLETE_DURATION_SEC: 0.9,
  MIN_RETURN_DURATION_SEC: 0.32,
  MAX_RETURN_DURATION_SEC: 0.64,
} as const;
