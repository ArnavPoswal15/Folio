import {
  BookOpen,
  Download,
  Menu,
  Moon,
  Plus,
  Sun,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { JOURNAL_FONT_ORDER, JOURNAL_FONTS } from '../../constants/journal';
import { useTheme } from '../../contexts/ThemeContext';
import { useOutsidePointerDismiss } from '../../hooks/useOutsidePointerDismiss';

/** Props accepted by the PageActionsMenu header action strip. */
interface PageActionsMenuProps {
  compact?: boolean;
  interactive: boolean;
  locked: boolean;
  isSignedIn: boolean;
  onNewSpread?: () => void;
  onOpenIndex?: () => void;
  onOpenExport?: () => void;
  onOpenAccount?: () => void;
  onCloseBook?: () => void;
  onMenuOpenChange?: (open: boolean) => void;
}

/**
 * Renders the top-right theme toggle, journal dropdown menu (New/Index/Export/Fonts/Account), and book Close action.
 * @param props - Compact layout flag, interactivity locks, auth flag, and action callbacks.
 * @returns Header action buttons and conditional dropdown menu.
 */
export const PageActionsMenu: React.FC<PageActionsMenuProps> = ({
  compact = false,
  interactive,
  locked,
  isSignedIn,
  onNewSpread,
  onOpenIndex,
  onOpenExport,
  onOpenAccount,
  onCloseBook,
  onMenuOpenChange,
}) => {
  const { isDark, toggleTheme, journalFont, setJournalFont } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const dismissRefs = useMemo(() => [menuContainerRef], []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  useOutsidePointerDismiss(menuOpen, dismissRefs, closeMenu);

  useEffect(() => {
    onMenuOpenChange?.(menuOpen);
  }, [menuOpen, onMenuOpenChange]);

  useEffect(() => {
    if (!interactive || locked) {
      setMenuOpen(false);
    }
  }, [interactive, locked]);

  const handleMenuAction = (action?: () => void) => {
    setMenuOpen(false);
    if (interactive && !locked) {
      action?.();
    }
  };

  return (
    <div
      ref={interactive ? menuContainerRef : undefined}
      className="relative flex items-center justify-end gap-2 shrink-0"
    >
      <button
        type="button"
        disabled={!interactive || locked}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={() => interactive && !locked && toggleTheme()}
        className={`inline-flex items-center justify-center rounded border transition-colors cursor-pointer shrink-0 disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488] ${
          compact ? 'p-1' : 'p-1.5'
        } border-[#8c7960]/30 dark:border-[#4b4238] bg-[#efe7d7]/75 dark:bg-[#26221e]/85 text-[#4a3d30] dark:text-[#d5c8b6] hover:border-[#57361e]/65 dark:hover:border-[#deb488]/55 hover:text-[#261f19] dark:hover:text-[#ece3d4]`}
      >
        {isDark ? (
          <Sun className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} strokeWidth={1.75} />
        ) : (
          <Moon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} strokeWidth={1.75} />
        )}
      </button>

      <button
        type="button"
        disabled={!interactive || locked}
        aria-label="Open journal menu"
        aria-haspopup="menu"
        aria-expanded={interactive ? menuOpen : false}
        onClick={() => interactive && !locked && setMenuOpen((prev) => !prev)}
        className={`inline-flex items-center justify-center rounded border transition-colors cursor-pointer shrink-0 disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488] ${
          compact ? 'p-1' : 'p-1.5'
        } ${
          menuOpen
            ? 'border-[#57361e]/60 dark:border-[#deb488]/60 bg-[#e8decb] dark:bg-[#312b25] text-[#261f19] dark:text-[#ece3d4]'
            : 'border-[#8c7960]/30 dark:border-[#4b4238] bg-[#efe7d7]/75 dark:bg-[#26221e]/85 text-[#4a3d30] dark:text-[#d5c8b6] hover:border-[#57361e]/65 dark:hover:border-[#deb488]/55 hover:text-[#261f19] dark:hover:text-[#ece3d4]'
        }`}
      >
        <Menu className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} strokeWidth={1.8} />
      </button>

      <button
        type="button"
        disabled={!interactive || locked}
        onClick={() => {
          setMenuOpen(false);
          if (interactive && !locked) onCloseBook?.();
        }}
        className={`${
          compact ? 'text-[11.5px]' : 'text-[12.5px]'
        } text-[#6d5d4b] dark:text-[#9f917f] hover:text-[#261f19] dark:hover:text-[#ece3d4] transition-colors cursor-pointer whitespace-nowrap shrink-0 px-1 py-0.5 focus-visible:outline-none focus-visible:underline`}
      >
        Close
      </button>

      {interactive && menuOpen ? (
        <div
          role="menu"
          aria-label="Journal actions"
          className="absolute right-0 top-full mt-2 w-48 rounded-md bg-[#faf6ed] dark:bg-[#231f1b] border border-[#8c775c]/35 dark:border-[#4d4339] shadow-lg dark:shadow-2xl py-1.5 z-50 text-[13px] text-[#2e251d] dark:text-[#ece3d4]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleMenuAction(onNewSpread)}
            className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left hover:bg-[#efe6d6] dark:hover:bg-[#2f2924] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#6d5d4b] dark:text-[#9f917f] shrink-0" />
            <span>New page</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleMenuAction(onOpenIndex)}
            className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left hover:bg-[#efe6d6] dark:hover:bg-[#2f2924] transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#6d5d4b] dark:text-[#9f917f] shrink-0" />
            <span>Entries index</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleMenuAction(onOpenExport)}
            className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left hover:bg-[#efe6d6] dark:hover:bg-[#2f2924] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#6d5d4b] dark:text-[#9f917f] shrink-0" />
            <span>Export CSV</span>
          </button>

          <div className="my-1 border-t border-[#8c7960]/20 dark:border-[#423a32]" />

          <div className="px-3.5 py-1.5">
            <div className="text-[11px] tracking-wide text-[#8a7966] dark:text-[#9f917f] mb-1.5">
              Font style
            </div>
            <div className="grid grid-cols-2 gap-1">
              {JOURNAL_FONT_ORDER.map((id) => {
                const opt = JOURNAL_FONTS[id];
                const active = journalFont === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => setJournalFont(id)}
                    className={`px-2 py-1 rounded text-left text-[13px] leading-tight transition-colors cursor-pointer truncate ${
                      active
                        ? 'bg-[#3a231c] dark:bg-[#d7c4a5] text-[#f6f1e6] dark:text-[#1b1511] font-medium'
                        : 'bg-[#f1e9da]/70 dark:bg-[#2c2722] text-[#3a2d22] dark:text-[#d5c8b6] hover:bg-[#e6dcc8] dark:hover:bg-[#38312b]'
                    }`}
                    style={{ fontFamily: opt.cssFamily }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="my-1 border-t border-[#8c7960]/20 dark:border-[#423a32]" />

          <button
            type="button"
            role="menuitem"
            onClick={() => handleMenuAction(onOpenAccount)}
            className="w-full px-3.5 py-2 flex items-center justify-between gap-2 text-left hover:bg-[#efe6d6] dark:hover:bg-[#2f2924] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <User className="w-3.5 h-3.5 text-[#57361e] dark:text-[#deb488] shrink-0" />
              <span className="font-medium text-[#3a231c] dark:text-[#ece3d4]">
                {isSignedIn ? 'Account & Sync' : 'Sign in'}
              </span>
            </span>
            {!isSignedIn ? (
              <span className="text-[11px] text-[#8a7966] dark:text-[#9f917f]">
                Google
              </span>
            ) : null}
          </button>
        </div>
      ) : null}
    </div>
  );
};
