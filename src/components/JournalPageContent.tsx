import {
  BookOpen,
  Download,
  Loader2,
  Menu,
  Mic,
  Plus,
  Square,
  User,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { formatJournalDateParts } from '../data/initialEntries';
import { VoiceControl } from '../hooks/useVoiceRecorder';
import {
  INK_COLORS,
  InkColorId,
  JournalSpread,
  PaperStyle,
} from '../types/journal';

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

interface JournalPageContentProps {
  spread: JournalSpread;
  side: 'left' | 'right';
  spreadIndex: number;
  pageW: number;
  pageH: number;
  isMobile?: boolean;
  interactive?: boolean;
  locked?: boolean;
  onUpdateSpread?: (patch: Partial<JournalSpread>) => void;
  onNewSpread?: () => void;
  onOpenIndex?: () => void;
  onOpenExport?: () => void;
  onOpenAccount?: () => void;
  isSignedIn?: boolean;
  onCloseBook?: () => void;
  onTriggerTurn?: (direction: 'prev' | 'next') => void;
  canTurnPrev?: boolean;
  canTurnNext?: boolean;
  showEmptyPlaceholders?: boolean;
  showCornerSheen?: boolean;
  voiceControl?: VoiceControl;
  onMenuOpenChange?: (open: boolean) => void;
}

export const JournalPageContent: React.FC<JournalPageContentProps> = ({
  spread,
  side,
  spreadIndex,
  pageW,
  pageH,
  isMobile = false,
  interactive = true,
  locked = false,
  onUpdateSpread,
  onNewSpread,
  onOpenIndex,
  onOpenExport,
  onOpenAccount,
  isSignedIn = false,
  onCloseBook,
  onTriggerTurn,
  canTurnPrev = false,
  canTurnNext = true,
  showEmptyPlaceholders = false,
  showCornerSheen = false,
  voiceControl,
  onMenuOpenChange,
}) => {
  const [editingDate, setEditingDate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onMenuOpenChange?.(menuOpen);
  }, [menuOpen, onMenuOpenChange]);

  useEffect(() => {
    if (!interactive || locked) {
      setMenuOpen(false);
    }
  }, [interactive, locked]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const ink = INK_COLORS[spread.inkColor] ?? INK_COLORS.charcoal;
  const dateInfo = formatJournalDateParts(spread.date);
  const pageNumber = spreadIndex * 2 + (side === 'left' ? 1 : 2);

  const scaleRatio = Math.min(1, Math.max(0.76, pageW / 470));
  const handFontSize = Math.round(23 * scaleRatio);
  const handLineHeight = 32;

  const paperRuleClass =
    spread.paperStyle === 'ruled'
      ? 'paper-ruled'
      : spread.paperStyle === 'dotted'
        ? 'paper-dotted'
        : '';

  const paddingX = Math.round(isMobile ? 24 : 42 * scaleRatio);
  const paddingTop = Math.round(isMobile ? 20 : 30 * scaleRatio);
  const paddingBottom = Math.round(isMobile ? 18 : 26 * scaleRatio);

  const isThisPageRecording = Boolean(
    voiceControl &&
      voiceControl.status === 'recording' &&
      voiceControl.target?.spreadIndex === spreadIndex &&
      voiceControl.target?.side === side
  );

  const isThisPageTranscribing = Boolean(
    voiceControl &&
      voiceControl.status === 'transcribing' &&
      voiceControl.target?.spreadIndex === spreadIndex &&
      voiceControl.target?.side === side
  );

  const isOtherPageVoiceBusy = Boolean(
    voiceControl &&
      (voiceControl.status === 'recording' ||
        voiceControl.status === 'transcribing') &&
      !isThisPageRecording &&
      !isThisPageTranscribing
  );

  const hasThisPageVoiceError = Boolean(
    voiceControl?.error &&
      voiceControl.errorTarget?.spreadIndex === spreadIndex &&
      voiceControl.errorTarget?.side === side
  );

  const renderVoiceControl = () => {
    if (!interactive || !voiceControl) return null;

    if (isThisPageRecording) {
      const bar1 = Math.max(0.28, Math.min(1, voiceControl.level * 1.1));
      const bar2 = Math.max(0.22, Math.min(1, voiceControl.level * 1.45));
      const bar3 = Math.max(0.28, Math.min(1, voiceControl.level * 0.95));

      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#f2e8dc] border border-[#8f3136]/45 rounded text-[11.5px] sm:text-[12px] text-[#261f19] shrink-0">
          <span
            className="w-2 h-2 rounded-full bg-[#9e2a2b] animate-pulse shrink-0"
            aria-hidden="true"
          />
          <span
            aria-hidden="true"
            className="inline-flex items-end gap-[2px] h-3"
          >
            <span
              className="w-[2px] rounded-full bg-[#8f3136] transition-transform duration-75 origin-bottom"
              style={{ height: '100%', transform: `scaleY(${bar1.toFixed(2)})` }}
            />
            <span
              className="w-[2px] rounded-full bg-[#8f3136] transition-transform duration-75 origin-bottom"
              style={{ height: '100%', transform: `scaleY(${bar2.toFixed(2)})` }}
            />
            <span
              className="w-[2px] rounded-full bg-[#8f3136] transition-transform duration-75 origin-bottom"
              style={{ height: '100%', transform: `scaleY(${bar3.toFixed(2)})` }}
            />
          </span>
          <span className="tabular-nums font-medium text-[#6e2226]">
            {formatElapsed(voiceControl.elapsedSec)}
          </span>
          <button
            type="button"
            onClick={voiceControl.onStop}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#3a231c] text-[#f6f1e6] hover:bg-[#4c2e25] transition-colors cursor-pointer whitespace-nowrap shrink-0 font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e]"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
            <span>Done</span>
          </button>
          <button
            type="button"
            onClick={voiceControl.onCancel}
            aria-label="Cancel voice recording"
            title="Cancel recording"
            className="p-0.5 text-[#786755] hover:text-[#261f19] transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    if (isThisPageTranscribing) {
      return (
        <div className="inline-flex items-center gap-1.5 py-0.5 text-[11.5px] sm:text-[12px] text-[#6d5d4b] shrink-0">
          <Loader2 className="w-3 h-3 animate-spin shrink-0 text-[#847461]" />
          <span className="whitespace-nowrap">Transcribing…</span>
        </div>
      );
    }

    return (
      <button
        type="button"
        disabled={locked || isOtherPageVoiceBusy}
        onClick={() => voiceControl.onStart(spreadIndex, side)}
        title="Record voice into this page"
        className="inline-flex items-center gap-1 py-0.5 text-[11.5px] sm:text-[12px] text-[#847461] hover:text-[#261f19] transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:underline"
      >
        <Mic className="w-3 h-3 opacity-75" strokeWidth={1.65} />
        <span>Record</span>
      </button>
    );
  };

  const renderVoiceError = () => {
    if (!interactive || !hasThisPageVoiceError || !voiceControl?.error) {
      return null;
    }
    return (
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] leading-snug text-[#732323] bg-[#faf2eb] border border-[#8c2d2d]/25 rounded px-2 py-1">
        <span>{voiceControl.error}</span>
        <button
          type="button"
          onClick={voiceControl.onClearError}
          className="underline shrink-0 cursor-pointer hover:text-[#4d1414]"
        >
          Dismiss
        </button>
      </div>
    );
  };

  const handleMenuAction = (action?: () => void) => {
    setMenuOpen(false);
    if (interactive && !locked) {
      action?.();
    }
  };

  const renderActionsRow = (compact = false) => (
    <div
      ref={interactive ? menuContainerRef : undefined}
      className="relative flex items-center justify-end gap-2 shrink-0"
    >
      <button
        type="button"
        disabled={!interactive || locked}
        aria-label="Open journal menu"
        aria-haspopup="menu"
        aria-expanded={interactive ? menuOpen : false}
        onClick={() => interactive && !locked && setMenuOpen((prev) => !prev)}
        className={`inline-flex items-center justify-center rounded border transition-colors cursor-pointer shrink-0 disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] ${
          compact ? 'p-1' : 'p-1.5'
        } ${
          menuOpen
            ? 'border-[#57361e]/60 bg-[#e8decb] text-[#261f19]'
            : 'border-[#8c7960]/30 bg-[#efe7d7]/75 text-[#4a3d30] hover:border-[#57361e]/65 hover:text-[#261f19]'
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
        } text-[#6d5d4b] hover:text-[#261f19] transition-colors cursor-pointer whitespace-nowrap shrink-0 px-1 py-0.5 focus-visible:outline-none focus-visible:underline`}
      >
        Close
      </button>

      {interactive && menuOpen ? (
        <div
          role="menu"
          aria-label="Journal actions"
          className="absolute right-0 top-full mt-2 w-48 rounded-md bg-[#faf6ed] border border-[#8c775c]/35 shadow-lg py-1.5 z-50 text-[13px] text-[#2e251d]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleMenuAction(onNewSpread)}
            className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left hover:bg-[#efe6d6] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#6d5d4b] shrink-0" />
            <span>New page</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleMenuAction(onOpenIndex)}
            className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left hover:bg-[#efe6d6] transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#6d5d4b] shrink-0" />
            <span>Entries index</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleMenuAction(onOpenExport)}
            className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left hover:bg-[#efe6d6] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#6d5d4b] shrink-0" />
            <span>Export CSV</span>
          </button>

          <div className="my-1 border-t border-[#8c7960]/20" />

          <button
            type="button"
            role="menuitem"
            onClick={() => handleMenuAction(onOpenAccount)}
            className="w-full px-3.5 py-2 flex items-center justify-between gap-2 text-left hover:bg-[#efe6d6] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <User className="w-3.5 h-3.5 text-[#57361e] shrink-0" />
              <span className="font-medium text-[#3a231c]">
                {isSignedIn ? 'Account & Sync' : 'Sign in'}
              </span>
            </span>
            {!isSignedIn ? (
              <span className="text-[11px] text-[#8a7966]">Google</span>
            ) : null}
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className="relative isolate w-full h-full paper-grain overflow-hidden flex flex-col select-none"
      style={{
        width: `${pageW}px`,
        height: `${pageH}px`,
        paddingLeft: `${paddingX}px`,
        paddingRight: `${paddingX}px`,
        paddingTop: `${paddingTop}px`,
        paddingBottom: `${paddingBottom}px`,
      }}
    >
      {/* Subtle spine gutter curvature shading */}
      {isMobile ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-7"
          style={{
            background:
              'linear-gradient(to right, rgba(38, 27, 16, 0.14) 0%, transparent 100%)',
          }}
        />
      ) : side === 'left' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-12"
          style={{
            background:
              'linear-gradient(to left, rgba(38, 27, 16, 0.17) 0%, rgba(38, 27, 16, 0.06) 42%, transparent 100%)',
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-12"
          style={{
            background:
              'linear-gradient(to right, rgba(38, 27, 16, 0.16) 0%, rgba(38, 27, 16, 0.05) 42%, transparent 100%)',
          }}
        />
      )}

      {/* Subtle outer paper edge highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow:
            side === 'left'
              ? 'inset 1px 0 0 rgba(255,255,255,0.55)'
              : 'inset -1px 0 0 rgba(255,255,255,0.55)',
        }}
      />

      {side === 'left' ? (
        <>
          {/* TOP LEFT: Date + Little Options */}
          <div
            className={`relative ${
              menuOpen ? 'z-30' : 'z-10'
            } pb-2.5 mb-2 border-b border-[#7c6952]/20`}
          >
            {isMobile ? (
              <div className="mb-2 flex items-center justify-end">
                {renderActionsRow(true)}
              </div>
            ) : null}

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
                  className="w-fit font-serif text-base sm:text-lg font-medium text-[#2c241d] bg-[#ebe2d1] px-2 py-0.5 rounded border border-[#8c775c]/40 focus:outline-none focus:border-[#57361e]"
                />
              ) : (
                <button
                  type="button"
                  disabled={!interactive || locked}
                  onClick={() => interactive && !locked && setEditingDate(true)}
                  title={interactive ? 'Click to change entry date' : undefined}
                  className={`text-left group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] rounded ${
                    interactive ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className="text-[11px] sm:text-[12px] tracking-[0.06em] text-[#786755] font-medium">
                    {dateInfo.weekday}
                  </div>
                  <h1 className="font-serif text-[22px] sm:text-[26px] leading-tight font-semibold text-[#261f19] tracking-tight group-hover:text-[#57361e] transition-colors">
                    {dateInfo.monthDay}
                    {dateInfo.year ? (
                      <span className="font-normal text-[#6f5f4d]">
                        , {dateInfo.year}
                      </span>
                    ) : null}
                  </h1>
                </button>
              )}

              <div className="pt-0.5 shrink-0">{renderVoiceControl()}</div>
            </div>

            {/* Little Options directly below the date */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] sm:text-[13px] text-[#6d5d4b]">
              <div className="flex items-center gap-2">
                <span className="text-[#8a7966] text-xs">Ink</span>
                <div className="flex items-center gap-1.5">
                  {(Object.keys(INK_COLORS) as InkColorId[]).map((id) => {
                    const active = spread.inkColor === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={!interactive || locked}
                        aria-label={INK_COLORS[id].label}
                        title={INK_COLORS[id].label}
                        onClick={() =>
                          interactive &&
                          !locked &&
                          onUpdateSpread?.({ inkColor: id })
                        }
                        className={`w-3.5 h-3.5 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#57361e] ${
                          interactive ? 'cursor-pointer hover:scale-110' : ''
                        } ${
                          active
                            ? 'ring-1 ring-offset-2 ring-offset-[#f6f1e6] ring-[#3b2f24] scale-110'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: INK_COLORS[id].swatch }}
                      />
                    );
                  })}
                </div>
              </div>

              <span aria-hidden="true" className="text-[#b8a792]">
                ·
              </span>

              <div className="flex items-center gap-2.5">
                {(['ruled', 'dotted', 'blank'] as PaperStyle[]).map((style) => {
                  const active = spread.paperStyle === style;
                  const label =
                    style === 'ruled'
                      ? 'Ruled'
                      : style === 'dotted'
                        ? 'Dotted'
                        : 'Blank';
                  return (
                    <button
                      key={style}
                      type="button"
                      disabled={!interactive || locked}
                      onClick={() =>
                        interactive &&
                        !locked &&
                        onUpdateSpread?.({ paperStyle: style })
                      }
                      className={`whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:underline ${
                        interactive ? 'cursor-pointer' : ''
                      } ${
                        active
                          ? 'text-[#261f19] font-semibold underline decoration-[#8b6b4a]/60 underline-offset-4'
                          : 'text-[#847461] hover:text-[#3b2f24]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fixed-height quiet setting/mood line */}
            <div className="mt-1.5 h-[26px] flex items-center">
              {interactive ? (
                <input
                  type="text"
                  value={spread.contextNote}
                  readOnly={locked}
                  placeholder="Quiet note (weather, place, mood)..."
                  onChange={(e) =>
                    onUpdateSpread?.({ contextNote: e.target.value })
                  }
                  className="w-full h-[26px] bg-transparent font-hand ink-prose text-[19px] leading-[26px] text-[#6a5948] placeholder:text-[#ab9b87]/80 focus:outline-none focus:text-[#2c241d] select-text"
                />
              ) : (
                <div className="w-full h-[26px] font-hand ink-prose text-[19px] leading-[26px] truncate">
                  {spread.contextNote ? (
                    <span className="text-[#6a5948]">{spread.contextNote}</span>
                  ) : showEmptyPlaceholders ? (
                    <span className="text-[#ab9b87]/80">
                      Quiet note (weather, place, mood)...
                    </span>
                  ) : null}
                </div>
              )}
            </div>
            {renderVoiceError()}
          </div>

          {/* LEFT PAGE HANDWRITTEN BODY */}
          <div className={`relative z-10 flex-1 min-h-0 ${paperRuleClass}`}>
            {interactive ? (
              <textarea
                value={spread.leftBody}
                readOnly={locked}
                onChange={(e) =>
                  onUpdateSpread?.({ leftBody: e.target.value })
                }
                placeholder="Begin writing today's page..."
                spellCheck={false}
                className="w-full h-full resize-none bg-transparent font-hand ink-prose focus:outline-none journal-scroll select-text placeholder:text-[#ab9c88]/70 m-0 p-0 border-0"
                style={{
                  color: ink.hex,
                  fontSize: `${handFontSize}px`,
                  lineHeight: `${handLineHeight}px`,
                  paddingTop: '1px',
                }}
              />
            ) : (
              <div
                className="w-full h-full overflow-hidden whitespace-pre-wrap break-words font-hand ink-prose"
                style={{
                  color: ink.hex,
                  fontSize: `${handFontSize}px`,
                  lineHeight: `${handLineHeight}px`,
                  paddingTop: '1px',
                }}
              >
                {spread.leftBody ? (
                  spread.leftBody
                ) : showEmptyPlaceholders ? (
                  <span className="text-[#ab9c88]/70">
                    Begin writing today&apos;s page...
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {/* LEFT PAGE FOOTER */}
          <div className="relative z-10 pt-2 flex items-center justify-between text-xs text-[#8a7966]">
            {canTurnPrev ? (
              <button
                type="button"
                disabled={!interactive || locked}
                onClick={() => interactive && !locked && onTriggerTurn?.('prev')}
                className="hover:text-[#2b221a] transition-colors cursor-pointer whitespace-nowrap shrink-0 py-1 pr-3 focus-visible:outline-none focus-visible:underline"
              >
                ← Previous
              </button>
            ) : (
              <span className="py-1 text-transparent select-none">←</span>
            )}
            <span className="tabular-nums">{pageNumber}</span>
            {isMobile && canTurnNext ? (
              <button
                type="button"
                disabled={!interactive || locked}
                onClick={() => interactive && !locked && onTriggerTurn?.('next')}
                className="hover:text-[#2b221a] transition-colors cursor-pointer whitespace-nowrap shrink-0 py-1 pl-3 focus-visible:outline-none focus-visible:underline"
              >
                Next →
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <>
          {/* TOP RIGHT: Always-consistent book controls + right-page dictation */}
          <div
            className={`relative ${
              menuOpen ? 'z-30' : 'z-10'
            } pb-2.5 mb-2 border-b border-[#7c6952]/20`}
          >
            {isMobile ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs italic text-[#7a6957] truncate">
                    {dateInfo.monthDay}
                  </span>
                  {renderActionsRow(true)}
                </div>
                {interactive && voiceControl ? (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {renderVoiceControl()}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="shrink-0">{renderVoiceControl()}</div>
                {renderActionsRow(pageW < 360)}
              </div>
            )}
            {renderVoiceError()}
          </div>

          {/* RIGHT PAGE HANDWRITTEN BODY */}
          <div className={`relative z-10 flex-1 min-h-0 ${paperRuleClass}`}>
            {interactive ? (
              <textarea
                value={spread.rightBody}
                readOnly={locked}
                onChange={(e) =>
                  onUpdateSpread?.({ rightBody: e.target.value })
                }
                placeholder="Continue your thoughts on the facing page..."
                spellCheck={false}
                className="w-full h-full resize-none bg-transparent font-hand ink-prose focus:outline-none journal-scroll select-text placeholder:text-[#ab9c88]/70 m-0 p-0 border-0"
                style={{
                  color: ink.hex,
                  fontSize: `${handFontSize}px`,
                  lineHeight: `${handLineHeight}px`,
                  paddingTop: '1px',
                }}
              />
            ) : (
              <div
                className="w-full h-full overflow-hidden whitespace-pre-wrap break-words font-hand ink-prose"
                style={{
                  color: ink.hex,
                  fontSize: `${handFontSize}px`,
                  lineHeight: `${handLineHeight}px`,
                  paddingTop: '1px',
                }}
              >
                {spread.rightBody}
              </div>
            )}
          </div>

          {/* RIGHT PAGE FOOTER */}
          <div className="relative z-10 pt-2 flex items-center justify-between text-xs text-[#8a7966]">
            {isMobile && canTurnPrev ? (
              <button
                type="button"
                disabled={!interactive || locked}
                onClick={() => interactive && !locked && onTriggerTurn?.('prev')}
                className="hover:text-[#2b221a] transition-colors cursor-pointer whitespace-nowrap shrink-0 py-1 pr-3 focus-visible:outline-none focus-visible:underline"
              >
                ← Previous
              </button>
            ) : null}
            <span className="tabular-nums">{pageNumber}</span>
            {canTurnNext ? (
              <button
                type="button"
                disabled={!interactive || locked}
                onClick={() => interactive && !locked && onTriggerTurn?.('next')}
                className="hover:text-[#2b221a] transition-colors cursor-pointer whitespace-nowrap shrink-0 py-1 pl-3 focus-visible:outline-none focus-visible:underline"
              >
                Next →
              </button>
            ) : null}
          </div>
        </>
      )}

      {/* Subtle corner dog-ear sheen to naturally invite folding/turning */}
      {(interactive || showCornerSheen) &&
      ((side === 'right' && canTurnNext) ||
        (side === 'left' && canTurnPrev) ||
        (isMobile && canTurnNext)) ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 z-10 w-5 h-5 opacity-45"
          style={{
            display: isMobile || side === 'right' ? 'block' : 'none',
            background:
              'linear-gradient(135deg, transparent 50%, rgba(155, 134, 108, 0.22) 52%, rgba(255, 252, 245, 0.55) 100%)',
          }}
        />
      ) : null}
      {(interactive || showCornerSheen) &&
      !isMobile &&
      side === 'left' &&
      canTurnPrev ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 z-10 w-5 h-5 opacity-45"
          style={{
            background:
              'linear-gradient(225deg, transparent 50%, rgba(155, 134, 108, 0.22) 52%, rgba(255, 252, 245, 0.55) 100%)',
          }}
        />
      ) : null}
    </div>
  );
};
