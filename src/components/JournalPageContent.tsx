import {
  BookOpen,
  Check,
  ChevronDown,
  Download,
  Loader2,
  Menu,
  Mic,
  Moon,
  PenTool,
  Plus,
  Square,
  Sun,
  User,
  X,
} from 'lucide-react';
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { formatJournalDateParts } from '../data/initialEntries';
import { VoiceControl } from '../hooks/useVoiceRecorder';
import {
  INK_COLORS,
  InkColorId,
  JOURNAL_FONT_ORDER,
  JOURNAL_FONTS,
  JournalSpread,
  PaperStyle,
} from '../types/journal';
import { InkCanvasLayer, InkToolConfig } from './InkCanvasLayer';

export interface PageFocusRequest {
  nonce: number;
  spreadIndex: number;
  side: 'left' | 'right';
  caretOffset: number;
}

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
  isContinuation?: boolean;
  interactive?: boolean;
  locked?: boolean;
  onUpdateSpread?: (patch: Partial<JournalSpread>) => void;
  onPageOverflow?: (
    side: 'left' | 'right',
    fitText: string,
    overflowText: string,
    moveFocus: boolean,
    caretOffset: number
  ) => void;
  focusRequest?: PageFocusRequest | null;
  onClearFocusRequest?: (nonce: number) => void;
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
  inkConfig?: InkToolConfig;
  inkToolbarOpen?: boolean;
  onToggleInkToolbar?: (side: 'left' | 'right') => void;
  onCommitInk?: (side: 'left' | 'right', nextSerialized: string) => void;
  onPenActivity?: () => void;
  onStylusActive?: (side: 'left' | 'right') => void;
  onInkCapacityWarning?: (message: string) => void;
}

const DEFAULT_READONLY_INK_CONFIG: InkToolConfig = {
  tool: 'fountain',
  color: 'charcoal',
  width: 2,
  drawArmed: false,
  allowTouchDraw: false,
};

export const JournalPageContent: React.FC<JournalPageContentProps> = ({
  spread,
  side,
  spreadIndex,
  pageW,
  pageH,
  isMobile = false,
  isContinuation = false,
  interactive = true,
  locked = false,
  onUpdateSpread,
  onPageOverflow,
  focusRequest,
  onClearFocusRequest,
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
  inkConfig = DEFAULT_READONLY_INK_CONFIG,
  inkToolbarOpen = false,
  onToggleInkToolbar,
  onCommitInk,
  onPenActivity,
  onStylusActive,
  onInkCapacityWarning,
}) => {
  const { isDark, toggleTheme, journalFont, setJournalFont } = useTheme();
  const [editingDate, setEditingDate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const fontMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onMenuOpenChange?.(menuOpen || fontMenuOpen);
  }, [fontMenuOpen, menuOpen, onMenuOpenChange]);

  useEffect(() => {
    if (!interactive || locked) {
      setMenuOpen(false);
      setFontMenuOpen(false);
    }
  }, [interactive, locked]);

  useEffect(() => {
    if (!menuOpen && !fontMenuOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        menuOpen &&
        menuContainerRef.current &&
        !menuContainerRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
      if (
        fontMenuOpen &&
        fontMenuRef.current &&
        !fontMenuRef.current.contains(target)
      ) {
        setFontMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setFontMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [fontMenuOpen, menuOpen]);

  const ink = INK_COLORS[spread.inkColor] ?? INK_COLORS.charcoal;
  const activeInkHex = isDark ? ink.darkHex : ink.hex;
  const dateInfo = formatJournalDateParts(spread.date);
  const pageNumber = spreadIndex * 2 + (side === 'left' ? 1 : 2);

  const activeFont = JOURNAL_FONTS[journalFont] ?? JOURNAL_FONTS.caveat;
  const handFontFamily = activeFont.cssFamily;
  const scaleRatio = Math.min(1, Math.max(0.76, pageW / 470));
  const handFontSize = Math.round(23 * scaleRatio * activeFont.sizeScale);
  const contextFontSize = Math.round(19 * activeFont.contextScale);
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

  const bodyContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overflowMeasureRef = useRef<HTMLDivElement | null>(null);
  const [bodyViewportHeight, setBodyViewportHeight] = useState<number>(0);

  const bodyText = side === 'left' ? spread.leftBody : spread.rightBody;

  useLayoutEffect(() => {
    const el = bodyContainerRef.current;
    if (!el) return;
    const sync = () => {
      const h = el.clientHeight || el.getBoundingClientRect().height;
      if (h > 0) {
        setBodyViewportHeight(h);
      }
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isCompactHeader = side === 'right' || isContinuation;
  const estimatedBodyH = Math.max(
    160,
    pageH -
      paddingTop -
      paddingBottom -
      (!isCompactHeader ? (isMobile ? 168 : 135) : isMobile ? 105 : 64) -
      34
  );
  const effectiveViewportH =
    bodyViewportHeight > 0 ? bodyViewportHeight : estimatedBodyH;
  const maxLines = Math.max(
    1,
    Math.floor((effectiveViewportH - 2) / handLineHeight)
  );
  const writableHeightPx = maxLines * handLineHeight + 2;
  const overflowThresholdPx = maxLines * handLineHeight + 6;

  const splitOverflowAtBoundary = (
    textValue: string,
    caretPos: number
  ): {
    fitText: string;
    overflowText: string;
    moveFocus: boolean;
    caretOffset: number;
  } | null => {
    const measureEl = overflowMeasureRef.current;
    if (!measureEl || !textValue) return null;

    const measureH = (candidate: string): number => {
      if (!candidate) return 0;
      measureEl.textContent = candidate.endsWith('\n')
        ? `${candidate}\u200b`
        : candidate;
      return measureEl.offsetHeight || measureEl.getBoundingClientRect().height;
    };

    const fullH = measureH(textValue);
    if (fullH <= overflowThresholdPx) {
      measureEl.textContent = '';
      return null;
    }

    let low = 0;
    let high = textValue.length;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (measureH(textValue.slice(0, mid)) <= overflowThresholdPx) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    let splitIdx = low;
    if (
      splitIdx > 0 &&
      splitIdx < textValue.length &&
      !/\s/.test(textValue[splitIdx]) &&
      !/\s/.test(textValue[splitIdx - 1])
    ) {
      const windowStart = Math.max(0, splitIdx - 42);
      let foundWs = -1;
      for (let i = splitIdx - 1; i >= windowStart; i--) {
        if (/\s/.test(textValue[i])) {
          foundWs = i;
          break;
        }
      }
      if (foundWs > 0) {
        splitIdx = foundWs;
      }
    }

    const fitText = textValue.slice(0, splitIdx);
    const rawTail = textValue.slice(splitIdx);
    const overflowText = rawTail.replace(/^[ \n]/, '');
    const stripped = rawTail.length - overflowText.length;
    const moveFocus = caretPos >= splitIdx;
    const caretOffset = moveFocus
      ? Math.max(0, caretPos - fitText.length - stripped)
      : 0;

    measureEl.textContent = '';
    return { fitText, overflowText, moveFocus, caretOffset };
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    const field = side === 'left' ? 'leftBody' : 'rightBody';

    if (onPageOverflow && nextValue.length > bodyText.length) {
      const caretPos = e.target.selectionStart ?? nextValue.length;
      const split = splitOverflowAtBoundary(nextValue, caretPos);
      if (split) {
        onPageOverflow(
          side,
          split.fitText,
          split.overflowText,
          split.moveFocus,
          split.caretOffset
        );
        return;
      }
    }

    onUpdateSpread?.({ [field]: nextValue });
  };

  // Focus and place cursor cleanly after automatic overflow across pages/turns
  useEffect(() => {
    if (
      !interactive ||
      locked ||
      !focusRequest ||
      focusRequest.spreadIndex !== spreadIndex ||
      focusRequest.side !== side
    ) {
      return;
    }
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = Math.max(0, Math.min(ta.value.length, focusRequest.caretOffset));
    const rafId = requestAnimationFrame(() => {
      ta.focus({ preventScroll: true });
      try {
        ta.setSelectionRange(pos, pos);
      } catch {
        // Ignore selection errors
      }
      onClearFocusRequest?.(focusRequest.nonce);
    });
    return () => cancelAnimationFrame(rafId);
  }, [focusRequest, interactive, locked, onClearFocusRequest, side, spreadIndex]);

  // Also flow overflow cleanly after voice dictation finishes on this page
  const prevVoiceStatusRef = useRef<string | undefined>(voiceControl?.status);
  const splitOverflowRef = useRef(splitOverflowAtBoundary);
  splitOverflowRef.current = splitOverflowAtBoundary;

  useEffect(() => {
    const prevStatus = prevVoiceStatusRef.current;
    const nextStatus = voiceControl?.status;
    prevVoiceStatusRef.current = nextStatus;

    if (
      !interactive ||
      locked ||
      !onPageOverflow ||
      prevStatus !== 'transcribing' ||
      nextStatus !== 'idle' ||
      !bodyText
    ) {
      return;
    }

    const split = splitOverflowRef.current(bodyText, bodyText.length);
    if (split) {
      onPageOverflow(
        side,
        split.fitText,
        split.overflowText,
        true,
        split.caretOffset
      );
    }
  }, [bodyText, interactive, locked, onPageOverflow, side, voiceControl?.status]);

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
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#f2e8dc] dark:bg-[#2d1e1d] border border-[#8f3136]/45 dark:border-[#c95b60]/50 rounded text-[11.5px] sm:text-[12px] text-[#261f19] dark:text-[#f2e6df] shrink-0">
          <span
            className="w-2 h-2 rounded-full bg-[#9e2a2b] dark:bg-[#e56b6f] animate-pulse shrink-0"
            aria-hidden="true"
          />
          <span
            aria-hidden="true"
            className="inline-flex items-end gap-[2px] h-3"
          >
            <span
              className="w-[2px] rounded-full bg-[#8f3136] dark:bg-[#e07b80] transition-transform duration-75 origin-bottom"
              style={{ height: '100%', transform: `scaleY(${bar1.toFixed(2)})` }}
            />
            <span
              className="w-[2px] rounded-full bg-[#8f3136] dark:bg-[#e07b80] transition-transform duration-75 origin-bottom"
              style={{ height: '100%', transform: `scaleY(${bar2.toFixed(2)})` }}
            />
            <span
              className="w-[2px] rounded-full bg-[#8f3136] dark:bg-[#e07b80] transition-transform duration-75 origin-bottom"
              style={{ height: '100%', transform: `scaleY(${bar3.toFixed(2)})` }}
            />
          </span>
          <span className="tabular-nums font-medium text-[#6e2226] dark:text-[#f09e9f]">
            {formatElapsed(voiceControl.elapsedSec)}
          </span>
          <button
            type="button"
            onClick={voiceControl.onStop}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#3a231c] dark:bg-[#d7c4a5] text-[#f6f1e6] dark:text-[#1b1511] hover:bg-[#4c2e25] dark:hover:bg-[#e5d5ba] transition-colors cursor-pointer whitespace-nowrap shrink-0 font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488]"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
            <span>Done</span>
          </button>
          <button
            type="button"
            onClick={voiceControl.onCancel}
            aria-label="Cancel voice recording"
            title="Cancel recording"
            className="p-0.5 text-[#786755] dark:text-[#bfa8a0] hover:text-[#261f19] dark:hover:text-[#f2e6df] transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488] rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    if (isThisPageTranscribing) {
      return (
        <div className="inline-flex items-center gap-1.5 py-0.5 text-[11.5px] sm:text-[12px] text-[#6d5d4b] dark:text-[#9f917f] shrink-0">
          <Loader2 className="w-3 h-3 animate-spin shrink-0 text-[#847461] dark:text-[#9f917f]" />
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
        className="inline-flex items-center gap-1 py-0.5 text-[11.5px] sm:text-[12px] text-[#847461] dark:text-[#9f917f] hover:text-[#261f19] dark:hover:text-[#ece3d4] transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:underline"
      >
        <Mic className="w-3 h-3 opacity-75" strokeWidth={1.65} />
        <span>Record</span>
      </button>
    );
  };

  const renderDrawToggle = () => {
    if (!interactive || !onToggleInkToolbar) return null;
    return (
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
    );
  };

  const renderVoiceError = () => {
    if (!interactive || !hasThisPageVoiceError || !voiceControl?.error) {
      return null;
    }
    return (
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] leading-snug text-[#732323] dark:text-[#f0a8a3] bg-[#faf2eb] dark:bg-[#331a1a]/80 border border-[#8c2d2d]/25 dark:border-[#b84a45]/45 rounded px-2 py-1">
        <span>{voiceControl.error}</span>
        <div className="flex items-center gap-2 shrink-0">
          {!isSignedIn && onOpenAccount ? (
            <button
              type="button"
              onClick={() => {
                voiceControl.onClearError();
                onOpenAccount();
              }}
              className="font-medium underline cursor-pointer text-[#57361e] dark:text-[#deb488] hover:text-[#261f19] dark:hover:text-[#ece3d4]"
            >
              Sign in
            </button>
          ) : null}
          <button
            type="button"
            onClick={voiceControl.onClearError}
            className="underline cursor-pointer hover:text-[#4d1414] dark:hover:text-[#ffd0cc]"
          >
            Dismiss
          </button>
        </div>
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
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={() => interactive && !locked && toggleTheme()}
        className={`inline-flex items-center justify-center rounded border transition-colors cursor-pointer shrink-0 disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488] ${
          compact ? 'p-1' : 'p-1.5'
        } border-[#8c7960]/30 dark:border-[#4b4238] bg-[#efe7d7]/75 dark:bg-[#26221e]/85 text-[#4a3d30] dark:text-[#d5c8b6] hover:border-[#57361e]/65 dark:hover:border-[#deb488]/55 hover:text-[#261f19] dark:hover:text-[#ece3d4]`}
      >
        {isDark ? (
          <Sun className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} strokeWidth={1.75} />
        ) : (
          <Moon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} strokeWidth={1.75} />
        )}
      </button>

      <button
        type="button"
        disabled={!interactive || locked}
        aria-label="Open journal menu"
        aria-haspopup="menu"
        aria-expanded={interactive ? menuOpen : false}
        onClick={() => interactive && !locked && setMenuOpen((prev) => !prev)}
        className={`inline-flex items-center justify-center rounded border transition-colors cursor-pointer shrink-0 disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#57361e] dark:focus-visible:ring-[#deb488] ${
          compact ? 'p-1' : 'p-1.5'
        } ${
          menuOpen
            ? 'border-[#57361e]/60 dark:border-[#deb488]/60 bg-[#e8decb] dark:bg-[#312b25] text-[#261f19] dark:text-[#ece3d4]'
            : 'border-[#8c7960]/30 dark:border-[#4b4238] bg-[#efe7d7]/75 dark:bg-[#26221e]/85 text-[#4a3d30] dark:text-[#d5c8b6] hover:border-[#57361e]/65 dark:hover:border-[#deb488]/55 hover:text-[#261f19] dark:hover:text-[#ece3d4]'
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
        } text-[#6d5d4b] dark:text-[#9f917f] hover:text-[#261f19] dark:hover:text-[#ece3d4] transition-colors cursor-pointer whitespace-nowrap shrink-0 px-1 py-0.5 focus-visible:outline-none focus-visible:underline`}
      >
        Close
      </button>

      {interactive && menuOpen ? (
        <div
          role="menu"
          aria-label="Journal actions"
          className="absolute right-0 top-full mt-2 w-48 rounded-md bg-[#faf6ed] dark:bg-[#231f1b] border border-[#8c775c]/35 dark:border-[#4d4339] shadow-lg dark:shadow-2xl py-1.5 z-50 text-[13px] text-[#2e251d] dark:text-[#ece3d4]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleMenuAction(onNewSpread)}
            className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left hover:bg-[#efe6d6] dark:hover:bg-[#2f2924] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#6d5d4b] dark:text-[#9f917f] shrink-0" />
            <span>New page</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleMenuAction(onOpenIndex)}
            className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left hover:bg-[#efe6d6] dark:hover:bg-[#2f2924] transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#6d5d4b] dark:text-[#9f917f] shrink-0" />
            <span>Entries index</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleMenuAction(onOpenExport)}
            className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left hover:bg-[#efe6d6] dark:hover:bg-[#2f2924] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#6d5d4b] dark:text-[#9f917f] shrink-0" />
            <span>Export CSV</span>
          </button>

          <div className="my-1 border-t border-[#8c7960]/20 dark:border-[#423a32]" />

          <div className="px-3.5 py-1.5">
            <div className="text-[11px] tracking-wide text-[#8a7966] dark:text-[#9f917f] mb-1.5">
              Font style
            </div>
            <div className="grid grid-cols-2 gap-1">
              {JOURNAL_FONT_ORDER.map((id) => {
                const opt = JOURNAL_FONTS[id];
                const active = journalFont === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => setJournalFont(id)}
                    className={`px-2 py-1 rounded text-left text-[13px] leading-tight transition-colors cursor-pointer truncate ${
                      active
                        ? 'bg-[#3a231c] dark:bg-[#d7c4a5] text-[#f6f1e6] dark:text-[#1b1511] font-medium'
                        : 'bg-[#f1e9da]/70 dark:bg-[#2c2722] text-[#3a2d22] dark:text-[#d5c8b6] hover:bg-[#e6dcc8] dark:hover:bg-[#38312b]'
                    }`}
                    style={{ fontFamily: opt.cssFamily }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="my-1 border-t border-[#8c7960]/20 dark:border-[#423a32]" />

          <button
            type="button"
            role="menuitem"
            onClick={() => handleMenuAction(onOpenAccount)}
            className="w-full px-3.5 py-2 flex items-center justify-between gap-2 text-left hover:bg-[#efe6d6] dark:hover:bg-[#2f2924] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <User className="w-3.5 h-3.5 text-[#57361e] dark:text-[#deb488] shrink-0" />
              <span className="font-medium text-[#3a231c] dark:text-[#ece3d4]">
                {isSignedIn ? 'Account & Sync' : 'Sign in'}
              </span>
            </span>
            {!isSignedIn ? (
              <span className="text-[11px] text-[#8a7966] dark:text-[#9f917f]">Google</span>
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
          className="pointer-events-none absolute inset-y-0 left-0 w-7 spine-gutter-mobile"
        />
      ) : side === 'left' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-12 spine-gutter-left"
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-12 spine-gutter-right"
        />
      )}

      {/* Subtle outer paper edge highlight */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${
          side === 'left' ? 'paper-edge-left' : 'paper-edge-right'
        }`}
      />

      {side === 'left' ? (
        <>
          {/* TOP LEFT: Full Date + Options on first spread of date, or simple compact bar on continuation spreads */}
          {isContinuation ? (
            <div
              className={`relative ${
                menuOpen ? 'z-30' : 'z-10'
              } pb-2.5 mb-2 border-b border-[#7c6952]/20 dark:border-[#423a32]`}
            >
              {isMobile ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs italic text-[#7a6957] dark:text-[#9f917f] truncate">
                      Continued · {dateInfo.monthDay}
                    </span>
                    {renderActionsRow(true)}
                  </div>
                  {interactive ? (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {renderDrawToggle()}
                        {voiceControl ? renderVoiceControl() : null}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex items-center justify-between gap-2 min-h-[30px]">
                  <div className="shrink-0 flex items-center gap-2">
                    {renderDrawToggle()}
                    {renderVoiceControl()}
                  </div>
                  <span className="text-xs italic text-[#7a6957] dark:text-[#9f917f] whitespace-nowrap shrink-0 truncate">
                    Continued · {dateInfo.monthDay}
                  </span>
                </div>
              )}
              {renderVoiceError()}
            </div>
          ) : (
            <div
              className={`relative ${
                menuOpen || fontMenuOpen ? 'z-30' : 'z-10'
              } pb-2.5 mb-2 border-b border-[#7c6952]/20 dark:border-[#423a32]`}
            >
              {isMobile ? (
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 shrink-0">
                    {renderDrawToggle()}
                    {renderVoiceControl()}
                  </div>
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
                      {dateInfo.year ? (
                        <span className="font-normal text-[#6f5f4d] dark:text-[#9f917f]">
                          , {dateInfo.year}
                        </span>
                      ) : null}
                    </h1>
                  </button>
                )}

                {!isMobile ? (
                  <div className="pt-0.5 shrink-0 flex items-center gap-2">
                    {renderDrawToggle()}
                    {renderVoiceControl()}
                  </div>
                ) : null}
              </div>

              {/* Little Options directly below the date */}
              <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] sm:text-[13px] text-[#6d5d4b] dark:text-[#9f917f]">
                <div className="flex items-center gap-2">
                  <span className="text-[#8a7966] dark:text-[#8f8170] text-xs">Ink</span>
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
                      setMenuOpen(false);
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
                    {spread.contextNote ? (
                      <span className="text-[#6a5948] dark:text-[#b7a896]">
                        {spread.contextNote}
                      </span>
                    ) : showEmptyPlaceholders ? (
                      <span className="text-[#ab9b87]/80 dark:text-[#6f6356]">
                        Quiet note (weather, place, mood)...
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
              {renderVoiceError()}
            </div>
          )}

          {/* LEFT PAGE FIXED PHYSICAL SHEET (NO SCROLL + RULED LINES + TEXT + STYLUS INK) */}
          <div
            ref={bodyContainerRef}
            className={`relative z-10 flex-1 min-h-0 overflow-hidden ${paperRuleClass}`}
          >
            <div
              ref={overflowMeasureRef}
              aria-hidden="true"
              className="pointer-events-none invisible absolute top-0 left-0 right-0 whitespace-pre-wrap break-words ink-prose m-0 p-0 border-0"
              style={{
                fontFamily: handFontFamily,
                fontSize: `${handFontSize}px`,
                lineHeight: `${handLineHeight}px`,
                paddingTop: '1px',
              }}
            />
            <InkCanvasLayer
              serializedInk={spread.leftInk}
              interactive={interactive}
              locked={locked}
              isDark={isDark}
              inkConfig={inkConfig}
              onCommitInk={(nextInk) => onCommitInk?.('left', nextInk)}
              onPenActivity={onPenActivity}
              onStylusActive={() => onStylusActive?.('left')}
              onCapacityWarning={onInkCapacityWarning}
            >
              {interactive ? (
                <textarea
                  ref={textareaRef}
                  value={spread.leftBody}
                  readOnly={locked}
                  onChange={handleBodyChange}
                  placeholder={
                    inkConfig.drawArmed || spread.leftInk
                      ? ''
                      : isContinuation
                        ? 'Continue writing...'
                        : "Begin writing today's page..."
                  }
                  spellCheck={false}
                  className="w-full resize-none overflow-hidden bg-transparent ink-prose focus:outline-none select-text placeholder:text-[#ab9c88]/70 dark:placeholder:text-[#6c6053] m-0 p-0 border-0"
                  style={{
                    height: `${writableHeightPx}px`,
                    color: activeInkHex,
                    fontFamily: handFontFamily,
                    fontSize: `${handFontSize}px`,
                    lineHeight: `${handLineHeight}px`,
                    paddingTop: '1px',
                  }}
                />
              ) : (
                <div
                  className="w-full overflow-hidden whitespace-pre-wrap break-words ink-prose"
                  style={{
                    height: `${writableHeightPx}px`,
                    color: activeInkHex,
                    fontFamily: handFontFamily,
                    fontSize: `${handFontSize}px`,
                    lineHeight: `${handLineHeight}px`,
                    paddingTop: '1px',
                  }}
                >
                  {spread.leftBody ? (
                    spread.leftBody
                  ) : showEmptyPlaceholders && !spread.leftInk ? (
                    <span className="text-[#ab9c88]/70 dark:text-[#6c6053]">
                      {isContinuation
                        ? 'Continue writing...'
                        : "Begin writing today's page..."}
                    </span>
                  ) : null}
                </div>
              )}
            </InkCanvasLayer>
          </div>

          {/* LEFT PAGE FOOTER */}
          <div className="relative z-10 pt-2 flex items-center justify-between text-xs text-[#8a7966] dark:text-[#8f8170]">
            {canTurnPrev ? (
              <button
                type="button"
                disabled={!interactive || locked}
                onClick={() => interactive && !locked && onTriggerTurn?.('prev')}
                className="hover:text-[#2b221a] dark:hover:text-[#ece3d4] transition-colors cursor-pointer whitespace-nowrap shrink-0 py-1 pr-3 focus-visible:outline-none focus-visible:underline"
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
                className="hover:text-[#2b221a] dark:hover:text-[#ece3d4] transition-colors cursor-pointer whitespace-nowrap shrink-0 py-1 pl-3 focus-visible:outline-none focus-visible:underline"
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
            } pb-2.5 mb-2 border-b border-[#7c6952]/20 dark:border-[#423a32]`}
          >
            {isMobile ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs italic text-[#7a6957] dark:text-[#9f917f] truncate">
                    {dateInfo.monthDay}
                  </span>
                  {renderActionsRow(true)}
                </div>
                {interactive ? (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {renderDrawToggle()}
                      {voiceControl ? renderVoiceControl() : null}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="shrink-0 flex items-center gap-2">
                  {renderDrawToggle()}
                  {renderVoiceControl()}
                </div>
                {renderActionsRow(pageW < 360)}
              </div>
            )}
            {renderVoiceError()}
          </div>

          {/* RIGHT PAGE FIXED PHYSICAL SHEET (NO SCROLL + RULED LINES + TEXT + STYLUS INK) */}
          <div
            ref={bodyContainerRef}
            className={`relative z-10 flex-1 min-h-0 overflow-hidden ${paperRuleClass}`}
          >
            <div
              ref={overflowMeasureRef}
              aria-hidden="true"
              className="pointer-events-none invisible absolute top-0 left-0 right-0 whitespace-pre-wrap break-words ink-prose m-0 p-0 border-0"
              style={{
                fontFamily: handFontFamily,
                fontSize: `${handFontSize}px`,
                lineHeight: `${handLineHeight}px`,
                paddingTop: '1px',
              }}
            />
            <InkCanvasLayer
              serializedInk={spread.rightInk}
              interactive={interactive}
              locked={locked}
              isDark={isDark}
              inkConfig={inkConfig}
              onCommitInk={(nextInk) => onCommitInk?.('right', nextInk)}
              onPenActivity={onPenActivity}
              onStylusActive={() => onStylusActive?.('right')}
              onCapacityWarning={onInkCapacityWarning}
            >
              {interactive ? (
                <textarea
                  ref={textareaRef}
                  value={spread.rightBody}
                  readOnly={locked}
                  onChange={handleBodyChange}
                  placeholder={
                    inkConfig.drawArmed || spread.rightInk
                      ? ''
                      : 'Continue your thoughts on the facing page...'
                  }
                  spellCheck={false}
                  className="w-full resize-none overflow-hidden bg-transparent ink-prose focus:outline-none select-text placeholder:text-[#ab9c88]/70 dark:placeholder:text-[#6c6053] m-0 p-0 border-0"
                  style={{
                    height: `${writableHeightPx}px`,
                    color: activeInkHex,
                    fontFamily: handFontFamily,
                    fontSize: `${handFontSize}px`,
                    lineHeight: `${handLineHeight}px`,
                    paddingTop: '1px',
                  }}
                />
              ) : (
                <div
                  className="w-full overflow-hidden whitespace-pre-wrap break-words ink-prose"
                  style={{
                    height: `${writableHeightPx}px`,
                    color: activeInkHex,
                    fontFamily: handFontFamily,
                    fontSize: `${handFontSize}px`,
                    lineHeight: `${handLineHeight}px`,
                    paddingTop: '1px',
                  }}
                >
                  {spread.rightBody}
                </div>
              )}
            </InkCanvasLayer>
          </div>

          {/* RIGHT PAGE FOOTER */}
          <div className="relative z-10 pt-2 flex items-center justify-between text-xs text-[#8a7966] dark:text-[#8f8170]">
            {isMobile && canTurnPrev ? (
              <button
                type="button"
                disabled={!interactive || locked}
                onClick={() => interactive && !locked && onTriggerTurn?.('prev')}
                className="hover:text-[#2b221a] dark:hover:text-[#ece3d4] transition-colors cursor-pointer whitespace-nowrap shrink-0 py-1 pr-3 focus-visible:outline-none focus-visible:underline"
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
                className="hover:text-[#2b221a] dark:hover:text-[#ece3d4] transition-colors cursor-pointer whitespace-nowrap shrink-0 py-1 pl-3 focus-visible:outline-none focus-visible:underline"
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
          className="pointer-events-none absolute bottom-0 right-0 z-10 w-5 h-5 opacity-45 corner-sheen-right"
          style={{
            display: isMobile || side === 'right' ? 'block' : 'none',
          }}
        />
      ) : null}
      {(interactive || showCornerSheen) &&
      !isMobile &&
      side === 'left' &&
      canTurnPrev ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 z-10 w-5 h-5 opacity-45 corner-sheen-left"
        />
      ) : null}
    </div>
  );
};
