/** Props accepted by the BookmarkRibbon control. */
export interface BookmarkRibbonProps {
  isMobile: boolean;
}

/** Simulation state for the damped spring bookmark ribbon. */
export interface RibbonSimState {
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
}

export interface RibbonPathFrame {
  d: string;
  sheenOpacity: number;
}