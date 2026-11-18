import React, { useEffect, useMemo, useState } from 'react';
import {
  formatJournalDateParts,
  formatMonthLabel,
} from '../data/initialEntries';
import { JournalSpread, SyncStatus } from '../types/journal';

type SortOrder = 'desc' | 'asc';
type RangePreset = 'all' | '7d' | '30d' | '90d' | 'custom';

interface EntriesIndexModalProps {
  isOpen: boolean;
  spreads: JournalSpread[];
  currentIndex: number;
  syncStatus: SyncStatus;
  userEmail?: string | null;
  onSelectSpread: (index: number) => void;
  onNewSpread: () => void;
  onOpenExport?: () => void;
  onOpenAccount?: () => void;
  onDeleteSpread: (index: number) => void;
  onClose: () => void;
}

function getCutoffIsoDate(daysBack: number): string {
  const now = new Date();
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysBack
  );
  const yy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export const EntriesIndexModal: React.FC<EntriesIndexModalProps> = ({
  isOpen,
  spreads,
  currentIndex,
  syncStatus,
  userEmail,
  onSelectSpread,
  onNewSpread,
  onOpenExport,
  onOpenAccount,
  onDeleteSpread,
  onClose,
}) => {
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [rangePreset, setRangePreset] = useState<RangePreset>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const s of spreads) {
      if (/^\d{4}-\d{2}/.test(s.date)) {
        months.add(s.date.slice(0, 7));
      }
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [spreads]);

  const filteredEntries = useMemo(() => {
    const presetCutoff =
      rangePreset === '7d'
        ? getCutoffIsoDate(7)
        : rangePreset === '30d'
          ? getCutoffIsoDate(30)
          : rangePreset === '90d'
            ? getCutoffIsoDate(90)
            : null;

    const indexed = spreads.map((spread, originalIndex) => ({
      spread,
      originalIndex,
    }));

    const filtered = indexed.filter(({ spread }) => {
      if (monthFilter !== 'all' && !spread.date.startsWith(monthFilter)) {
        return false;
      }
      if (presetCutoff && spread.date < presetCutoff) {
        return false;
      }
      if (rangePreset === 'custom') {
        if (fromDate && spread.date < fromDate) return false;
        if (toDate && spread.date > toDate) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      const cmp =
        a.spread.date.localeCompare(b.spread.date) ||
        a.originalIndex - b.originalIndex;
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return filtered;
  }, [spreads, sortOrder, monthFilter, rangePreset, fromDate, toDate]);

  if (!isOpen) return null;

  const hasActiveFilters =
    monthFilter !== 'all' ||
    rangePreset !== 'all' ||
    fromDate !== '' ||
    toDate !== '';

  const resetFilters = () => {
    setMonthFilter('all');
    setRangePreset('all');
    setFromDate('');
    setToDate('');
  };

  const handleSelectMonth = (value: string) => {
    setMonthFilter(value);
    if (value !== 'all') {
      setRangePreset('all');
    }
  };

  const handleSelectRange = (preset: RangePreset) => {
    setRangePreset(preset);
    if (preset !== 'all') {
      setMonthFilter('all');
    }
  };

  const syncSummary = userEmail
    ? syncStatus === 'syncing'
      ? `Syncing · ${userEmail}`
      : syncStatus === 'error'
        ? `Sync paused · ${userEmail}`
        : `Synced · ${userEmail}`
    : 'Saved on this device';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Journal entries index"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[85vh] paper-grain rounded-lg border border-[#bcae97] dark:border-[#3d362e] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 sm:px-7 py-5 border-b border-[#8c7960]/25 dark:border-[#423a32] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-[#261f19] dark:text-[#ece3d4]">
              Journal Index
            </h2>
            <p className="text-xs text-[#756452] dark:text-[#9f917f] mt-0.5 tabular-nums">
              {hasActiveFilters
                ? `${filteredEntries.length} of ${spreads.length} ${spreads.length === 1 ? 'spread' : 'spreads'}`
                : `${spreads.length} ${spreads.length === 1 ? 'spread' : 'spreads'}`}
            </p>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-sm">
            {onOpenExport ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenExport();
                }}
                className="text-[#6d5d4b] dark:text-[#9f917f] hover:text-[#261f19] dark:hover:text-[#ece3d4] hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                Export CSV
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                onNewSpread();
                onClose();
              }}
              className="text-[#57361e] dark:text-[#deb488] font-semibold hover:underline cursor-pointer whitespace-nowrap shrink-0"
            >
              + New Page
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close index"
              className="text-[#6d5d4b] dark:text-[#9f917f] hover:text-[#261f19] dark:hover:text-[#ece3d4] cursor-pointer px-2 py-1 min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Date Sorting & Filtering Bar */}
        <div className="px-6 sm:px-7 py-3.5 border-b border-[#8c7960]/20 dark:border-[#3d362e] bg-[#f3ecdf]/70 dark:bg-[#171512]/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Sort order segmented toggle */}
            <div
              role="group"
              aria-label="Sort entries by date"
              className="inline-flex items-center p-0.5 rounded bg-[#e8dfd0] dark:bg-[#25211d] border border-[#8c7960]/25 dark:border-[#423a32]"
            >
              <button
                type="button"
                onClick={() => setSortOrder('desc')}
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
                onClick={() => setSortOrder('asc')}
                className={`px-3 py-1 text-xs rounded-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[32px] ${
                  sortOrder === 'asc'
                    ? 'bg-[#3a231c] dark:bg-[#d7c4a5] text-[#f6f1e6] dark:text-[#1b1511] font-medium'
                    : 'text-[#5e4f40] dark:text-[#b4a592] hover:text-[#261f19] dark:hover:text-[#ece3d4]'
                }`}
              >
                Oldest first
              </button>
            </div>

            {/* Month selector + Reset */}
            <div className="flex items-center gap-2">
              <label htmlFor="index-month-filter" className="sr-only">
                Filter by month
              </label>
              <select
                id="index-month-filter"
                value={monthFilter}
                onChange={(e) => handleSelectMonth(e.target.value)}
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
                  onClick={resetFilters}
                  className="text-xs text-[#6d5d4b] dark:text-[#9f917f] hover:text-[#261f19] dark:hover:text-[#ece3d4] underline cursor-pointer whitespace-nowrap shrink-0 px-1.5 py-1"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {/* Date Range Filter Row */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'All dates' },
                { id: '7d', label: '7 days' },
                { id: '30d', label: '30 days' },
                { id: '90d', label: '3 months' },
                { id: 'custom', label: 'Custom range' },
              ] as { id: RangePreset; label: string }[]
            ).map((opt) => {
              const active = rangePreset === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectRange(opt.id)}
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
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-2 py-1 rounded bg-[#faf6ed] dark:bg-[#25211d] text-[#261f19] dark:text-[#ece3d4] border border-[#8c7960]/30 dark:border-[#4a4138] focus:outline-none focus:border-[#57361e] dark:focus:border-[#deb488] min-h-[34px]"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span>To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-2 py-1 rounded bg-[#faf6ed] dark:bg-[#25211d] text-[#261f19] dark:text-[#ece3d4] border border-[#8c7960]/30 dark:border-[#4a4138] focus:outline-none focus:border-[#57361e] dark:focus:border-[#deb488] min-h-[34px]"
                />
              </label>
            </div>
          ) : null}
        </div>

        {/* Entries List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#8c7960]/15 dark:divide-[#38312a] px-6 sm:px-7 py-2 journal-scroll">
          {filteredEntries.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="font-serif text-lg text-[#4f4235] dark:text-[#c4b6a3]">
                No journal entries match this date selection.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 text-xs font-medium rounded bg-[#3a231c] dark:bg-[#d7c4a5] text-[#f6f1e6] dark:text-[#1b1511] hover:bg-[#4c2e25] dark:hover:bg-[#e5d5ba] transition-colors cursor-pointer"
              >
                Reset date filters
              </button>
            </div>
          ) : (
            filteredEntries.map(({ spread, originalIndex }) => {
              const d = formatJournalDateParts(spread.date);
              const active = originalIndex === currentIndex;
              const snippet = (spread.leftBody || spread.rightBody || '')
                .trim()
                .replace(/\s+/g, ' ');

              return (
                <div
                  key={spread.id}
                  className="py-3.5 flex items-start justify-between gap-4 group"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSpread(originalIndex);
                      onClose();
                    }}
                    className="flex-1 text-left cursor-pointer focus-visible:outline-none"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <span className="text-xs tabular-nums text-[#8a7966] dark:text-[#8f8170]">
                        {String(originalIndex + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={`font-serif text-lg font-medium ${
                          active
                            ? 'text-[#57361e] dark:text-[#deb488] underline underline-offset-4'
                            : 'text-[#261f19] dark:text-[#ece3d4] group-hover:text-[#57361e] dark:group-hover:text-[#deb488]'
                        }`}
                      >
                        {d.full}
                      </span>
                      {active ? (
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
                      {snippet || 'Blank sheet'}
                    </p>
                  </button>

                  {spreads.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => onDeleteSpread(originalIndex)}
                      aria-label={`Delete entry for ${d.full}`}
                      className="text-xs text-[#9c8b78] dark:text-[#8f8170] hover:text-[#8c2d2d] dark:hover:text-[#f0a8a3] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer py-1 px-2 shrink-0"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Sync Line */}
        <div className="px-6 sm:px-7 py-3 border-t border-[#8c7960]/20 dark:border-[#423a32] flex items-center justify-between gap-3 text-xs text-[#756452] dark:text-[#9f917f]">
          <span className="truncate">{syncSummary}</span>
          {onOpenAccount ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAccount();
              }}
              className="text-[#57361e] dark:text-[#deb488] hover:underline cursor-pointer whitespace-nowrap shrink-0"
            >
              {userEmail ? 'Account settings' : 'Sign in to sync'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
