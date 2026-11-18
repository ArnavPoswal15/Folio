import { Moon, Sun } from 'lucide-react';
import React from 'react';

/** Props accepted by the DeskThemeToggle button component. */
interface DeskThemeToggleProps {
  visible: boolean;
  isDark: boolean;
  onToggle: () => void;
  /** When true, hide the fixed desk toggle (shown in the closed-book prompt instead). */
  hideOnMobile?: boolean;
}

/**
 * Renders the top-right desk light/dark toggle visible while the book rests closed.
 * @param props - Visibility flag, current dark state, and toggle callback.
 * @returns Floating theme toggle button wrapper.
 */
export const DeskThemeToggle: React.FC<DeskThemeToggleProps> = ({
  visible,
  isDark,
  onToggle,
  hideOnMobile = false,
}) => (
  <div
    className={`fixed top-4 right-5 z-30 transition-opacity duration-300 ${
      hideOnMobile ? 'max-md:hidden' : ''
    } ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
  >
    <button
      type="button"
      onClick={onToggle}
      disabled={!visible}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#8c7960]/30 dark:border-[#4b4238] bg-[#faf6ed]/75 dark:bg-[#1f1c19]/85 text-xs text-[#4a3d30] dark:text-[#d5c8b6] hover:border-[#57361e]/60 dark:hover:border-[#deb488]/50 hover:text-[#261f19] dark:hover:text-[#ece3d4] transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[36px] backdrop-blur-[2px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488]"
    >
      {isDark ? (
        <>
          <Sun className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Light</span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Dark</span>
        </>
      )}
    </button>
  </div>
);
