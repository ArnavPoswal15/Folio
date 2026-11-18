import React, { useEffect, useMemo, useState } from 'react';
import { formatJournalDateParts } from '../data/initialEntries';
import { JournalSpread } from '../types/journal';
import {
  downloadJournalCsv,
  EXPORT_DURATION_OPTIONS,
  ExportDurationId,
  filterSpreadsByDuration,
} from '../utils/exportCsv';

interface ExportJournalModalProps {
  isOpen: boolean;
  spreads: JournalSpread[];
  onClose: () => void;
}

export const ExportJournalModal: React.FC<ExportJournalModalProps> = ({
  isOpen,
  spreads,
  onClose,
}) => {
  const [duration, setDuration] = useState<ExportDurationId>('all');
  const [downloadedMessage, setDownloadedMessage] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) {
      setDownloadedMessage(null);
      return;
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const matchingSpreads = useMemo(
    () => filterSpreadsByDuration(spreads, duration),
    [spreads, duration]
  );

  if (!isOpen) return null;

  const firstDate = matchingSpreads[0]
    ? formatJournalDateParts(matchingSpreads[0].date)
    : null;
  const lastDate = matchingSpreads[matchingSpreads.length - 1]
    ? formatJournalDateParts(matchingSpreads[matchingSpreads.length - 1].date)
    : null;

  const handleDownload = () => {
    if (matchingSpreads.length === 0) return;
    const count = downloadJournalCsv(spreads, duration);
    setDownloadedMessage(
      `Downloaded ${count} ${count === 1 ? 'spread' : 'spreads'} as CSV.`
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export journal entries"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md paper-grain rounded-lg border border-[#bcae97] dark:border-[#3d362e] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 sm:px-7 py-5 border-b border-[#8c7960]/25 dark:border-[#423a32] flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-[#261f19] dark:text-[#ece3d4]">
              Export Journal
            </h2>
            <p className="text-xs text-[#756452] dark:text-[#9f917f] mt-0.5">
              Download entries in CSV format
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className="text-[#6d5d4b] dark:text-[#9f917f] hover:text-[#261f19] dark:hover:text-[#ece3d4] cursor-pointer px-2 py-1 min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="px-6 sm:px-7 py-5 space-y-5">
          <div>
            <div className="text-xs tracking-wide text-[#6d5d4b] dark:text-[#9f917f] font-medium mb-2.5">
              Time range
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EXPORT_DURATION_OPTIONS.map((opt) => {
                const active = duration === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setDuration(opt.id);
                      setDownloadedMessage(null);
                    }}
                    className={`px-3 py-2 text-sm rounded border text-center transition-colors cursor-pointer whitespace-nowrap min-h-[40px] ${
                      active
                        ? 'bg-[#3a231c] dark:bg-[#d7c4a5] text-[#f6f1e6] dark:text-[#1b1511] border-[#3a231c] dark:border-[#d7c4a5] font-medium'
                        : 'bg-[#efe8da] dark:bg-[#25211d] text-[#3b2f24] dark:text-[#d5c8b6] border-[#8c7960]/30 dark:border-[#423a32] hover:border-[#57361e]/60 dark:hover:border-[#deb488]/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[#8c7960]/20 dark:border-[#423a32] text-sm text-[#5e4f40] dark:text-[#bfb19e] space-y-1">
            <div className="flex items-center justify-between">
              <span>Matching entries</span>
              <span className="font-medium text-[#261f19] dark:text-[#ece3d4] tabular-nums">
                {matchingSpreads.length}{' '}
                {matchingSpreads.length === 1 ? 'spread' : 'spreads'}
              </span>
            </div>
            {firstDate && lastDate ? (
              <div className="text-xs text-[#7a6855] dark:text-[#9f917f]">
                {firstDate.full === lastDate.full
                  ? firstDate.full
                  : `${firstDate.monthDay}, ${firstDate.year} – ${lastDate.monthDay}, ${lastDate.year}`}
              </div>
            ) : (
              <div className="text-xs text-[#7a6855] dark:text-[#9f917f]">
                No entries fall within this range.
              </div>
            )}
          </div>

          {downloadedMessage ? (
            <div className="text-xs font-medium text-[#2f5233] dark:text-[#8fd196]">
              {downloadedMessage}
            </div>
          ) : null}
        </div>

        <div className="px-6 sm:px-7 py-4 border-t border-[#8c7960]/20 dark:border-[#423a32] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#6d5d4b] dark:text-[#9f917f] hover:text-[#261f19] dark:hover:text-[#ece3d4] cursor-pointer whitespace-nowrap min-h-[40px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={matchingSpreads.length === 0}
            onClick={handleDownload}
            className="px-5 py-2 text-sm font-medium rounded bg-[#3a231c] dark:bg-[#d7c4a5] text-[#f6f1e6] dark:text-[#1b1511] hover:bg-[#4c2e25] dark:hover:bg-[#e5d5ba] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap min-h-[40px]"
          >
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
};
