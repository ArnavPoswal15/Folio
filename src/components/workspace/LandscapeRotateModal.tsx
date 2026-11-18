import React from 'react';

/** Props accepted by the LandscapeRotateModal prompt component. */
interface LandscapeRotateModalProps {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * Renders the mobile portrait orientation recommendation dialog when held in shallow landscape.
 * @param props - Visibility flag and dismiss action callback.
 * @returns Modal overlay element or null when hidden.
 */
export const LandscapeRotateModal: React.FC<LandscapeRotateModalProps> = ({
  visible,
  onDismiss,
}) => {
  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="portrait-lock-heading"
      className="fixed inset-0 z-50 bg-[#1a140f]/75 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <div className="paper-grain rounded-xl border border-[#8c7960]/35 dark:border-[#4b4238] max-w-sm w-full p-6 text-center shadow-2xl">
        <h2
          id="portrait-lock-heading"
          className="font-serif text-xl font-semibold text-[#261f19] dark:text-[#ece3d4]"
        >
          Rotate to portrait orientation
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-[#6d5d4b] dark:text-[#b5a795]">
          Folio keeps its upright notebook layout on mobile so pages stay tall
          and comfortable to read and write.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 px-4 py-2 text-xs font-medium rounded border border-[#8c7960]/35 dark:border-[#4b4238] text-[#3a231c] dark:text-[#ece3d4] hover:bg-[#efe6d6] dark:hover:bg-[#2a241f] transition-colors cursor-pointer"
        >
          Continue anyway
        </button>
      </div>
    </div>
  );
};
