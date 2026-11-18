import React from 'react';

/** Props accepted by the InkWarningToast component. */
interface InkWarningToastProps {
  message: string | null;
  onDismiss: () => void;
}

/**
 * Renders a dismissible floating banner when serialized handwritten ink approaches document storage limits.
 * @param props - Optional warning message string and dismiss callback.
 * @returns Floating toast banner or null when inactive.
 */
export const InkWarningToast: React.FC<InkWarningToastProps> = ({
  message,
  onDismiss,
}) => {
  if (!message) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md flex items-center gap-2 text-xs text-[#732323] dark:text-[#f0a8a3] bg-[#faf6ed]/95 dark:bg-[#2a1919]/95 border border-[#8c2d2d]/30 dark:border-[#b84a45]/45 rounded px-3.5 py-2 shadow-sm">
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="underline cursor-pointer shrink-0"
      >
        Dismiss
      </button>
    </div>
  );
};
