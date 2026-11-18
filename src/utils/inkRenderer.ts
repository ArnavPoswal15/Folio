import {
  FOUNTAIN_PRESSURE_CONFIG,
  INK_BASE_WIDTH_PX,
  INK_GRID_MAX,
  INK_PALETTE,
} from '../constants/ink';
import {
  InkDrawToolType,
  InkStroke,
  InkWidthPreset,
  ResolvedStrokeStyle,
} from '../types/ink';

/**
 * Resolves hex color, global alpha, and canvas compositing mode for a stroke.
 * @param stroke - Stroke whose color and tool are resolved.
 * @param isDark - Whether dark paper theme is active.
 * @returns Stroke style values for CanvasRenderingContext2D.
 */
export function resolveStrokeColor(
  stroke: InkStroke,
  isDark: boolean
): ResolvedStrokeStyle {
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

/**
 * Computes scaled pixel width for a given drawing tool and width preset.
 * @param tool - Pen, fountain, or highlighter tool.
 * @param widthPreset - Discrete width preset (1, 2, or 3).
 * @param scale - Page width ratio relative to reference 400px width.
 * @returns Scaled base stroke width in CSS pixels.
 */
export function baseWidthPx(
  tool: InkDrawToolType,
  widthPreset: InkWidthPreset,
  scale: number
): number {
  return INK_BASE_WIDTH_PX[tool][widthPreset] * scale;
}

/**
 * Computes calligraphic fountain-nib radius from pressure and motion angle relative to nib tines.
 * @param baseW - Base fountain stroke width in CSS pixels.
 * @param pressureVal - Point pressure value (0..100).
 * @param dx - Segment horizontal delta in CSS pixels.
 * @param dy - Segment vertical delta in CSS pixels.
 * @returns Target half-width radius in CSS pixels.
 */
function computeFountainTargetRadius(
  baseW: number,
  pressureVal: number,
  dx: number,
  dy: number
): number {
  const nibCos = Math.cos(FOUNTAIN_PRESSURE_CONFIG.nibCantAngleRad);
  const nibSin = Math.sin(FOUNTAIN_PRESSURE_CONFIG.nibCantAngleRad);
  const pNorm = Math.max(0.05, Math.min(1, pressureVal / 100));
  const pressureWidthScale = 0.28 + Math.pow(pNorm, 1.18) * 1.48;

  const segLen = Math.hypot(dx, dy);
  let nibAngleFactor = 1;
  if (segLen > 0.2) {
    const ux = dx / segLen;
    const uy = dy / segLen;
    const parallel = Math.abs(ux * nibCos + uy * nibSin);
    nibAngleFactor = 1.18 - parallel * 0.32;
  }

  return Math.max(0.45, (baseW * pressureWidthScale * nibAngleFactor) / 2);
}

/**
 * Renders an individual InkStroke onto a 2D canvas context.
 * @param ctx - Target CanvasRenderingContext2D.
 * @param stroke - Stroke to render.
 * @param widthPx - Canvas CSS width in pixels.
 * @param heightPx - Canvas CSS height in pixels.
 * @param isDark - Whether dark paper theme is active.
 * @returns void
 */
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
    ctx.moveTo(toPxX(pts[0][0]), toPxY(pts[0][1]));
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
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const pMid = (a[2] + b[2]) / 200;
      ctx.lineWidth = Math.max(0.85, baseW * (0.78 + pMid * 0.42));
      ctx.beginPath();
      if (i === 0) {
        ctx.moveTo(toPxX(a[0]), toPxY(a[1]));
        ctx.lineTo(
          (toPxX(a[0]) + toPxX(b[0])) / 2,
          (toPxY(a[1]) + toPxY(b[1])) / 2
        );
      } else {
        const prev = pts[i - 1];
        ctx.moveTo(
          (toPxX(prev[0]) + toPxX(a[0])) / 2,
          (toPxY(prev[1]) + toPxY(a[1])) / 2
        );
        ctx.quadraticCurveTo(
          toPxX(a[0]),
          toPxY(a[1]),
          (toPxX(a[0]) + toPxX(b[0])) / 2,
          (toPxY(a[1]) + toPxY(b[1])) / 2
        );
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

  const ctrl: Array<{ x: number; y: number; r: number }> = [];
  let smoothedR = computeFountainTargetRadius(
    baseW,
    pts[0][2],
    toPxX(pts[1][0]) - toPxX(pts[0][0]),
    toPxY(pts[1][1]) - toPxY(pts[0][1])
  );

  for (let i = 0; i < pts.length; i++) {
    const curX = toPxX(pts[i][0]);
    const curY = toPxY(pts[i][1]);
    const dx = i > 0 ? curX - toPxX(pts[i - 1][0]) : toPxX(pts[1][0]) - curX;
    const dy = i > 0 ? curY - toPxY(pts[i - 1][1]) : toPxY(pts[1][1]) - curY;
    const dist = Math.hypot(dx, dy);
    const hasFlatPressure =
      i > 0 && Math.abs(pts[i][2] - pts[0][2]) < 1 && pts[i][2] === 55;
    const legacySpeedMod = hasFlatPressure
      ? Math.max(0.68, Math.min(1.18, 1.14 - dist * 0.015))
      : 1;

    const targetR =
      computeFountainTargetRadius(baseW, pts[i][2], dx, dy) * legacySpeedMod;
    smoothedR = smoothedR * 0.42 + targetR * 0.58;
    ctrl.push({ x: curX, y: curY, r: smoothedR });
  }

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

/**
 * Clears the canvas and renders all highlighter strokes underneath pen/fountain strokes.
 * @param ctx - Target CanvasRenderingContext2D.
 * @param strokes - Complete list of strokes for the page.
 * @param widthPx - Canvas CSS width in pixels.
 * @param heightPx - Canvas CSS height in pixels.
 * @param isDark - Whether dark paper theme is active.
 * @returns void
 */
export function renderInkStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: InkStroke[],
  widthPx: number,
  heightPx: number,
  isDark: boolean
): void {
  ctx.clearRect(0, 0, widthPx, heightPx);
  if (strokes.length === 0 || widthPx <= 0 || heightPx <= 0) return;

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
