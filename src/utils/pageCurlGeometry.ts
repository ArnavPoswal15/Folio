export interface Point {
  x: number;
  y: number;
}

export type TurnDirection = 'next' | 'prev';
export type CornerAnchor = 'top' | 'bottom';

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

/**
 * Clips a convex polygon against half-plane: (Q - M) · n >= 0 (if keepPositive)
 * or <= 0 (if !keepPositive).
 */
function clipPolygonHalfPlane(
  poly: Point[],
  M: Point,
  n: Point,
  keepPositive: boolean
): Point[] {
  if (poly.length === 0) return [];
  const sign = keepPositive ? 1 : -1;
  const evalFn = (p: Point) => sign * ((p.x - M.x) * n.x + (p.y - M.y) * n.y);

  const output: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const currVal = evalFn(curr);
    const prevVal = evalFn(prev);

    const currIn = currVal >= -1e-5;
    const prevIn = prevVal >= -1e-5;

    if (currIn) {
      if (!prevIn) {
        const denom = prevVal - currVal;
        const t = Math.abs(denom) < 1e-8 ? 0 : prevVal / denom;
        output.push({
          x: prev.x + t * (curr.x - prev.x),
          y: prev.y + t * (curr.y - prev.y),
        });
      }
      output.push(curr);
    } else if (prevIn) {
      const denom = prevVal - currVal;
      const t = Math.abs(denom) < 1e-8 ? 0 : prevVal / denom;
      output.push({
        x: prev.x + t * (curr.x - prev.x),
        y: prev.y + t * (curr.y - prev.y),
      });
    }
  }
  return output;
}

function toCssPolygon(points: Point[], offsetX = 0, offsetY = 0): string {
  if (points.length < 3) return 'polygon(0px 0px, 0px 0px, 0px 0px)';
  return `polygon(${points
    .map((p) => `${(p.x - offsetX).toFixed(2)}px ${(p.y - offsetY).toFixed(2)}px`)
    .join(', ')})`;
}

function getSpineX(
  direction: TurnDirection,
  pageW: number,
  isSinglePage: boolean
): number {
  if (isSinglePage) {
    return direction === 'next' ? 0 : pageW;
  }
  return pageW;
}

export function getAnchorPoint(
  direction: TurnDirection,
  corner: CornerAnchor,
  pageW: number,
  pageH: number,
  isSinglePage = false
): Point {
  if (isSinglePage) {
    return {
      x: direction === 'next' ? pageW : 0,
      y: corner === 'bottom' ? pageH : 0,
    };
  }
  return {
    x: direction === 'next' ? 2 * pageW : 0,
    y: corner === 'bottom' ? pageH : 0,
  };
}

export function getTargetPoint(
  direction: TurnDirection,
  corner: CornerAnchor,
  pageW: number,
  pageH: number,
  isSinglePage = false
): Point {
  if (isSinglePage) {
    return {
      x: direction === 'next' ? -pageW : 2 * pageW,
      y: corner === 'bottom' ? pageH : 0,
    };
  }
  return {
    x: direction === 'next' ? 0 : 2 * pageW,
    y: corner === 'bottom' ? pageH : 0,
  };
}

/**
 * Enforces physical paper spine constraints so the turning sheet never detaches from the binding.
 */
export function clampToBookSpine(
  rawP: Point,
  direction: TurnDirection,
  corner: CornerAnchor,
  pageW: number,
  pageH: number,
  isSinglePage = false
): Point {
  if (pageW <= 0 || pageH <= 0) return { x: 0, y: 0 };

  const spineX = getSpineX(direction, pageW, isSinglePage);
  const anchor = getAnchorPoint(direction, corner, pageW, pageH, isSinglePage);

  const safeX = Number.isFinite(rawP.x) ? rawP.x : anchor.x;
  const safeY = Number.isFinite(rawP.y) ? rawP.y : anchor.y;

  const sNear: Point = {
    x: spineX,
    y: corner === 'bottom' ? pageH : 0,
  };
  const sFar: Point = {
    x: spineX,
    y: corner === 'bottom' ? 0 : pageH,
  };
  const maxNear = pageW;
  const maxFar = Math.hypot(pageW, pageH);

  const minX = isSinglePage && direction === 'next' ? -pageW : 0;
  const maxX = 2 * pageW;

  let px = Math.max(minX, Math.min(maxX, safeX));
  let py = corner === 'bottom' ? Math.min(pageH, safeY) : Math.max(0, safeY);

  for (let iter = 0; iter < 4; iter++) {
    const dx1 = px - sNear.x;
    const dy1 = py - sNear.y;
    const d1 = Math.hypot(dx1, dy1);
    if (d1 > maxNear && d1 > 1e-5) {
      px = sNear.x + (dx1 / d1) * maxNear;
      py = sNear.y + (dy1 / d1) * maxNear;
    }

    const dx2 = px - sFar.x;
    const dy2 = py - sFar.y;
    const d2 = Math.hypot(dx2, dy2);
    if (d2 > maxFar && d2 > 1e-5) {
      px = sFar.x + (dx2 / d2) * maxFar;
      py = sFar.y + (dy2 / d2) * maxFar;
    }

    py = corner === 'bottom' ? Math.min(pageH, py) : Math.max(0, py);
  }

  px = Math.max(minX, Math.min(maxX, px));
  return { x: px, y: py };
}

export function computeCurlGeometry(
  rawPointer: Point,
  direction: TurnDirection,
  corner: CornerAnchor,
  pageW: number,
  pageH: number,
  isSinglePage = false
): CurlGeometry {
  const A = getAnchorPoint(direction, corner, pageW, pageH, isSinglePage);

  if (pageW <= 0 || pageH <= 0) {
    return {
      isActive: false,
      direction,
      corner,
      anchor: A,
      pointer: A,
      progress: 0,
      underneathClip: 'polygon(0px 0px, 0px 0px, 0px 0px)',
      flapWrapperClip: 'polygon(0px 0px, 0px 0px, 0px 0px)',
      backPageTransform: 'translate(0px, 0px)',
      backPageOrigin: '0px 0px',
      foldMidpoint: A,
      foldMidpointLocal: { x: 0, y: 0 },
      foldNormalDeg: 0,
      intensity: 0,
    };
  }

  const P = clampToBookSpine(rawPointer, direction, corner, pageW, pageH, isSinglePage);

  const nx = P.x - A.x;
  const ny = P.y - A.y;
  const dist = Math.hypot(nx, ny);

  if (dist < 1.5) {
    return {
      isActive: false,
      direction,
      corner,
      anchor: A,
      pointer: A,
      progress: 0,
      underneathClip: 'polygon(0px 0px, 0px 0px, 0px 0px)',
      flapWrapperClip: 'polygon(0px 0px, 0px 0px, 0px 0px)',
      backPageTransform: 'translate(0px, 0px)',
      backPageOrigin: '0px 0px',
      foldMidpoint: A,
      foldMidpointLocal: {
        x: isSinglePage ? (direction === 'next' ? pageW : 0) : direction === 'next' ? pageW : 0,
        y: A.y,
      },
      foldNormalDeg: 0,
      intensity: 0,
    };
  }

  const M: Point = {
    x: (A.x + P.x) / 2,
    y: (A.y + P.y) / 2,
  };
  const n: Point = { x: nx, y: ny };

  const progress = Math.min(1, Math.max(0, Math.abs(P.x - A.x) / (2 * pageW)));
  const intensity = Math.sin(Math.min(1, progress) * Math.PI);

  const pageOffsetX = isSinglePage ? 0 : direction === 'next' ? pageW : 0;

  const pageRect: Point[] = [
    { x: pageOffsetX, y: 0 },
    { x: pageOffsetX + pageW, y: 0 },
    { x: pageOffsetX + pageW, y: pageH },
    { x: pageOffsetX, y: pageH },
  ];

  const outerBox: Point[] = [
    { x: -2 * pageW, y: -pageH },
    { x: 3 * pageW, y: -pageH },
    { x: 3 * pageW, y: 2 * pageH },
    { x: -2 * pageW, y: 2 * pageH },
  ];

  const underneathPoly = clipPolygonHalfPlane(pageRect, M, n, false);
  const flapPoly = clipPolygonHalfPlane(outerBox, M, n, true);

  let backPageTransform = '';
  let backPageOrigin = '';

  if (direction === 'next') {
    const alpha = Math.atan2(A.y - P.y, A.x - P.x);
    const rotDeg = (2 * alpha * 180) / Math.PI;
    if (corner === 'bottom') {
      backPageOrigin = `0px ${pageH}px`;
      backPageTransform = `translate(${P.x.toFixed(2)}px, ${(P.y - pageH).toFixed(2)}px) rotate(${rotDeg.toFixed(3)}deg)`;
    } else {
      backPageOrigin = '0px 0px';
      backPageTransform = `translate(${P.x.toFixed(2)}px, ${P.y.toFixed(2)}px) rotate(${rotDeg.toFixed(3)}deg)`;
    }
  } else {
    const alpha = Math.atan2(P.y - A.y, P.x - A.x);
    const rotDeg = (2 * alpha * 180) / Math.PI;
    if (corner === 'bottom') {
      backPageOrigin = `${pageW}px ${pageH}px`;
      backPageTransform = `translate(${(P.x - pageW).toFixed(2)}px, ${(P.y - pageH).toFixed(2)}px) rotate(${rotDeg.toFixed(3)}deg)`;
    } else {
      backPageOrigin = `${pageW}px 0px`;
      backPageTransform = `translate(${(P.x - pageW).toFixed(2)}px, ${P.y.toFixed(2)}px) rotate(${rotDeg.toFixed(3)}deg)`;
    }
  }

  const foldNormalDeg = (Math.atan2(ny, nx) * 180) / Math.PI;

  return {
    isActive: true,
    direction,
    corner,
    anchor: A,
    pointer: P,
    progress,
    underneathClip: toCssPolygon(underneathPoly, pageOffsetX, 0),
    flapWrapperClip: toCssPolygon(flapPoly, 0, 0),
    backPageTransform,
    backPageOrigin,
    foldMidpoint: M,
    foldMidpointLocal: { x: M.x - pageOffsetX, y: M.y },
    foldNormalDeg,
    intensity: Math.max(0.16, intensity),
  };
}
