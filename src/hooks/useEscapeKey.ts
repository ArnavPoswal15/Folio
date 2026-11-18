import { useEffect } from 'react';

/**
 * Attaches a global `keydown` listener invoking `onEscape` when Escape is pressed while `enabled` is true.
 * @param enabled - Whether Escape dismissal is currently active.
 * @param onEscape - Callback invoked on pressing the Escape key.
 * @returns void
 */
export function useEscapeKey(enabled: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!enabled) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [enabled, onEscape]);
}
