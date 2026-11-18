import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { JournalSpread } from '../types/journal';
import { formatLocalIsoDate } from './date';
import { sanitizeSpreadPayload } from './spread';

/**
 * Maps a sanitized JournalSpread into a strict Firestore document payload matching security rules.
 * @param spread - JournalSpread to serialize for Firestore.
 * @param uid - Owner Firebase user UID.
 * @returns Firestore document data object with server timestamp.
 */
export function toFirestoreSpreadDoc(spread: JournalSpread, uid: string) {
  const clean = sanitizeSpreadPayload(spread);
  return {
    id: clean.id,
    userId: uid,
    date: clean.date,
    contextNote: clean.contextNote,
    leftBody: clean.leftBody,
    rightBody: clean.rightBody,
    leftInk: clean.leftInk,
    rightInk: clean.rightInk,
    inkColor: clean.inkColor,
    paperStyle: clean.paperStyle,
    clientUpdatedAt: clean.updatedAt,
    updatedAt: serverTimestamp(),
  };
}

/**
 * Reconstructs and sanitizes a JournalSpread from a Firestore document snapshot record.
 * @param docId - Firestore document ID fallback.
 * @param data - Raw document field map from Firestore.
 * @returns Sanitized JournalSpread entity.
 */
export function fromFirestoreSpreadDoc(
  docId: string,
  data: Record<string, unknown>
): JournalSpread {
  const serverTs =
    data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : 0;
  const clientTs =
    typeof data.clientUpdatedAt === 'number' &&
    Number.isFinite(data.clientUpdatedAt)
      ? data.clientUpdatedAt
      : serverTs || Date.now();

  return sanitizeSpreadPayload({
    id: typeof data.id === 'string' && data.id ? data.id : docId,
    date: typeof data.date === 'string' ? data.date : formatLocalIsoDate(),
    contextNote: typeof data.contextNote === 'string' ? data.contextNote : '',
    leftBody: typeof data.leftBody === 'string' ? data.leftBody : '',
    rightBody: typeof data.rightBody === 'string' ? data.rightBody : '',
    leftInk: typeof data.leftInk === 'string' ? data.leftInk : '',
    rightInk: typeof data.rightInk === 'string' ? data.rightInk : '',
    inkColor:
      data.inkColor === 'midnight' || data.inkColor === 'sepia'
        ? data.inkColor
        : 'charcoal',
    paperStyle:
      data.paperStyle === 'dotted' || data.paperStyle === 'blank'
        ? data.paperStyle
        : 'ruled',
    updatedAt: clientTs,
  });
}

/**
 * Formats raw Firestore exceptions into concise user-facing sync notices.
 * @param error - Unknown error caught during Firestore read/write/listen.
 * @returns Human-readable sync status message.
 */
export function summarizeSyncError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('Quota exceeded')) {
    return 'Daily cloud sync quota exceeded. Changes remain saved on this device.';
  }
  if (
    raw.includes('Missing or insufficient permissions') ||
    raw.includes('PERMISSION_DENIED')
  ) {
    return 'Unable to verify cloud permissions. Changes remain saved locally.';
  }
  return 'Cloud sync paused temporarily. Changes remain saved on this device.';
}
