import {
  INK_PALETTE,
  InkDrawToolType,
  InkPaletteId,
  InkWidthPreset,
  SPREAD_LIMITS,
} from '../types/journal';

export const INK_GRID_MAX = 10000;

/** Quantized point: [x (0..10000), y (0..10000), pressure (0..100)] */
export type InkPoint = [number, number, number];

export interface InkStroke {
  id: string;
  tool: InkDrawToolType;
  color: InkPaletteId;
  width: InkWidthPreset;
  points: InkPoint[];
}

type CompactToolCode = 'p' | 'f' | 'h';
type CompactColorCode = 'c' | 'm' | 's' | 'b' | 'g' | 'a';
type CompactStrokeTuple = [
  string,
  CompactToolCode,
  CompactColorCode,
  InkWidthPreset,
  number[],
];

interface CompactInkDoc {
  v: 1;
  s: CompactStrokeTuple[];
}

const TOOL_TO_CODE: Record<InkDrawToolType, CompactToolCode> = {
  pen: 'p',
  fountain: 'f',
  highlighter: 'h',
};

const CODE_TO_TOOL: Record<CompactToolCode, InkDrawToolType> = {
  p: 'pen',
  f: 'fountain',
  h: 'highlighter',
};

const COLOR_TO_CODE: Record<InkPaletteId, CompactColorCode> = {
  charcoal: 'c',
  midnight: 'm',
  sepia: 's',
  burgundy: 'b',
  sage: 'g',
  amber: 'a',
};

const CODE_TO_COLOR: Record<CompactColorCode, InkPaletteId> = {
  c: 'charcoal',
  m: 'midnight',
  s: 'sepia',
  b: 'burgundy',
  g: 'sage',
  a: 'amber',
};

function clampInt(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function createInkStrokeId(): string {
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function parseInkStrokes(raw: string | undefined): InkStroke[] {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw) as Partial<CompactInkDoc>;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.s)) return [];

    const out: InkStroke[] = [];
    for (const item of parsed.s) {
      if (!Array.isArray(item) || item.length < 5) continue;
      const [id, toolCode, colorCode, widthRaw, flat] = item;
      if (typeof id !== 'string' || !Array.isArray(flat) || flat.length < 3) {
        continue;
      }
      const tool = CODE_TO_TOOL[toolCode as CompactToolCode] ?? 'pen';
      const color = CODE_TO_COLOR[colorCode as CompactColorCode] ?? 'charcoal';
      const width: InkWidthPreset =
        widthRaw === 1 || widthRaw === 3 ? widthRaw : 2;

      const points: InkPoint[] = [];
      for (let i = 0; i + 2 < flat.length; i += 3) {
        const x = clampInt(Number(flat[i]), 0, INK_GRID_MAX);
        const y = clampInt(Number(flat[i + 1]), 0, INK_GRID_MAX);
        const p = clampInt(Number(flat[i + 2]), 5, 100);
        points.push([x, y, p]);
      }

      if (points.length > 0) {
        out.push({ id, tool, color, width, points });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeInkStrokes(strokes: InkStroke[]): {
  encoded: string;
  atCapacity: boolean;
} {
  if (strokes.length === 0) {
    return { encoded: '', atCapacity: false };
  }

  const encodeSubset = (list: InkStroke[]): string => {
    const doc: CompactInkDoc = {
      v: 1,
      s: list.map((stroke) => {
        const flat: number[] = [];
        for (const [x, y, p] of stroke.points) {
          flat.push(
            clampInt(x, 0, INK_GRID_MAX),
            clampInt(y, 0, INK_GRID_MAX),
            clampInt(p, 5, 100)
          );
        }
        return [
          stroke.id,
          TOOL_TO_CODE[stroke.tool] ?? 'p',
          COLOR_TO_CODE[stroke.color] ?? 'c',
          stroke.width,
          flat,
        ];
      }),
    };
    return JSON.stringify(doc);
  };

  let working = strokes;
  let encoded = encodeSubset(working);
  let atCapacity = false;

  // Keep payload strictly below Firestore's schema ceiling without breaking JSON
  while (
    encoded.length > SPREAD_LIMITS.MAX_INK_LEN &&
    working.length > 1
  ) {
    atCapacity = true;
    working = working.slice(1);
    encoded = encodeSubset(working);
  }

  if (encoded.length > SPREAD_LIMITS.MAX_INK_LEN) {
    return { encoded: '', atCapacity: true };
  }

  return { encoded, atCapacity };
}

function pointToSegmentDistSq(
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
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const ox = px - projX;
  const oy = py - projY;
  return ox * ox + oy * oy;
}

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
 * Lightly simplifies a completed stroke in normalized grid space (0..10000)
 * so hand curves and expressive pressure swells remain intact while saving space.
 */
export function simplifyInkPoints(
  points: InkPoint[],
  preservePressureProfile = false
): InkPoint[] {
  if (points.length <= 3) return points;
  return rdpSimplify(points, 11, preservePressureProfile ? 13 : 0);
}

/**
 * Hit-tests a normalized grid segment (eraser drag) against a stroke.
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
      ? eraserRadiusNorm + 140
      : eraserRadiusNorm + stroke.width * 24;
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
    // Test endpoints against eraser path and eraser endpoint against stroke segment
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

function resolveStrokeColor(
  stroke: InkStroke,
  isDark: boolean
): { hex: string; alpha: number; composite: GlobalCompositeOperation } {
  const entry = INK_PALETTE[stroke.color] ?? INK_PALETTE.charcoal;
  if (stroke.tool === 'highlighter') {
    return {
      hex: isDark ? entry.darkHighlighter : entry.lightHighlighter,
      alpha: isDark ? 0.28 : 0.3,
      composite: isDark ? 'screen' : 'multiply',
    };
  }
  return {
    hex: isDark ? entry.darkHex : entry.lightHex,
    alpha: 1,
    composite: 'source-over',
  };
}

function baseWidthPx(
  tool: InkDrawToolType,
  widthPreset: InkWidthPreset,
  scale: number
): number {
  if (tool === 'highlighter') {
    const table: Record<InkWidthPreset, number> = { 1: 12, 2: 18, 3: 25 };
    return table[widthPreset] * scale;
  }
  if (tool === 'fountain') {
    const table: Record<InkWidthPreset, number> = { 1: 1.9, 2: 2.9, 3: 4.3 };
    return table[widthPreset] * scale;
  }
  const table: Record<InkWidthPreset, number> = { 1: 1.4, 2: 2.2, 3: 3.4 };
  return table[widthPreset] * scale;
}

export function renderSingleInkStroke(
  ctx: CanvasRenderingContext2D,
  stroke: InkStroke,
  widthPx: number,
  heightPx: number,
  isDark: boolean
): void {
  const pts = stroke.points;
  if (pts.length === 0 || widthPx <= 0 || heightPx <= 0) return;

  const scale = Math.max(0.65, widthPx / 400);
  const baseW = baseWidthPx(stroke.tool, stroke.width, scale);
  const { hex, alpha, composite } = resolveStrokeColor(stroke, isDark);

  const toPxX = (nx: number) => (nx / INK_GRID_MAX) * widthPx;
  const toPxY = (ny: number) => (ny / INK_GRID_MAX) * heightPx;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = composite;
  ctx.fillStyle = hex;
  ctx.strokeStyle = hex;

  if (pts.length === 1) {
    const x = toPxX(pts[0][0]);
    const y = toPxY(pts[0][1]);
    const r =
      stroke.tool === 'highlighter'
        ? baseW * 0.45
        : (baseW * (0.65 + (pts[0][2] / 100) * 0.5)) / 2;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.75, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (stroke.tool === 'highlighter') {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = baseW;
    ctx.beginPath();
    const x0 = toPxX(pts[0][0]);
    const y0 = toPxY(pts[0][1]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < pts.length - 1; i++) {
      const xi = toPxX(pts[i][0]);
      const yi = toPxY(pts[i][1]);
      const xNext = toPxX(pts[i + 1][0]);
      const yNext = toPxY(pts[i + 1][1]);
      ctx.quadraticCurveTo(xi, yi, (xi + xNext) / 2, (yi + yNext) / 2);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(toPxX(last[0]), toPxY(last[1]));
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (stroke.tool === 'pen') {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Gentle pressure modulation across segments for fine pen
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const pMid = (a[2] + b[2]) / 200; // 0..1
      ctx.lineWidth = Math.max(0.85, baseW * (0.78 + pMid * 0.42));
      ctx.beginPath();
      if (i === 0) {
        ctx.moveTo(toPxX(a[0]), toPxY(a[1]));
        const nextMidX = (toPxX(a[0]) + toPxX(b[0])) / 2;
        const nextMidY = (toPxY(a[1]) + toPxY(b[1])) / 2;
        ctx.lineTo(nextMidX, nextMidY);
      } else {
        const prev = pts[i - 1];
        const startX = (toPxX(prev[0]) + toPxX(a[0])) / 2;
        const startY = (toPxY(prev[1]) + toPxY(a[1])) / 2;
        const endX = (toPxX(a[0]) + toPxX(b[0])) / 2;
        const endY = (toPxY(a[1]) + toPxY(b[1])) / 2;
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(toPxX(a[0]), toPxY(a[1]), endX, endY);
      }
      ctx.stroke();
    }
    const n = pts.length;
    const prev = pts[n - 2];
    const last = pts[n - 1];
    ctx.lineWidth = Math.max(0.85, baseW * (0.78 + (last[2] / 100) * 0.42));
    ctx.beginPath();
    ctx.moveTo(
      (toPxX(prev[0]) + toPxX(last[0])) / 2,
      (toPxY(prev[1]) + toPxY(last[1])) / 2
    );
    ctx.lineTo(toPxX(last[0]), toPxY(last[1]));
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Fountain Nib: expressive calligraphic variable-width ribbon driven by
  // captured speed/pressure dynamics, subtle italic nib cant, and smooth spline interpolation
  const nibCos = Math.cos(-0.66); // ~ -38deg classic fountain-nib hold angle
  const nibSin = Math.sin(-0.66);

  const computeTargetRadius = (
    pressureVal: number,
    dx: number,
    dy: number
  ): number => {
    const pNorm = Math.max(0.05, Math.min(1, pressureVal / 100));
    // Non-linear calligraphic curve: crisp hairlines at low pressure, rich swells at high pressure
    const pressureWidthScale = 0.28 + Math.pow(pNorm, 1.18) * 1.48;

    const segLen = Math.hypot(dx, dy);
    let nibAngleFactor = 1;
    if (segLen > 0.2) {
      const ux = dx / segLen;
      const uy = dy / segLen;
      // Dot product with nib tine axis: perpendicular motion spreads tines wider
      const parallel = Math.abs(ux * nibCos + uy * nibSin);
      nibAngleFactor = 1.18 - parallel * 0.32; // range 0.86..1.18
    }

    return Math.max(0.45, (baseW * pressureWidthScale * nibAngleFactor) / 2);
  };

  // Convert raw quantized points to pixel coordinates + calligraphic target radii
  const ctrl: Array<{ x: number; y: number; r: number }> = [];
  let smoothedR = computeTargetRadius(
    pts[0][2],
    toPxX(pts[1][0]) - toPxX(pts[0][0]),
    toPxY(pts[1][1]) - toPxY(pts[0][1])
  );

  for (let i = 0; i < pts.length; i++) {
    const curX = toPxX(pts[i][0]);
    const curY = toPxY(pts[i][1]);
    const dx =
      i > 0
        ? curX - toPxX(pts[i - 1][0])
        : toPxX(pts[1][0]) - curX;
    const dy =
      i > 0
        ? curY - toPxY(pts[i - 1][1])
        : toPxY(pts[1][1]) - curY;

    // Gentle spatial speed fallback if a legacy stroke has flat constant pressure
    const dist = Math.hypot(dx, dy);
    const hasFlatPressure =
      i > 0 && Math.abs(pts[i][2] - pts[0][2]) < 1 && pts[i][2] === 55;
    const legacySpeedMod = hasFlatPressure
      ? Math.max(0.68, Math.min(1.18, 1.14 - dist * 0.015))
      : 1;

    const targetR = computeTargetRadius(pts[i][2], dx, dy) * legacySpeedMod;
    smoothedR = smoothedR * 0.42 + targetR * 0.58;
    ctrl.push({ x: curX, y: curY, r: smoothedR });
  }

  // Subdivide along quadratic midpoint splines so cursive ribbons never look polygonal
  const dense: Array<{ x: number; y: number; r: number }> = [];
  if (ctrl.length <= 2) {
    dense.push(...ctrl);
  } else {
    dense.push(ctrl[0]);
    for (let i = 1; i < ctrl.length - 1; i++) {
      const prev = ctrl[i - 1];
      const curr = ctrl[i];
      const next = ctrl[i + 1];
      const p0x = i === 1 ? prev.x : (prev.x + curr.x) * 0.5;
      const p0y = i === 1 ? prev.y : (prev.y + curr.y) * 0.5;
      const p0r = i === 1 ? prev.r : (prev.r + curr.r) * 0.5;
      const p2x = (curr.x + next.x) * 0.5;
      const p2y = (curr.y + next.y) * 0.5;
      const p2r = (curr.r + next.r) * 0.5;

      const segDist = Math.hypot(p2x - p0x, p2y - p0y);
      const steps = Math.max(2, Math.min(5, Math.ceil(segDist / 6)));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const inv = 1 - t;
        dense.push({
          x: inv * inv * p0x + 2 * inv * t * curr.x + t * t * p2x,
          y: inv * inv * p0y + 2 * inv * t * curr.y + t * t * p2y,
          r: inv * inv * p0r + 2 * inv * t * curr.r + t * t * p2r,
        });
      }
    }
    dense.push(ctrl[ctrl.length - 1]);
  }

  for (let i = 0; i < dense.length - 1; i++) {
    const a = dense[i];
    const b = dense[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);

    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
    ctx.fill();

    if (len > 0.2) {
      const nx = -dy / len;
      const ny = dx / len;
      ctx.beginPath();
      ctx.moveTo(a.x + nx * a.r, a.y + ny * a.r);
      ctx.lineTo(b.x + nx * b.r, b.y + ny * b.r);
      ctx.lineTo(b.x - nx * b.r, b.y - ny * b.r);
      ctx.lineTo(a.x - nx * a.r, a.y - ny * a.r);
      ctx.closePath();
      ctx.fill();
    }
  }
  const endPt = dense[dense.length - 1];
  ctx.beginPath();
  ctx.arc(endPt.x, endPt.y, endPt.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function renderInkStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: InkStroke[],
  widthPx: number,
  heightPx: number,
  isDark: boolean
): void {
  ctx.clearRect(0, 0, widthPx, heightPx);
  if (strokes.length === 0 || widthPx <= 0 || heightPx <= 0) return;

  // Render highlighters first so ink lines stay sharp on top
  for (let i = 0; i < strokes.length; i++) {
    if (strokes[i].tool === 'highlighter') {
      renderSingleInkStroke(ctx, strokes[i], widthPx, heightPx, isDark);
    }
  }
  for (let i = 0; i < strokes.length; i++) {
    if (strokes[i].tool !== 'highlighter') {
      renderSingleInkStroke(ctx, strokes[i], widthPx, heightPx, isDark);
    }
  }
}
