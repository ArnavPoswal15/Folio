import React from 'react';
import { ENTRY_RANGE_PRESET_OPTIONS } from '../../constants/entriesIndex';
import { RangePreset, SortOrder } from '../../types/entriesIndex';
import { formatMonthLabel } from '../../utils/date';

/** Props accepted by the EntriesFilterBar component. */
interface EntriesFilterBarProps {
  sortOrder: SortOrder;
  monthFilter: string;
  rangePreset: RangePreset;
  fromDate: string;
  toDate: string;
  availableMonths: string[];
  hasActiveFilters: boolean;
  onChangeSortOrder: (order: SortOrder) => void;
  onSelectMonth: (month: string) => void;
  onSelectRange: (preset: RangePreset) => void;
  onChangeFromDate: (date: string) => void;
  onChangeToDate: (date: string) => void;
  onResetFilters: () => void;
}

/**
 * Renders sort order toggle, month dropdown, preset date-range buttons, and custom date inputs.
 * @param props - Current filter state and filter setter callbacks.
 * @returns Styled filter toolbar inside the Entries Index modal.
 */
export const EntriesFilterBar: React.FC<EntriesFilterBarProps> = ({
  sortOrder,
  monthFilter,
  rangePreset,
  fromDate,
  toDate,
  availableMonths,
  hasActiveFilters,
  onChangeSortOrder,
  onSelectMonth,
  onSelectRange,
  onChangeFromDate,
  onChangeToDate,
  onResetFilters,
}) => (
  <div className="px-6 sm:px-7 py-3.5 border-b border-[#8c7960]/20 dark:border-[#3d362e] bg-[#f3ecdf]/70 dark:bg-[#171512]/80 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <div
        role="group"
        aria-label="Sort entries by date"
        className="inline-flex items-center p-0.5 rounded bg-[#e8dfd0] dark:bg-[#25211d] border border-[#8c7960]/25 dark:border-[#423a32]"
      >
        <button
          type="button"
          onClick={() => onChangeSortOrder('desc')}
          className={`px-3 py-1 text-xs rounded-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[32px] ${
            sortOrder === 'desc'
              ? 'bg-[#3a231c] dark:bg-[#d7c4a5] text-[#f6f1e6] dark:text-[#1b1511] font-medium'
              : 'text-[#5e4f40] dark:text-[#b4a592] hover:text-[#261f19] dark:hover:text-[#ece3d4]'
          }`}
        >
          Newest first
        </button>
        <button
          type="button"
          onClick={() => onChangeSortOrder('asc')}
          className={`px-3 py-1 text-xs rounded-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[32px] ${
            sortOrder === 'asc'
              ? 'bg-[#3a231c] dark:bg-[#d7c4a5] text-[#f6f1e6] dark:text-[#1b1511] font-medium'
              : 'text-[#5e4f40] dark:text-[#b4a592] hover:text-[#261f19] dark:hover:text-[#ece3d4]'
          }`}
        >
          Oldest first
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="index-month-filter" className="sr-only">
          Filter by month
        </label>
        <select
          id="index-month-filter"
          value={monthFilter}
          onChange={(e) => onSelectMonth(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded bg-[#faf6ed] dark:bg-[#25211d] text-[#261f19] dark:text-[#ece3d4] border border-[#8c7960]/30 dark:border-[#4a4138] focus:outline-none focus:border-[#57361e] dark:focus:border-[#deb488] cursor-pointer min-h-[34px]"
        >
          <option value="all">All months</option>
          {availableMonths.map((ym) => (
            <option key={ym} value={ym}>
              {formatMonthLabel(ym)}
            </option>
          ))}
        </select>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onResetFilters}
            className="text-xs text-[#6d5d4b] dark:text-[#9f917f] hover:text-[#261f19] dark:hover:text-[#ece3d4] underline cursor-pointer whitespace-nowrap shrink-0 px-1.5 py-1"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-1.5">
      {ENTRY_RANGE_PRESET_OPTIONS.map((opt) => {
        const active = rangePreset === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelectRange(opt.id)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[32px] ${
              active
                ? 'bg-[#3a231c] dark:bg-[#d7c4a5] text-[#f6f1e6] dark:text-[#1b1511] border-[#3a231c] dark:border-[#d7c4a5] font-medium'
                : 'bg-[#faf6ed] dark:bg-[#25211d] text-[#5e4f40] dark:text-[#b4a592] border-[#8c7960]/25 dark:border-[#423a32] hover:border-[#57361e]/60 dark:hover:border-[#deb488]/60 hover:text-[#261f19] dark:hover:text-[#ece3d4]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>

    {rangePreset === 'custom' ? (
      <div className="pt-1 flex flex-wrap items-center gap-3 text-xs text-[#5e4f40] dark:text-[#b4a592]">
        <label className="flex items-center gap-1.5">
          <span>From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => onChangeFromDate(e.target.value)}
            className="px-2 py-1 rounded bg-[#faf6ed] dark:bg-[#25211d] text-[#261f19] dark:text-[#ece3d4] border border-[#8c7960]/30 dark:border-[#4a4138] focus:outline-none focus:border-[#57361e] dark:focus:border-[#deb488] min-h-[34px]"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span>To</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => onChangeToDate(e.target.value)}
            className="px-2 py-1 rounded bg-[#faf6ed] dark:bg-[#25211d] text-[#261f19] dark:text-[#ece3d4] border border-[#8c7960]/30 dark:border-[#4a4138] focus:outline-none focus:border-[#57361e] dark:focus:border-[#deb488] min-h-[34px]"
          />
        </label>
      </div>
    ) : null}
  </div>
);
