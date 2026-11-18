/** Classic bookmark ribbon dimensions and damped spring constants (master PageCurlStage). */
export const BOOKMARK_RIBBON_CONFIG = {
  /** Rubber-band length scale — larger = looser pull */
  L: 68,
  W: 16,
  /** 8px tucked in binding + ~28px hanging below */
  BASE_LENGTH: 36,
  /** Spring stiffness */
  K: 260,
  /** Low damping ratio for lively bounce on release */
  ZETA: 0.2,
  DRAG_MOVE_THRESHOLD_PX: 4,
  SWAY_MAX: 14,
  SWAY_INPUT_SCALE: 65,
  TAP_PULL: 22,
  KEY_PULL: 26,
} as const;