/** Viewport breakpoint and page aspect-ratio layout constants. */
export const VIEWPORT_LAYOUT = {
  DEFAULT_WIDTH: 1440,
  DEFAULT_HEIGHT: 900,
  MOBILE_BREAKPOINT_PX: 768,
  LANDSCAPE_MAX_HEIGHT_PX: 520,
  LANDSCAPE_MAX_WIDTH_PX: 1024,
  MOBILE_ASPECT: 0.67,
  DESKTOP_ASPECT: 0.758,
  MOBILE_MIN_W: 180,
  MOBILE_MAX_W: 440,
  MOBILE_MARGIN_X: 40,
  MOBILE_MARGIN_Y: 128,
  LANDSCAPE_MARGIN_Y: 84,
  DESKTOP_MARGIN_X: 64,
  DESKTOP_MARGIN_Y: 134,
  DESKTOP_MIN_W: 250,
  DESKTOP_MAX_W: 480,
  FRAME_GUTTER_PX: 24,
  FRAME_PAD_PX: 22,
} as const;

/** Numbered onboarding steps displayed on the Welcome spread. */
export const WELCOME_ONBOARDING_STEPS: ReadonlyArray<{
  num: string;
  text: string;
}> = [
  { num: '01.', text: 'Write in ink on ruled, dotted, or blank pages' },
  { num: '02.', text: 'Drag or click any corner to turn pages smoothly' },
  { num: '03.', text: 'Sign in with Google to keep entries synced everywhere' },
];
