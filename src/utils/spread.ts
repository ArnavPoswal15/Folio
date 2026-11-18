import { DEFAULT_SPREADS, SPREAD_LIMITS } from '../constants/journal';
import { InkColorId } from '../types/ink';
import { JournalSpread, PaperStyle } from '../types/journal';
import { formatLocalIsoDate, sanitizeIsoDate } from './date';

/**
 * Sanitizes a raw spread identifier to match Firestore ID validation rules.
 * @param rawId - Candidate document or spread ID string.
 * @returns Safe alphanumeric/hyphen/underscore spread ID.
 */
export function sanitizeSpreadId(rawId: string): string {
  const cleaned = rawId
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, SPREAD_LIMITS.MAX_ID_LEN);
  return cleaned.length > 0 && SPREAD_LIMITS.ID_PATTERN.test(cleaned)
    ? cleaned
    : `spread-${Date.now()}`;
}

/**
 * Clamps and validates every field of a JournalSpread payload prior to state or cloud persistence.
 * @param spread - Candidate JournalSpread payload.
 * @returns Sanitized JournalSpread within schema length and enum limits.
 */
export function sanitizeSpreadPayload(spread: JournalSpread): JournalSpread {
  const safeInk: InkColorId =
    spread.inkColor === 'midnight' || spread.inkColor === 'sepia'
      ? spread.inkColor
      : 'charcoal';
  const safePaper: PaperStyle =
    spread.paperStyle === 'dotted' || spread.paperStyle === 'blank'
      ? spread.paperStyle
      : 'ruled';
  const safeLeftInk =
    typeof spread.leftInk === 'string'
      ? spread.leftInk.slice(0, SPREAD_LIMITS.MAX_INK_LEN)
      : '';
  const safeRightInk =
    typeof spread.rightInk === 'string'
      ? spread.rightInk.slice(0, SPREAD_LIMITS.MAX_INK_LEN)
      : '';

  return {
    id: sanitizeSpreadId(spread.id),
    date: sanitizeIsoDate(spread.date),
    contextNote: (spread.contextNote ?? '').slice(
      0,
      SPREAD_LIMITS.MAX_CONTEXT_LEN
    ),
    leftBody: (spread.leftBody ?? '').slice(0, SPREAD_LIMITS.MAX_BODY_LEN),
    rightBody: (spread.rightBody ?? '').slice(0, SPREAD_LIMITS.MAX_BODY_LEN),
    leftInk: safeLeftInk,
    rightInk: safeRightInk,
    inkColor: safeInk,
    paperStyle: safePaper,
    updatedAt:
      Number.isFinite(spread.updatedAt) && spread.updatedAt >= 0
        ? spread.updatedAt
        : Date.now(),
  };
}

/**
 * Returns a chronologically sorted copy of spreads, tie-breaking numerically by spread ID.
 * @param spreads - Array of spreads to sort.
 * @returns Sorted array of JournalSpread objects.
 */
export function sortSpreadsChronologically(
  spreads: JournalSpread[]
): JournalSpread[] {
  return [...spreads].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.id.localeCompare(b.id, undefined, { numeric: true })
  );
}

/**
 * Checks whether a spread still matches an unedited built-in sample entry.
 * @param spread - Spread to inspect.
 * @returns True when the spread matches a default entry verbatim.
 */
export function isUntouchedDefaultSpread(spread: JournalSpread): boolean {
  const sample = DEFAULT_SPREADS.find((d) => d.id === spread.id);
  if (!sample) return false;
  return (
    sample.date === spread.date &&
    sample.contextNote === spread.contextNote &&
    sample.leftBody === spread.leftBody &&
    sample.rightBody === spread.rightBody &&
    sample.leftInk === spread.leftInk &&
    sample.rightInk === spread.rightInk &&
    sample.inkColor === spread.inkColor &&
    sample.paperStyle === spread.paperStyle
  );
}

/**
 * Creates a fresh blank spread dated for today with default charcoal ink and ruled paper.
 * @returns Newly initialized JournalSpread for today's date.
 */
export function createBlankTodaySpread(): JournalSpread {
  const rand = Math.random().toString(36).slice(2, 7);
  return sanitizeSpreadPayload({
    id: `spread-${Date.now()}-${rand}`,
    date: formatLocalIsoDate(),
    contextNote: '',
    leftBody: '',
    rightBody: '',
    leftInk: '',
    rightInk: '',
    inkColor: 'charcoal',
    paperStyle: 'ruled',
    updatedAt: Date.now(),
  });
}

/**
 * Generates a unique timestamped spread identifier.
 * @returns Unique sanitized spread ID string.
 */
export function generateUniqueSpreadId(): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return sanitizeSpreadId(`spread-${Date.now()}-${rand}`);
}

/**
 * Generates an ordered `-c1`, `-c2`, ... continuation ID that sorts immediately after its parent spread.
 * @param parentId - ID of the overflowing spread.
 * @param existingSpreads - Current spreads array checked for collisions.
 * @returns Unique continuation spread ID.
 */
export function generateContinuationSpreadId(
  parentId: string,
  existingSpreads: JournalSpread[]
): string {
  const existingIds = new Set(existingSpreads.map((s) => s.id));
  const baseMatch = parentId.match(/^(.*)-c(\d+)$/);
  const root = baseMatch ? baseMatch[1] : parentId;
  let seq = baseMatch ? Number(baseMatch[2]) + 1 : 1;

  while (seq < 1000) {
    const candidate = sanitizeSpreadId(`${root}-c${seq}`);
    if (!existingIds.has(candidate)) {
      return candidate;
    }
    seq += 1;
  }
  return generateUniqueSpreadId();
}

/**
 * Joins overflowing text with existing downstream page text using a clean newline boundary when needed.
 * @param leading - Newly overflowed text segment.
 * @param trailing - Pre-existing text on the receiving page.
 * @returns Merged text string without awkward word concatenation.
 */
export function mergeOverflowText(leading: string, trailing: string): string {
  if (leading && trailing) {
    const sep =
      /[\s\n]$/.test(leading) || /^[\s\n]/.test(trailing) ? '' : '\n';
    return `${leading}${sep}${trailing}`;
  }
  return leading || trailing;
}

/**
 * Clamps a spread array index to valid bounds `[0, length - 1]`.
 * @param index - Desired array index.
 * @param length - Total number of items in the spreads array.
 * @returns Clamped valid index (or 0 when length <= 0).
 */
export function clampSpreadIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}
