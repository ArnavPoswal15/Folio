import { PenTool } from 'lucide-react';
import React, { useState } from 'react';
import { JournalDateParts, JournalSpread } from '../../types/journal';
import { VoiceControl } from '../../types/voice';
import { PageActionsMenu } from './PageActionsMenu';
import { PageStyleFontBar } from './PageStyleFontBar';
import { PageVoiceControls, PageVoiceErrorBanner } from './PageVoiceControls';

/** Props accepted by the PageDateHeader component on the first spread of a date. */
interface PageDateHeaderProps {
  spread: JournalSpread;
  spreadIndex: number;
  dateInfo: JournalDateParts;
  isMobile: boolean;
  interactive: boolean;
  locked: boolean;
  isSignedIn: boolean;
  showEmptyPlaceholders: boolean;
  inkToolbarOpen: boolean;
  handFontFamily: string;
  contextFontSize: number;
  actionsMenuOpen: boolean;
  voiceControl?: VoiceControl;
  onUpdateSpread?: (patch: Partial<JournalSpread>) => void;
  onToggleInkToolbar?: (side: 'left' | 'right') => void;
  onNewSpread?: () => void;
  onOpenIndex?: () => void;
  onOpenExport?: () => void;
  onOpenAccount?: () => void;
  onCloseBook?: () => void;
  onActionsMenuOpenChange: (open: boolean) => void;
  onFontMenuOpenChange: (open: boolean) => void;
}

/**
 * Renders the left-page primary date header with date picker, Draw/Voice tools, ink/paper/font bar, and context note.
 * @param props - Spread metadata, formatted date parts, font metrics, and action callbacks.
 * @returns Full primary spread header section.
 */
export const PageDateHeader: React.FC<PageDateHeaderProps> = ({
  spread,
  spreadIndex,
  dateInfo,
  isMobile,
  interactive,
  locked,
  isSignedIn,
  showEmptyPlaceholders,
  inkToolbarOpen,
  handFontFamily,
  contextFontSize,
  actionsMenuOpen,
  voiceControl,
  onUpdateSpread,
  onToggleInkToolbar,
  onNewSpread,
  onOpenIndex,
  onOpenExport,
  onOpenAccount,
  onCloseBook,
  onActionsMenuOpenChange,
  onFontMenuOpenChange,
}) => {
  const [editingDate, setEditingDate] = useState(false);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);

  const handleFontMenuChange = (open: boolean) => {
    setFontMenuOpen(open);
    onFontMenuOpenChange(open);
  };

  const drawToggle =
    interactive &&
    onToggleInkToolbar && (
      <button
        type="button"
        disabled={locked}
        aria-pressed={inkToolbarOpen}
        onClick={() => onToggleInkToolbar('left')}
        title="Open Apple Pencil & drawing tools (Apple Pencil also writes anytime)"
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11.5px] sm:text-[12px] transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488] ${
          inkToolbarOpen
            ? 'bg-[#3a231c] dark:bg-[#deb488] text-[#faf6ed] dark:text-[#1b1511] font-medium'
            : 'text-[#847461] dark:text-[#9f917f] hover:text-[#261f19] dark:hover:text-[#ece3d4]'
        }`}
      >
        <PenTool className="w-3 h-3 opacity-80" strokeWidth={1.7} />
        <span>Draw</span>
      </button>
    );

  return (
    <div
      className={`relative ${
        actionsMenuOpen || fontMenuOpen ? 'z-30' : 'z-10'
      } pb-2.5 mb-2 border-b border-[#7c6952]/20 dark:border-[#423a32]`}
    >
      {isMobile && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            {drawToggle}
            <PageVoiceControls
              interactive={interactive}
              locked={locked}
              spreadIndex={spreadIndex}
              side="left"
              voiceControl={voiceControl}
            />
          </div>
          <PageActionsMenu
            compact={true}
            interactive={interactive}
            locked={locked}
            isSignedIn={isSignedIn}
            onNewSpread={onNewSpread}
            onOpenIndex={onOpenIndex}
            onOpenExport={onOpenExport}
            onOpenAccount={onOpenAccount}
            onCloseBook={onCloseBook}
            onMenuOpenChange={onActionsMenuOpenChange}
          />
        </div>
      )}

      <div className="flex items-start justify-between gap-2 min-h-[46px]">
        {interactive && editingDate ? (
          <input
            type="date"
            value={spread.date}
            autoFocus
            onBlur={() => setEditingDate(false)}
            onChange={(e) => {
              if (e.target.value) {
                onUpdateSpread?.({ date: e.target.value });
              }
            }}
            className="w-fit font-serif text-base sm:text-lg font-medium text-[#2c241d] dark:text-[#ece3d4] bg-[#ebe2d1] dark:bg-[#26221e] px-2 py-0.5 rounded border border-[#8c775c]/40 dark:border-[#4e453b] focus:outline-none focus:border-[#57361e] dark:focus:border-[#deb488]"
          />
        ) : (
          <button
            type="button"
            disabled={!interactive || locked}
            onClick={() => interactive && !locked && setEditingDate(true)}
            title={interactive ? 'Click to change entry date' : undefined}
            className={`text-left group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488] rounded ${
              interactive ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            <div className="text-[11px] sm:text-[12px] tracking-[0.06em] text-[#786755] dark:text-[#9f917f] font-medium">
              {dateInfo.weekday}
            </div>
            <h1 className="font-serif text-[22px] sm:text-[26px] leading-tight font-semibold text-[#261f19] dark:text-[#ece3d4] tracking-tight group-hover:text-[#57361e] dark:group-hover:text-[#deb488] transition-colors">
              {dateInfo.monthDay}
              {dateInfo.year && (
                <span className="font-normal text-[#6f5f4d] dark:text-[#9f917f]">
                  , {dateInfo.year}
                </span>
              )}
            </h1>
          </button>
        )}

        {!isMobile && (
          <div className="pt-0.5 shrink-0 flex items-center gap-2">
            {drawToggle}
            <PageVoiceControls
              interactive={interactive}
              locked={locked}
              spreadIndex={spreadIndex}
              side="left"
              voiceControl={voiceControl}
            />
          </div>
        )}
      </div>

      <PageStyleFontBar
        spread={spread}
        interactive={interactive}
        locked={locked}
        onUpdateSpread={onUpdateSpread}
        onFontMenuOpenChange={handleFontMenuChange}
      />

      <div className="mt-1.5 h-[26px] flex items-center">
        {interactive ? (
          <input
            type="text"
            value={spread.contextNote}
            readOnly={locked}
            placeholder="Quiet note (weather, place, mood)..."
            onChange={(e) => onUpdateSpread?.({ contextNote: e.target.value })}
            className="w-full h-[26px] bg-transparent ink-prose leading-[26px] text-[#6a5948] dark:text-[#b7a896] placeholder:text-[#ab9b87]/80 dark:placeholder:text-[#6f6356] focus:outline-none focus:text-[#2c241d] dark:focus:text-[#ece3d4] select-text"
            style={{
              fontFamily: handFontFamily,
              fontSize: `${contextFontSize}px`,
            }}
          />
        ) : (
          <div
            className="w-full h-[26px] ink-prose leading-[26px] truncate"
            style={{
              fontFamily: handFontFamily,
              fontSize: `${contextFontSize}px`,
            }}
          >
            {spread.contextNote && (
              <span className="text-[#6a5948] dark:text-[#b7a896]">
                {spread.contextNote}
              </span>
            )}
            {!spread.contextNote && showEmptyPlaceholders && (
              <span className="text-[#ab9b87]/80 dark:text-[#6f6356]">
                Quiet note (weather, place, mood)...
              </span>
            )}
          </div>
        )}
      </div>

      <PageVoiceErrorBanner
        interactive={interactive}
        spreadIndex={spreadIndex}
        side="left"
        isSignedIn={isSignedIn}
        voiceControl={voiceControl}
        onOpenAccount={onOpenAccount}
      />
    </div>
  );
};
