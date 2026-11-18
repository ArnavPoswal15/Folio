import React from 'react';
import { useEntriesIndexFilter } from '../../hooks/useEntriesIndexFilter';
import { JournalSpread, SyncStatus } from '../../types/journal';
import { EntriesFilterBar } from './EntriesFilterBar';
import { EntryListItem } from './EntryListItem';

/** Props accepted by the EntriesIndexModal dialog component. */
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

/**
 * Formats the compact sync summary line displayed at the bottom of the Entries Index modal.
 * @param syncStatus - Active synchronization status.
 * @param userEmail - Signed-in user's email address, if any.
 * @returns Concise sync status summary string.
 */
function formatSyncSummary(
  syncStatus: SyncStatus,
  userEmail?: string | null
): string {
  if (!userEmail) return 'Saved on this device';
  if (syncStatus === 'syncing') return `Syncing · ${userEmail}`;
  if (syncStatus === 'error') return `Sync paused · ${userEmail}`;
  return `Synced · ${userEmail}`;
}

/**
 * Renders the searchable/filterable Journal Index modal displaying all chronological spreads.
 * @param props - Visibility, spreads list, sync state, and entry/modal callbacks.
 * @returns Modal dialog element or null when closed.
 */
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
  const {
    sortOrder,
    monthFilter,
    rangePreset,
    fromDate,
    toDate,
    availableMonths,
    filteredEntries,
    hasActiveFilters,
    setSortOrder,
    setFromDate,
    setToDate,
    resetFilters,
    handleSelectMonth,
    handleSelectRange,
  } = useEntriesIndexFilter(isOpen, spreads, onClose);

  if (!isOpen) return null;

  const syncSummary = formatSyncSummary(syncStatus, userEmail);

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

        <EntriesFilterBar
          sortOrder={sortOrder}
          monthFilter={monthFilter}
          rangePreset={rangePreset}
          fromDate={fromDate}
          toDate={toDate}
          availableMonths={availableMonths}
          hasActiveFilters={hasActiveFilters}
          onChangeSortOrder={setSortOrder}
          onSelectMonth={handleSelectMonth}
          onSelectRange={handleSelectRange}
          onChangeFromDate={setFromDate}
          onChangeToDate={setToDate}
          onResetFilters={resetFilters}
        />

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
            filteredEntries.map(({ spread, originalIndex }) => (
              <EntryListItem
                key={spread.id}
                spread={spread}
                originalIndex={originalIndex}
                isActive={originalIndex === currentIndex}
                canDelete={spreads.length > 1}
                onSelect={(idx) => {
                  onSelectSpread(idx);
                  onClose();
                }}
                onDelete={onDeleteSpread}
              />
            ))
          )}
        </div>

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
