import { Moon, Sun } from 'lucide-react';
import React from 'react';

/** Props accepted by the WelcomeThemeCloseBar utility strip. */
interface WelcomeThemeCloseBarProps {
  isDark: boolean;
  disabled: boolean;
  onToggleTheme: () => void;
  onCloseBook?: () => void;
  closeClassName?: string;
}

/**
 * Renders the theme toggle icon button and book Close action shared by mobile and desktop welcome pages.
 * @param props - Dark mode flag, disabled gate, and theme/close callbacks.
 * @returns Theme toggle and close action buttons.
 */
export const WelcomeThemeCloseBar: React.FC<WelcomeThemeCloseBarProps> = ({
  isDark,
  disabled,
  onToggleTheme,
  onCloseBook,
  closeClassName = 'text-[12.5px] text-[#6d5d4b] dark:text-[#9f917f] hover:text-[#261f19] dark:hover:text-[#ece3d4] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:underline',
}) => (
  <>
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onToggleTheme()}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex items-center justify-center p-1 rounded text-[#6d5d4b] dark:text-[#9f917f] hover:text-[#261f19] dark:hover:text-[#ece3d4] transition-colors cursor-pointer shrink-0 disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488]"
    >
      {isDark ? (
        <Sun className="w-3.5 h-3.5" strokeWidth={1.75} />
      ) : (
        <Moon className="w-3.5 h-3.5" strokeWidth={1.75} />
      )}
    </button>
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onCloseBook?.()}
      className={closeClassName}
    >
      Close
    </button>
  </>
);
