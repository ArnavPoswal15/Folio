/** Props accepted by the dumb BookmarkRibbon SVG component. */
export interface BookmarkRibbonProps {
  isMobile: boolean;
  /** Increment or change to trigger a gentle reactive sway when pages turn or book opens/closes */
  motionPulseKey?: string | number;
}

/** Spring physics state vector updated inside the rAF ribbon simulation loop. */
export interface RibbonPhysics {
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

/** Derived SVG path strings and dynamic lighting opacities computed each frame. */
export interface RibbonPaths {
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

/** Pointer drag gesture metadata stored in a ref during bookmark ribbon tugging. */
export interface RibbonDragMeta {
  pointerId: number | null;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastTimeMs: number;
  flingVelX: number;
  hasMoved: boolean;
}
