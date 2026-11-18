import React from 'react';
import { JournalSpread } from '../../types/journal';
import { formatJournalDateParts } from '../../utils/date';
import { getEntrySnippet } from '../../utils/entriesFilter';

/** Props accepted by the EntryListItem row component. */
interface EntryListItemProps {
  spread: JournalSpread;
  originalIndex: number;
  isActive: boolean;
  canDelete: boolean;
  onSelect: (index: number) => void;
  onDelete: (index: number) => void;
}

/**
 * Renders a single clickable journal spread row inside the Entries Index modal.
 * @param props - Spread entity, store index, active/delete flags, and click handlers.
 * @returns Styled list row with date heading, mood line, preview snippet, and optional delete button.
 */
export const EntryListItem: React.FC<EntryListItemProps> = ({
  spread,
  originalIndex,
  isActive,
  canDelete,
  onSelect,
  onDelete,
}) => {
  const dateParts = formatJournalDateParts(spread.date);
  const snippet = getEntrySnippet(spread);

  return (
    <div className="py-3.5 flex items-start justify-between gap-4 group">
      <button
        type="button"
        onClick={() => onSelect(originalIndex)}
        className="flex-1 text-left cursor-pointer focus-visible:outline-none"
      >
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="text-xs tabular-nums text-[#8a7966] dark:text-[#8f8170]">
            {String(originalIndex + 1).padStart(2, '0')}
          </span>
          <span
            className={`font-serif text-lg font-medium ${
              isActive
                ? 'text-[#57361e] dark:text-[#deb488] underline underline-offset-4'
                : 'text-[#261f19] dark:text-[#ece3d4] group-hover:text-[#57361e] dark:group-hover:text-[#deb488]'
            }`}
          >
            {dateParts.full}
          </span>
          {isActive ? (
            <span className="text-xs italic text-[#7a6855] dark:text-[#9f917f]">
              · Open
            </span>
          ) : null}
        </div>
        {spread.contextNote ? (
          <div className="mt-0.5 pl-6 text-xs text-[#7a6855] dark:text-[#9f917f] truncate">
            {spread.contextNote}
          </div>
        ) : null}
        <p className="mt-1 pl-6 font-hand ink-prose text-lg text-[#5e4f40] dark:text-[#bfb19e] line-clamp-1">
          {snippet}
        </p>
      </button>

      {canDelete ? (
        <button
          type="button"
          onClick={() => onDelete(originalIndex)}
          aria-label={`Delete entry for ${dateParts.full}`}
          className="text-xs text-[#9c8b78] dark:text-[#8f8170] hover:text-[#8c2d2d] dark:hover:text-[#f0a8a3] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer py-1 px-2 shrink-0"
        >
          Remove
        </button>
      ) : null}
    </div>
  );
};
