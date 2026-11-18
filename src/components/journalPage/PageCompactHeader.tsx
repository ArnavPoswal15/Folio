import { PenTool } from 'lucide-react';
import React from 'react';
import { JournalDateParts } from '../../types/journal';
import { VoiceControl } from '../../types/voice';
import { PageActionsMenu } from './PageActionsMenu';
import { PageVoiceControls, PageVoiceErrorBanner } from './PageVoiceControls';

/** Props accepted by the PageCompactHeader bar for continuation left pages and right pages. */
interface PageCompactHeaderProps {
  side: 'left' | 'right';
  spreadIndex: number;
  pageW: number;
  dateInfo: JournalDateParts;
  isMobile: boolean;
  interactive: boolean;
  locked: boolean;
  isSignedIn: boolean;
  inkToolbarOpen: boolean;
  actionsMenuOpen: boolean;
  voiceControl?: VoiceControl;
  onToggleInkToolbar?: (side: 'left' | 'right') => void;
  onNewSpread?: () => void;
  onOpenIndex?: () => void;
  onOpenExport?: () => void;
  onOpenAccount?: () => void;
  onCloseBook?: () => void;
  onActionsMenuOpenChange: (open: boolean) => void;
}

/**
 * Renders the compact top header bar used on continuation left pages and all right-hand facing pages.
 * @param props - Page side, responsive dimensions, formatted date info, and tool/menu callbacks.
 * @returns Compact header bar with Draw/Voice toggles, subtle continuation/date label, and optional actions menu.
 */
export const PageCompactHeader: React.FC<PageCompactHeaderProps> = ({
  side,
  spreadIndex,
  pageW,
  dateInfo,
  isMobile,
  interactive,
  locked,
  isSignedIn,
  inkToolbarOpen,
  actionsMenuOpen,
  voiceControl,
  onToggleInkToolbar,
  onNewSpread,
  onOpenIndex,
  onOpenExport,
  onOpenAccount,
  onCloseBook,
  onActionsMenuOpenChange,
}) => {
  const drawToggle =
    interactive && onToggleInkToolbar ? (
      <button
        type="button"
        disabled={locked}
        aria-pressed={inkToolbarOpen}
        onClick={() => onToggleInkToolbar(side)}
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
    ) : null;

  const actionsRow = (
    <PageActionsMenu
      compact={isMobile || pageW < 360}
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
  );

  return (
    <div
      className={`relative ${
        actionsMenuOpen ? 'z-30' : 'z-10'
      } pb-2.5 mb-2 border-b border-[#7c6952]/20 dark:border-[#423a32]`}
    >
      {isMobile ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs italic text-[#7a6957] dark:text-[#9f917f] truncate">
              {side === 'left'
                ? `Continued · ${dateInfo.monthDay}`
                : dateInfo.monthDay}
            </span>
            {actionsRow}
          </div>
          {interactive ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {drawToggle}
                <PageVoiceControls
                  interactive={interactive}
                  locked={locked}
                  spreadIndex={spreadIndex}
                  side={side}
                  voiceControl={voiceControl}
                />
              </div>
            </div>
          ) : null}
        </>
      ) : side === 'left' ? (
        <div className="flex items-center justify-between gap-2 min-h-[30px]">
          <div className="shrink-0 flex items-center gap-2">
            {drawToggle}
            <PageVoiceControls
              interactive={interactive}
              locked={locked}
              spreadIndex={spreadIndex}
              side="left"
              voiceControl={voiceControl}
            />
          </div>
          <span className="text-xs italic text-[#7a6957] dark:text-[#9f917f] whitespace-nowrap shrink-0 truncate">
            Continued · {dateInfo.monthDay}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="shrink-0 flex items-center gap-2">
            {drawToggle}
            <PageVoiceControls
              interactive={interactive}
              locked={locked}
              spreadIndex={spreadIndex}
              side="right"
              voiceControl={voiceControl}
            />
          </div>
          {actionsRow}
        </div>
      )}

      <PageVoiceErrorBanner
        interactive={interactive}
        spreadIndex={spreadIndex}
        side={side}
        isSignedIn={isSignedIn}
        voiceControl={voiceControl}
        onOpenAccount={onOpenAccount}
      />
    </div>
  );
};
