import React from 'react';

/** Props accepted by the PageFooterNav bottom pagination bar. */
interface PageFooterNavProps {
  side: 'left' | 'right';
  pageNumber: number;
  isMobile: boolean;
  interactive: boolean;
  locked: boolean;
  canTurnPrev: boolean;
  canTurnNext: boolean;
  onTriggerTurn?: (direction: 'prev' | 'next') => void;
}

/**
 * Renders the bottom page footer showing the folio page number and Previous / Next turn triggers.
 * @param props - Page side, folio number, navigation capability flags, and turn callback.
 * @returns Footer navigation bar element.
 */
export const PageFooterNav: React.FC<PageFooterNavProps> = ({
  side,
  pageNumber,
  isMobile,
  interactive,
  locked,
  canTurnPrev,
  canTurnNext,
  onTriggerTurn,
}) => {
  const showPrev = side === 'left' ? canTurnPrev : isMobile && canTurnPrev;
  const showNext = side === 'right' ? canTurnNext : isMobile && canTurnNext;

  return (
    <div className="relative z-10 pt-2 flex items-center justify-between text-xs text-[#8a7966] dark:text-[#8f8170]">
      {showPrev && (
        <button
          type="button"
          disabled={!interactive || locked}
          onClick={() => interactive && !locked && onTriggerTurn?.('prev')}
          className="hover:text-[#2b221a] dark:hover:text-[#ece3d4] transition-colors cursor-pointer whitespace-nowrap shrink-0 py-1 pr-3 focus-visible:outline-none focus-visible:underline"
        >
          ← Previous
        </button>
      )}
      {!showPrev && side === 'left' && (
        <span className="py-1 text-transparent select-none">←</span>
      )}

      <span className="tabular-nums">{pageNumber}</span>

      {showNext && (
        <button
          type="button"
          disabled={!interactive || locked}
          onClick={() => interactive && !locked && onTriggerTurn?.('next')}
          className="hover:text-[#2b221a] dark:hover:text-[#ece3d4] transition-colors cursor-pointer whitespace-nowrap shrink-0 py-1 pl-3 focus-visible:outline-none focus-visible:underline"
        >
          Next →
        </button>
      )}
    </div>
  );
};
