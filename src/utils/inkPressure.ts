import { FOUNTAIN_PRESSURE_CONFIG } from '../constants/ink';
import { ActiveInkPointerState, InkPoint } from '../types/ink';

/**
 * Updates smoothed pointer velocity and speed-simulated calligraphic pressure on a move sample.
 * @param active - Mutable active pointer state updated in place.
 * @param clientX - Pointer client X in CSS pixels.
 * @param clientY - Pointer client Y in CSS pixels.
 * @param rawPressure - Native PointerEvent pressure (0..1).
 * @param timeStamp - Event timestamp in milliseconds.
 * @returns Effective normalized pressure value (8..100).
 */
export function sampleFountainPressure(
  active: ActiveInkPointerState,
  clientX: number,
  clientY: number,
  rawPressure: number,
  timeStamp: number
): number {
  const cfg = FOUNTAIN_PRESSURE_CONFIG;
  const distPx = Math.hypot(
    clientX - active.lastClientX,
    clientY - active.lastClientY
  );

  if (distPx >= cfg.minStepPx) {
    const dt = Math.max(
      cfg.minDtMs,
      Math.min(cfg.maxDtMs, timeStamp - active.lastTimeMs)
    );
    const instVel = distPx / dt;
    active.smoothedVel =
      active.smoothedVel * cfg.velSmoothOld + instVel * cfg.velSmoothNew;
    active.lastClientX = clientX;
    active.lastClientY = clientY;
    active.lastTimeMs = timeStamp;

    if (
      active.pointerType === 'pen' &&
      rawPressure > 0 &&
      Math.abs(rawPressure - active.initialRawPressure) >
        cfg.hardwareMoveDetectDelta
    ) {
      active.hasHardwarePressure = true;
    }

    const speedNorm = Math.max(
      0,
      Math.min(
        1,
        (active.smoothedVel - cfg.speedMinPxPerMs) / cfg.speedRangePxPerMs
      )
    );
    const velocityPressure =
      cfg.minPressure +
      cfg.pressureSpan * Math.pow(1 - speedNorm, cfg.pressureExponent);

    const targetPressure = active.hasHardwarePressure
      ? Math.max(
          cfg.minPointPressure,
          Math.min(cfg.maxPointPressure, rawPressure * 100)
        ) *
          cfg.hwPressureWeight +
        velocityPressure * cfg.velPressureWeight
      : velocityPressure;

    active.smoothedPressure =
      active.smoothedPressure * cfg.pressureSmoothRatio +
      targetPressure * (1 - cfg.pressureSmoothRatio);
  }

  return active.smoothedPressure;
}

/**
 * Applies a subtle nib-lift taper to the final point of brisk fountain release strokes.
 * @param points - Mutable stroke points array.
 * @param endVelocity - Final smoothed stroke velocity in px/ms.
 * @returns void
 */
export function applyFountainReleaseTaper(
  points: InkPoint[],
  endVelocity: number
): void {
  const cfg = FOUNTAIN_PRESSURE_CONFIG;
  if (points.length < 3 || endVelocity <= cfg.releaseFlickMinVel) return;
  const lastIdx = points.length - 1;
  const lastPt = points[lastIdx];
  points[lastIdx] = [
    lastPt[0],
    lastPt[1],
    Math.max(
      cfg.releaseTaperMinPressure,
      Math.round(lastPt[2] * cfg.releaseTaperFactor)
    ),
  ];
}
