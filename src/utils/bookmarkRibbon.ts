import { BOOKMARK_RIBBON_CONFIG } from '../constants/bookmark';
import { RibbonPaths, RibbonPhysics } from '../types/bookmark';

/**
 * Generates SVG outline, shadow, edge highlight, and centerline paths from the current spring state.
 * @param state - Live bookmark ribbon spring physics state vector.
 * @param maxStretch - Maximum vertical stretch distance in CSS pixels.
 * @param timeSec - Current simulation clock in seconds for micro-tension tremor.
 * @returns Derived SVG path strings and dynamic lighting properties.
 */
export function buildRibbonPaths(
  state: RibbonPhysics,
  maxStretch: number,
  timeSec: number
): RibbonPaths {
  const { SAMPLES, BASE_SHAFT_LEN, BASE_HALF_W } = BOOKMARK_RIBBON_CONFIG;
  const tension = Math.max(0, Math.min(1, state.stretch / maxStretch));
  const totalLen = Math.max(14, BASE_SHAFT_LEN + state.stretch);

  const restDrapeX = 1.6 * (1 - tension);
  const restMidBend = -1.1 * (1 - tension);
  const effectiveTipX = state.tipX + restDrapeX;
  const effectiveMid = state.midLag + restMidBend;

  const tremorAmp =
    state.dragging && tension > 0.78
      ? Math.sin(timeSec * 52) * (tension - 0.78) * 3.6
      : 0;

  const cx: number[] = new Array(SAMPLES);
  const cy: number[] = new Array(SAMPLES);
  const hw: number[] = new Array(SAMPLES);

  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    const swingWeight = Math.pow(t, 1.48);
    const bellyWeight = Math.sin(t * Math.PI);
    const ripple =
      state.rippleAmp * Math.sin(t * 6.4 - state.ripplePhase) * Math.pow(t, 0.85);

    const x =
      effectiveTipX * swingWeight +
      effectiveMid * bellyWeight * (1 - 0.35 * tension) +
      ripple +
      tremorAmp * bellyWeight;

    const foreshorten = (x * x) / Math.max(40, totalLen * 3.6);
    const y = -6 + totalLen * t - foreshorten * t;

    const stretchFactor =
      state.stretch >= 0
        ? 1 - tension * 0.21 * (0.45 + 0.55 * bellyWeight)
        : 1 + Math.min(0.14, (-state.stretch / 14) * 0.12) * bellyWeight;

    cx[i] = x;
    cy[i] = y;
    hw[i] = BASE_HALF_W * Math.max(0.76, stretchFactor);
  }

  const leftX: number[] = new Array(SAMPLES);
  const leftY: number[] = new Array(SAMPLES);
  const rightX: number[] = new Array(SAMPLES);
  const rightY: number[] = new Array(SAMPLES);

  let lastTx = 0;
  let lastTy = 1;
  let lastNx = 1;
  let lastNy = 0;

  for (let i = 0; i < SAMPLES; i++) {
    const prev = Math.max(0, i - 1);
    const next = Math.min(SAMPLES - 1, i + 1);
    let tx = cx[next] - cx[prev];
    let ty = cy[next] - cy[prev];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;

    if (i === 0) {
      tx = 0;
      ty = 1;
    }

    const nx = ty;
    const ny = -tx;

    leftX[i] = cx[i] - nx * hw[i];
    leftY[i] = cy[i] - ny * hw[i];
    rightX[i] = cx[i] + nx * hw[i];
    rightY[i] = cy[i] + ny * hw[i];

    if (i === SAMPLES - 1) {
      lastTx = tx;
      lastTy = ty;
      lastNx = nx;
      lastNy = ny;
    }
  }

  const lastIdx = SAMPLES - 1;
  const tipLenScale =
    state.stretch >= 0
      ? 1 + tension * 0.12
      : Math.max(0.84, 1 + state.stretch * 0.012);
  const tailDepth = 12 * tipLenScale;
  const notchDepth = 7.4 * tipLenScale;
  const tipCurlOffset = state.curl * 6.5;

  const endHw = hw[lastIdx];
  const tipBaseX = cx[lastIdx];
  const tipBaseY = cy[lastIdx];

  const leftTipX =
    tipBaseX + lastTx * tailDepth - lastNx * endHw + lastNx * tipCurlOffset;
  const leftTipY =
    tipBaseY + lastTy * tailDepth - lastNy * endHw + lastNy * tipCurlOffset;

  const notchX =
    tipBaseX + lastTx * notchDepth + lastNx * tipCurlOffset * 0.55;
  const notchY =
    tipBaseY + lastTy * notchDepth + lastNy * tipCurlOffset * 0.55;

  const rightTipX =
    tipBaseX + lastTx * tailDepth + lastNx * endHw + lastNx * tipCurlOffset;
  const rightTipY =
    tipBaseY + lastTy * tailDepth + lastNy * endHw + lastNy * tipCurlOffset;

  const parts: string[] = [
    `M ${leftX[0].toFixed(2)} ${leftY[0].toFixed(2)}`,
  ];
  for (let i = 1; i < SAMPLES; i++) {
    parts.push(`L ${leftX[i].toFixed(2)} ${leftY[i].toFixed(2)}`);
  }
  parts.push(
    `L ${leftTipX.toFixed(2)} ${leftTipY.toFixed(2)}`,
    `L ${notchX.toFixed(2)} ${notchY.toFixed(2)}`,
    `L ${rightTipX.toFixed(2)} ${rightTipY.toFixed(2)}`
  );
  for (let i = SAMPLES - 1; i >= 0; i--) {
    parts.push(`L ${rightX[i].toFixed(2)} ${rightY[i].toFixed(2)}`);
  }
  parts.push('Z');

  const ribbonPath = parts.join(' ');

  const hitParts: string[] = [
    `M ${cx[1].toFixed(2)} ${Math.max(1, cy[1]).toFixed(2)}`,
  ];
  for (let i = 2; i < SAMPLES; i++) {
    hitParts.push(`L ${cx[i].toFixed(2)} ${cy[i].toFixed(2)}`);
  }
  hitParts.push(
    `L ${(tipBaseX + lastTx * (tailDepth * 0.85)).toFixed(2)} ${(
      tipBaseY +
      lastTy * (tailDepth * 0.85)
    ).toFixed(2)}`
  );

  const highlightOnLeft = effectiveTipX + effectiveMid >= 0;
  const edgeT = highlightOnLeft ? 0.09 : 0.91;
  const edgeHighlightParts: string[] = [
    `M ${(leftX[0] + (rightX[0] - leftX[0]) * edgeT).toFixed(2)} ${(
      leftY[0] +
      (rightY[0] - leftY[0]) * edgeT
    ).toFixed(2)}`,
  ];
  for (let i = 1; i < SAMPLES; i++) {
    const ex = leftX[i] + (rightX[i] - leftX[i]) * edgeT;
    const ey = leftY[i] + (rightY[i] - leftY[i]) * edgeT;
    edgeHighlightParts.push(`L ${ex.toFixed(2)} ${ey.toFixed(2)}`);
  }

  return {
    ribbonPath,
    shadowPath: ribbonPath,
    centerlinePath: hitParts.join(' '),
    edgeHighlightPath: edgeHighlightParts.join(' '),
    sheenOpacity: Math.min(
      0.45,
      tension * 0.4 + Math.min(0.14, state.rippleAmp * 0.015)
    ),
    edgeHighlightOpacity: Math.min(
      0.34,
      0.12 +
        tension * 0.14 +
        Math.min(0.12, Math.abs(state.midLag) * 0.01 + state.rippleAmp * 0.01)
    ),
    shadowOffsetX: 2.2 + state.tipX * 0.06 + tension * 1.6,
    shadowOffsetY: 4.5 + tension * 4.5,
    shadowBlurOpacity: 0.34 - tension * 0.08,
    creaseOpacity: 0.4 + tension * 0.32,
    tension,
  };
}

/**
 * Computes nonlinear elastic pull stretch with exponential saturation against downward drag.
 * @param dy - Raw vertical pointer delta from drag origin in CSS pixels.
 * @param maxStretch - Maximum vertical stretch distance in CSS pixels.
 * @returns Saturated ribbon stretch displacement in CSS pixels.
 */
export function computeRibbonRubberStretch(
  dy: number,
  maxStretch: number
): number {
  const { RUBBER_SCALE, UP_PUSH_LIMIT, UP_PUSH_RATIO } = BOOKMARK_RIBBON_CONFIG;
  return dy >= 0
    ? maxStretch * (1 - Math.exp(-dy / RUBBER_SCALE))
    : Math.max(UP_PUSH_LIMIT, dy * UP_PUSH_RATIO);
}

/**
 * Computes damped lateral ribbon tip displacement using hyperbolic tangent saturation.
 * @param dx - Raw horizontal pointer delta from drag origin in CSS pixels.
 * @returns Saturated lateral tip X offset in CSS pixels.
 */
export function computeRibbonLateralTip(dx: number): number {
  const { LATERAL_MAX_X, LATERAL_SCALE } = BOOKMARK_RIBBON_CONFIG;
  return LATERAL_MAX_X * Math.tanh(dx / LATERAL_SCALE);
}
