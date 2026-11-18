import { PREFERRED_AUDIO_MIME_TYPES } from '../constants/voice';

/**
 * Selects the highest-priority audio MIME type supported by the browser's MediaRecorder.
 * @returns Supported MIME type string, or an empty string to fall back to browser defaults.
 */
export function selectSupportedMimeType(): string {
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return '';
  }
  for (const type of PREFERRED_AUDIO_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

/**
 * Reads an audio Blob and encodes its binary payload as a base64 string.
 * @param blob - Recorded or converted audio Blob.
 * @returns Base64-encoded audio data without data-URI prefix.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('Failed to encode audio recording.'));
        return;
      }
      resolve(result.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(new Error('Failed to read audio recording.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Maps browser microphone permission and hardware exceptions to friendly user guidance.
 * @param err - Caught error from `navigator.mediaDevices.getUserMedia`.
 * @returns Human-readable microphone troubleshooting message.
 */
export function formatMicError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone permission was denied. Allow mic access to record.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Microphone is currently in use by another app.';
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Could not start voice recording.';
}

/**
 * Formats an integer duration in seconds as `M:SS`.
 * @param seconds - Elapsed recording seconds.
 * @returns Formatted timer string such as `"1:05"`.
 */
export function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Appends a voice transcript onto existing journal page text with natural spacing or paragraph breaks.
 * @param existing - Current prose text on the page.
 * @param transcript - Newly transcribed spoken text.
 * @returns Updated page prose combining existing text and transcript cleanly.
 */
export function appendTranscriptToBody(
  existing: string,
  transcript: string
): string {
  const clean = transcript.trim();
  if (!clean) return existing;
  if (!existing.trim()) return clean;
  if (/[\s\n]$/.test(existing)) return `${existing}${clean}`;
  if (/[.!?…]["')\]]*$/.test(existing)) return `${existing}\n\n${clean}`;
  return `${existing} ${clean}`;
}
