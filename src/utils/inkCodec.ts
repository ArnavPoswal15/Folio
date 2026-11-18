import {
  CODE_TO_COLOR,
  CODE_TO_TOOL,
  COLOR_TO_CODE,
  INK_GRID_MAX,
  TOOL_TO_CODE,
} from '../constants/ink';
import { SPREAD_LIMITS } from '../constants/journal';
import {
  CompactColorCode,
  CompactInkDoc,
  CompactToolCode,
  InkPoint,
  InkSerializationResult,
  InkStroke,
  InkWidthPreset,
} from '../types/ink';

/**
 * Clamps and rounds a numeric value into an integer range `[min, max]`.
 * @param val - Input number to clamp.
 * @param min - Minimum integer bound.
 * @param max - Maximum integer bound.
 * @returns Clamped integer value.
 */
function clampInt(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, Math.round(val)));
}

/**
 * Generates a compact unique stroke identifier for newly drawn ink paths.
 * @returns Short alphanumeric stroke ID string.
 */
export function createInkStrokeId(): string {
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Decodes a compact serialized JSON ink payload into sanitized InkStroke objects.
 * @param raw - Serialized JSON string from spread leftInk or rightInk.
 * @returns Array of valid InkStroke entities.
 */
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

/**
 * Encodes an array of strokes into compact JSON while enforcing Firestore's payload size ceiling.
 * @param strokes - Array of InkStroke objects to serialize.
 * @returns Encoded string and whether oldest strokes were trimmed at capacity.
 */
export function serializeInkStrokes(
  strokes: InkStroke[]
): InkSerializationResult {
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
