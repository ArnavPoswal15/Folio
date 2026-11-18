import { SPREAD_LIMITS } from '../constants/journal';
import { JournalDateParts } from '../types/journal';

/**
 * Formats a Date instance into a local YYYY-MM-DD ISO string.
 * @param date - Date object to format (defaults to current local date).
 * @returns Local calendar date string formatted as YYYY-MM-DD.
 */
export function formatLocalIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validates an ISO date string or falls back to today's local ISO date.
 * @param rawDate - Candidate YYYY-MM-DD date string.
 * @returns Validated YYYY-MM-DD date string.
 */
export function sanitizeIsoDate(rawDate: string): string {
  if (SPREAD_LIMITS.DATE_PATTERN.test(rawDate)) return rawDate;
  return formatLocalIsoDate();
}

/**
 * Computes the calendar day immediately following the given ISO date.
 * @param lastIsoDate - Reference YYYY-MM-DD date string.
 * @returns Next calendar day formatted as YYYY-MM-DD.
 */
export function getNextIsoDate(lastIsoDate: string): string {
  const parts = lastIsoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return formatLocalIsoDate();
  }
  const [y, m, d] = parts;
  const next = new Date(y, m - 1, d + 1);
  return formatLocalIsoDate(next);
}

/**
 * Computes the ISO date N days prior to today for index preset filtering.
 * @param daysBack - Number of calendar days to subtract from today.
 * @returns Cutoff date formatted as YYYY-MM-DD.
 */
export function getCutoffIsoDate(daysBack: number): string {
  const now = new Date();
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysBack
  );
  return formatLocalIsoDate(target);
}

/**
 * Parses a YYYY-MM-DD ISO string into a local Date instance, or null if malformed.
 * @param isoDate - Input YYYY-MM-DD date string.
 * @returns Local Date object at midnight, or null when invalid.
 */
export function parseIsoLocal(isoDate: string): Date | null {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

/**
 * Formats an ISO date string into weekday, month/day, year, and full display strings.
 * @param isoDate - Journal spread ISO date string (YYYY-MM-DD).
 * @returns Structured human-readable date parts.
 */
export function formatJournalDateParts(isoDate: string): JournalDateParts {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return {
      weekday: 'Journal Entry',
      monthDay: isoDate,
      year: '',
      full: isoDate,
    };
  }
  const [year, month, day] = parts;
  const dateObj = new Date(year, month - 1, day);
  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
  return {
    weekday,
    monthDay,
    year: String(year),
    full: `${weekday}, ${monthDay}, ${year}`,
  };
}

/**
 * Formats a YYYY-MM string into a localized month-and-year label.
 * @param yearMonth - Year and month key formatted as YYYY-MM.
 * @returns Localized label such as "November 2026".
 */
export function formatMonthLabel(yearMonth: string): string {
  const parts = yearMonth.split('-').map(Number);
  if (parts.length !== 2 || parts.some(Number.isNaN)) return yearMonth;
  const [year, month] = parts;
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}
