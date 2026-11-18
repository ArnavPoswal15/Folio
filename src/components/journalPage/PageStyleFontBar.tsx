import { Check, ChevronDown } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { INK_COLOR_ORDER, INK_COLORS } from '../../constants/ink';
import {
  JOURNAL_FONT_ORDER,
  JOURNAL_FONTS,
  PAPER_STYLE_OPTIONS,
} from '../../constants/journal';
import { useTheme } from '../../contexts/ThemeContext';
import { useOutsidePointerDismiss } from '../../hooks/useOutsidePointerDismiss';
import { JournalSpread } from '../../types/journal';

/** Props accepted by the PageStyleFontBar component. */
interface PageStyleFontBarProps {
  spread: JournalSpread;
  interactive: boolean;
  locked: boolean;
  onUpdateSpread?: (patch: Partial<JournalSpread>) => void;
  onFontMenuOpenChange: (open: boolean) => void;
}

/**
 * Renders inline controls for spread ink tint, paper ruling style, and global journal handwriting font.
 * @param props - Active spread settings, lock state, and update callbacks.
 * @returns Compact metadata row for ink swatches, ruling selector, and font dropdown.
 */
export const PageStyleFontBar: React.FC<PageStyleFontBarProps> = ({
  spread,
  interactive,
  locked,
  onUpdateSpread,
  onFontMenuOpenChange,
}) => {
  const { isDark, journalFont, setJournalFont } = useTheme();
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const fontMenuRef = useRef<HTMLDivElement | null>(null);
  const dismissRefs = useMemo(() => [fontMenuRef], []);

  const closeFontMenu = useCallback(() => {
    setFontMenuOpen(false);
  }, []);

  useOutsidePointerDismiss(fontMenuOpen, dismissRefs, closeFontMenu);

  useEffect(() => {
    onFontMenuOpenChange(fontMenuOpen);
  }, [fontMenuOpen, onFontMenuOpenChange]);

  useEffect(() => {
    if (!interactive || locked) {
      setFontMenuOpen(false);
    }
  }, [interactive, locked]);

  const activeFont = JOURNAL_FONTS[journalFont] ?? JOURNAL_FONTS.caveat;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] sm:text-[13px] text-[#6d5d4b] dark:text-[#9f917f]">
      <div className="flex items-center gap-2">
        <span className="text-[#8a7966] dark:text-[#8f8170] text-xs">Ink</span>
        <div className="flex items-center gap-1.5">
          {INK_COLOR_ORDER.map((id) => {
            const active = spread.inkColor === id;
            return (
              <button
                key={id}
                type="button"
                disabled={!interactive || locked}
                aria-label={INK_COLORS[id].label}
                title={INK_COLORS[id].label}
                onClick={() =>
                  interactive && !locked && onUpdateSpread?.({ inkColor: id })
                }
                className={`w-3.5 h-3.5 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488] ${
                  interactive ? 'cursor-pointer hover:scale-110' : ''
                } ${
                  active
                    ? 'ring-1 ring-offset-2 ring-offset-[#f6f1e6] dark:ring-offset-[#1d1a17] ring-[#3b2f24] dark:ring-[#e8dfd1] scale-110'
                    : 'opacity-70 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: isDark
                    ? INK_COLORS[id].darkSwatch
                    : INK_COLORS[id].swatch,
                }}
              />
            );
          })}
        </div>
      </div>

      <span aria-hidden="true" className="text-[#b8a792] dark:text-[#4e453b]">
        ·
      </span>

      <div className="flex items-center gap-2.5">
        {PAPER_STYLE_OPTIONS.map(({ id: style, label }) => {
          const active = spread.paperStyle === style;
          return (
            <button
              key={style}
              type="button"
              disabled={!interactive || locked}
              onClick={() =>
                interactive && !locked && onUpdateSpread?.({ paperStyle: style })
              }
              className={`whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:underline ${
                interactive ? 'cursor-pointer' : ''
              } ${
                active
                  ? 'text-[#261f19] dark:text-[#ece3d4] font-semibold underline decoration-[#8b6b4a]/60 dark:decoration-[#deb488]/60 underline-offset-4'
                  : 'text-[#847461] dark:text-[#968775] hover:text-[#3b2f24] dark:hover:text-[#ece3d4]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <span aria-hidden="true" className="text-[#b8a792] dark:text-[#4e453b]">
        ·
      </span>

      <div
        ref={interactive ? fontMenuRef : undefined}
        className="relative flex items-center"
      >
        <button
          type="button"
          disabled={!interactive || locked}
          aria-haspopup="menu"
          aria-expanded={interactive ? fontMenuOpen : false}
          onClick={() => {
            if (!interactive || locked) return;
            setFontMenuOpen((prev) => !prev);
          }}
          title="Change writing font"
          className={`inline-flex items-center gap-0.5 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:underline ${
            interactive ? 'cursor-pointer' : ''
          } ${
            fontMenuOpen
              ? 'text-[#261f19] dark:text-[#ece3d4] font-semibold underline decoration-[#8b6b4a]/60 dark:decoration-[#deb488]/60 underline-offset-4'
              : 'text-[#847461] dark:text-[#968775] hover:text-[#3b2f24] dark:hover:text-[#ece3d4]'
          }`}
        >
          <span>Font: {activeFont.shortLabel}</span>
          <ChevronDown className="w-3 h-3 opacity-75" />
        </button>

        {interactive && fontMenuOpen ? (
          <div
            role="menu"
            aria-label="Journal font style"
            className="absolute left-0 top-full mt-2 w-44 rounded-md bg-[#faf6ed] dark:bg-[#231f1b] border border-[#8c775c]/35 dark:border-[#4d4339] shadow-lg dark:shadow-2xl py-1 z-50 text-[#2e251d] dark:text-[#ece3d4]"
          >
            {JOURNAL_FONT_ORDER.map((id) => {
              const opt = JOURNAL_FONTS[id];
              const active = journalFont === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    setJournalFont(id);
                    setFontMenuOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#efe6d6] dark:bg-[#2f2924] text-[#261f19] dark:text-[#ece3d4] font-medium'
                      : 'hover:bg-[#efe6d6]/70 dark:hover:bg-[#2f2924]/70'
                  }`}
                >
                  <span
                    className="text-[16px] leading-snug"
                    style={{ fontFamily: opt.cssFamily }}
                  >
                    {opt.label}
                  </span>
                  {active ? (
                    <Check className="w-3.5 h-3.5 text-[#57361e] dark:text-[#deb488] shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
};
