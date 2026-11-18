import { DEFAULT_SPREADS, JOURNAL_STORAGE_KEYS } from '../constants/journal';
import { JournalSpread } from '../types/journal';
import {
  isUntouchedDefaultSpread,
  sanitizeSpreadPayload,
  sortSpreadsChronologically,
} from './spread';

/**
 * Loads guest journal spreads from localStorage, falling back to DEFAULT_SPREADS.
 * @returns Sorted array of sanitized JournalSpread entries.
 */
export function loadJournalSpreads(): JournalSpread[] {
  try {
    const raw = localStorage.getItem(JOURNAL_STORAGE_KEYS.SPREADS);
    if (!raw) return DEFAULT_SPREADS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return sortSpreadsChronologically(parsed.map(sanitizeSpreadPayload));
    }
    return DEFAULT_SPREADS;
  } catch {
    return DEFAULT_SPREADS;
  }
}

/**
 * Persists guest journal spreads into localStorage, ignoring storage quota failures.
 * @param spreads - Array of spreads to serialize and save.
 * @returns void
 */
export function saveJournalSpreads(spreads: JournalSpread[]): void {
  try {
    localStorage.setItem(
      JOURNAL_STORAGE_KEYS.SPREADS,
      JSON.stringify(spreads)
    );
  } catch {
    // Ignore storage quota errors cleanly
  }
}

/**
 * Loads per-user cached cloud spreads from localStorage while excluding untouched demo spreads.
 * @param uid - Authenticated Firebase user ID.
 * @returns Filtered array of cached JournalSpread entries.
 */
export function loadUserCloudCache(uid: string): JournalSpread[] {
  try {
    const raw = localStorage.getItem(
      `${JOURNAL_STORAGE_KEYS.CLOUD_CACHE_PREFIX}${uid}`
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeSpreadPayload)
      .filter((s) => !isUntouchedDefaultSpread(s));
  } catch {
    return [];
  }
}

/**
 * Writes per-user cloud spreads cache into localStorage, ignoring quota errors.
 * @param uid - Authenticated Firebase user ID.
 * @param spreads - Current spreads list to cache locally.
 * @returns void
 */
export function saveUserCloudCache(
  uid: string,
  spreads: JournalSpread[]
): void {
  try {
    localStorage.setItem(
      `${JOURNAL_STORAGE_KEYS.CLOUD_CACHE_PREFIX}${uid}`,
      JSON.stringify(spreads)
    );
  } catch {
    // Ignore storage quota errors cleanly
  }
}
