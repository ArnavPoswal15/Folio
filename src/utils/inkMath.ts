import {
  INK_GRID_MAX,
  INK_HIGHLIGHTER_ERASE_PAD,
  INK_PEN_ERASE_WIDTH_MULT,
  INK_RDP_EPSILON,
  INK_RDP_PRESSURE_TOLERANCE,
} from '../constants/ink';
import { InkPoint, InkStroke } from '../types/ink';

/**
 * Computes squared Euclidean distance from point (px, py) to segment (ax, ay)-(bx, by).
 * @param px - Point X coordinate.
 * @param py - Point Y coordinate.
 * @param ax - Segment start X coordinate.
 * @param ay - Segment start Y coordinate.
 * @param bx - Segment end X coordinate.
 * @param by - Segment end Y coordinate.
 * @returns Squared distance between point and closest segment point.
 */
export function pointToSegmentDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ox = px - ax;
    const oy = py - ay;
    return ox * ox + oy * oy;
  }
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq)
  );
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const ox = px - projX;
  const oy = py - projY;
  return ox * ox + oy * oy;
}

/**
 * Runs Ramer-Douglas-Peucker simplification with optional pressure-profile preservation.
 * @param points - Ordered input stroke points.
 * @param epsilon - Spatial error tolerance in normalized grid units.
 * @param pressureTolerance - Maximum allowed pressure interpolation deviation (0 disables check).
 * @returns Simplified array of InkPoint tuples.
 */
function rdpSimplify(
  points: InkPoint[],
  epsilon: number,
  pressureTolerance = 0
): InkPoint[] {
  if (points.length <= 2) return points;
  const epsSq = epsilon * epsilon;
  let maxDistSq = 0;
  let maxPressureDiff = 0;
  let splitIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];
  const segDx = last[0] - first[0];
  const segDy = last[1] - first[1];
  const segLenSq = segDx * segDx + segDy * segDy;

  for (let i = 1; i < points.length - 1; i++) {
    const distSq = pointToSegmentDistSq(
      points[i][0],
      points[i][1],
      first[0],
      first[1],
      last[0],
      last[1]
    );

    let pressureExceeded = false;
    if (pressureTolerance > 0) {
      const t =
        segLenSq > 0
          ? Math.max(
              0,
              Math.min(
                1,
                ((points[i][0] - first[0]) * segDx +
                  (points[i][1] - first[1]) * segDy) /
                  segLenSq
              )
            )
          : i / (points.length - 1);
      const interpP = first[2] + (last[2] - first[2]) * t;
      const pDiff = Math.abs(points[i][2] - interpP);
      if (pDiff > pressureTolerance && pDiff > maxPressureDiff) {
        maxPressureDiff = pDiff;
        pressureExceeded = true;
      }
    }

    if (distSq > maxDistSq || (pressureExceeded && maxDistSq <= epsSq)) {
      maxDistSq = Math.max(maxDistSq, distSq);
      splitIdx = i;
    }
  }

  if (
    maxDistSq > epsSq ||
    (pressureTolerance > 0 && maxPressureDiff > pressureTolerance)
  ) {
    const left = rdpSimplify(
      points.slice(0, splitIdx + 1),
      epsilon,
      pressureTolerance
    );
    const right = rdpSimplify(
      points.slice(splitIdx),
      epsilon,
      pressureTolerance
    );
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

/**
 * Simplifies a completed stroke in normalized grid space while optionally keeping calligraphic pressure swells.
 * @param points - Raw captured InkPoint sequence.
 * @param preservePressureProfile - When true, protects mid-stroke pressure swells from being flattened.
 * @returns Simplified InkPoint array.
 */
export function simplifyInkPoints(
  points: InkPoint[],
  preservePressureProfile = false
): InkPoint[] {
  if (points.length <= 3) return points;
  return rdpSimplify(
    points,
    INK_RDP_EPSILON,
    preservePressureProfile ? INK_RDP_PRESSURE_TOLERANCE : 0
  );
}

/**
 * Hit-tests an eraser pointer segment against a stored InkStroke using bounding-box culling and segment distance.
 * @param stroke - Stored stroke to test.
 * @param ax - Eraser drag start X (0..10000).
 * @param ay - Eraser drag start Y (0..10000).
 * @param bx - Eraser drag end X (0..10000).
 * @param by - Eraser drag end Y (0..10000).
 * @param eraserRadiusNorm - Eraser hit radius in normalized grid units.
 * @returns True if the eraser path intersects the stroke.
 */
export function hitTestStrokeEraser(
  stroke: InkStroke,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  eraserRadiusNorm: number
): boolean {
  const pts = stroke.points;
  if (pts.length === 0) return false;

  const extra =
    stroke.tool === 'highlighter'
      ? eraserRadiusNorm + INK_HIGHLIGHTER_ERASE_PAD
      : eraserRadiusNorm + stroke.width * INK_PEN_ERASE_WIDTH_MULT;
  const minSegX = Math.min(ax, bx) - extra;
  const maxSegX = Math.max(ax, bx) + extra;
  const minSegY = Math.min(ay, by) - extra;
  const maxSegY = Math.max(ay, by) + extra;

  let minX = INK_GRID_MAX;
  let maxX = 0;
  let minY = INK_GRID_MAX;
  let maxY = 0;
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0];
    const y = pts[i][1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (maxX < minSegX || minX > maxSegX || maxY < minSegY || minY > maxSegY) {
    return false;
  }

  const thresholdSq = extra * extra;
  if (pts.length === 1) {
    return (
      pointToSegmentDistSq(pts[0][0], pts[0][1], ax, ay, bx, by) <= thresholdSq
    );
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const [p1x, p1y] = pts[i];
    const [p2x, p2y] = pts[i + 1];
    if (
      pointToSegmentDistSq(p1x, p1y, ax, ay, bx, by) <= thresholdSq ||
      pointToSegmentDistSq(p2x, p2y, ax, ay, bx, by) <= thresholdSq ||
      pointToSegmentDistSq(bx, by, p1x, p1y, p2x, p2y) <= thresholdSq
    ) {
      return true;
    }
  }

  return false;
}
