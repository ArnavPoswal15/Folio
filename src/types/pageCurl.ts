import { JournalSpread } from './journal';

/** 2D point in stage or local page coordinates. */
export interface Point {
  x: number;
  y: number;
}

/** Page turn direction relative to the open spread. */
export type TurnDirection = 'next' | 'prev';

/** Corner anchor from which a page curl originates. */
export type CornerAnchor = 'top' | 'bottom';

/** Computed CSS clip polygons, transform, and fold shadow geometry for a curling page. */
export interface CurlGeometry {
  isActive: boolean;
  direction: TurnDirection;
  corner: CornerAnchor;
  anchor: Point;
  pointer: Point;
  /** Progress 0..1 */
  progress: number;
  /** Polygon in local page coordinates [0..W, 0..H] for revealing the underlying page */
  underneathClip: string;
  /** Polygon in spread/stage coordinates for clipping the folded-over flap at the fold crease */
  flapWrapperClip: string;
  /** CSS transform string for the backside page (W x H) inside the flap wrapper */
  backPageTransform: string;
  /** CSS transform-origin string for the backside page */
  backPageOrigin: string;
  /** Fold line midpoint in stage coordinates */
  foldMidpoint: Point;
  /** Fold line midpoint in local page coordinates (for underlying page shadow) */
  foldMidpointLocal: Point;
  /** Fold line normal angle in degrees (pointing from A toward P) */
  foldNormalDeg: number;
  /** Visual intensity 0..1 for shadows & curl highlight */
  intensity: number;
}

/** Interactive curl phase state stored in usePageCurl. */
export type CurlMode = 'idle' | 'hover' | 'dragging' | 'animating';

/** Current curl runtime snapshot driving CurlFlapOverlay. */
export interface CurlRuntimeState {
  active: boolean;
  mode: CurlMode;
  direction: TurnDirection;
  corner: CornerAnchor;
  pointer: Point;
}

/** Active pointer drag tracking state stored in a ref during corner/edge page drags. */
export interface CurlDragInfo {
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
}

/** Resolved page snapshot rendered onto an underlying or folded curl surface. */
export interface CurlPageDescriptor {
  spread: JournalSpread;
  side: 'left' | 'right';
  spreadIndex: number;
  isContinuation: boolean;
}

/** Bundle of resolved next, previous, and folded flap descriptors for PageCurlStage. */
export interface CurlStageDescriptors {
  isCurrentContinuation: boolean;
  nextReveal: CurlPageDescriptor | null;
  prevReveal: CurlPageDescriptor | null;
  flapBack: CurlPageDescriptor | null;
}
