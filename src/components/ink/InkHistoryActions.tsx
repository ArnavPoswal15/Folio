import { Hand, Redo2, Trash2, Undo2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { INK_CLEAR_CONFIRM_TIMEOUT_MS } from '../../constants/ink';

/** Props accepted by the InkHistoryActions component. */
interface InkHistoryActionsProps {
  activeSideLabel: string;
  canUndo: boolean;
  canRedo: boolean;
  allowTouchDraw: boolean;
  hasInkOnActivePage: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToggleTouchDraw: () => void;
  onClearPage: () => void;
}

/**
 * Renders undo, redo, touch-draw toggle, and two-step clear page action controls inside InkToolbar.
 * @param props - Undo/redo availability, touch mode flag, page ink presence, and action callbacks.
 * @returns Group of ink canvas history and page-clearing buttons.
 */
export const InkHistoryActions: React.FC<InkHistoryActionsProps> = ({
  activeSideLabel,
  canUndo,
  canRedo,
  allowTouchDraw,
  hasInkOnActivePage,
  onUndo,
  onRedo,
  onToggleTouchDraw,
  onClearPage,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!confirmClear) return;
    const timer = window.setTimeout(
      () => setConfirmClear(false),
      INK_CLEAR_CONFIRM_TIMEOUT_MS
    );
    return () => window.clearTimeout(timer);
  }, [confirmClear]);

  useEffect(() => {
    if (!hasInkOnActivePage) {
      setConfirmClear(false);
    }
  }, [hasInkOnActivePage]);

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        disabled={!canUndo}
        aria-label={`Undo ink on ${activeSideLabel}`}
        title={`Undo ink (${activeSideLabel})`}
        onClick={onUndo}
        className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-md text-[#4a3d30] dark:text-[#d5c8b6] hover:bg-[#efe7d7] dark:hover:bg-[#2d2722] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488]"
      >
        <Undo2 className="w-4 h-4" strokeWidth={1.75} />
      </button>

      <button
        type="button"
        disabled={!canRedo}
        aria-label={`Redo ink on ${activeSideLabel}`}
        title={`Redo ink (${activeSideLabel})`}
        onClick={onRedo}
        className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-md text-[#4a3d30] dark:text-[#d5c8b6] hover:bg-[#efe7d7] dark:hover:bg-[#2d2722] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488]"
      >
        <Redo2 className="w-4 h-4" strokeWidth={1.75} />
      </button>

      <button
        type="button"
        aria-label={
          allowTouchDraw
            ? 'Finger drawing enabled (tap to switch finger back to page turns)'
            : 'Apple Pencil only (tap to also allow finger drawing)'
        }
        aria-pressed={allowTouchDraw}
        title={
          allowTouchDraw
            ? 'Finger draw ON (tap to restore finger page turns)'
            : 'Apple Pencil only (tap to draw with finger too)'
        }
        onClick={onToggleTouchDraw}
        className={`min-w-[36px] min-h-[36px] px-2 inline-flex items-center gap-1 rounded-md text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488] ${
          allowTouchDraw
            ? 'bg-[#e6dcc9] dark:bg-[#362f28] text-[#261f19] dark:text-[#deb488] font-medium'
            : 'text-[#6d5d4b] dark:text-[#9f917f] hover:bg-[#efe7d7] dark:hover:bg-[#2d2722] hover:text-[#261f19] dark:hover:text-[#ece3d4]'
        }`}
      >
        <Hand className="w-3.5 h-3.5" strokeWidth={1.75} />
        <span className="hidden md:inline">Touch</span>
      </button>

      {hasInkOnActivePage && (
        <button
          type="button"
          aria-label={`Clear ink on ${activeSideLabel}`}
          title={`Clear all ink on ${activeSideLabel}`}
          onClick={() => {
            if (!confirmClear) {
              setConfirmClear(true);
              return;
            }
            setConfirmClear(false);
            onClearPage();
          }}
          className={`min-h-[36px] px-2 inline-flex items-center gap-1 rounded-md text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#8f3136] ${
            confirmClear
              ? 'bg-[#8f3136] dark:bg-[#c95b60] text-[#faf6ed] dark:text-[#171211] font-medium'
              : 'text-[#732323]/80 dark:text-[#e09390] hover:bg-[#f2e2df] dark:hover:bg-[#352020]'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          {confirmClear && <span>Clear?</span>}
        </button>
      )}
    </div>
  );
};
