import React, { useEffect } from 'react';

/**
 * Closes open menus/popovers on outside pointer presses or pressing the Escape key.
 * @param isOpen - Whether one or more tracked menus are currently open.
 * @param containerRefs - Refs wrapping interactive menu DOM containers.
 * @param onDismiss - Callback invoked when the user clicks outside or presses Escape.
 * @returns void
 */
export function useOutsidePointerDismiss(
  isOpen: boolean,
  containerRefs: ReadonlyArray<React.RefObject<HTMLElement | null>>,
  onDismiss: () => void
): void {
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      const clickedInside = containerRefs.some(
        (ref) => ref.current && ref.current.contains(target)
      );
      if (!clickedInside) {
        onDismiss();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRefs, isOpen, onDismiss]);
}
