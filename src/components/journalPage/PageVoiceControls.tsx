import { Loader2, Mic, Square, X } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { VoiceControl } from '../../types/voice';
import { formatElapsed } from '../../utils/voice';

/** Props accepted by the PageVoiceControls status button and meter component. */
interface PageVoiceControlsProps {
  interactive: boolean;
  locked: boolean;
  spreadIndex: number;
  side: 'left' | 'right';
  voiceControl?: VoiceControl;
}

/** Props accepted by the PageVoiceErrorBanner alert component. */
interface PageVoiceErrorBannerProps {
  interactive: boolean;
  spreadIndex: number;
  side: 'left' | 'right';
  isSignedIn: boolean;
  voiceControl?: VoiceControl;
  onOpenAccount?: () => void;
}

/**
 * Renders the voice dictation record/stop/transcribing controls with ref-driven audio meter bars.
 * @param props - Interactivity flags, spread coordinates, and shared VoiceControl state/handlers.
 * @returns Voice recording trigger, live level indicator, or transcribing status indicator.
 */
export const PageVoiceControls: React.FC<PageVoiceControlsProps> = ({
  interactive,
  locked,
  spreadIndex,
  side,
  voiceControl,
}) => {
  const bar1Ref = useRef<HTMLSpanElement | null>(null);
  const bar2Ref = useRef<HTMLSpanElement | null>(null);
  const bar3Ref = useRef<HTMLSpanElement | null>(null);

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

  useEffect(() => {
    if (!isThisPageRecording || !voiceControl) return;
    return voiceControl.subscribeLevel((level) => {
      const b1 = Math.max(0.28, Math.min(1, level * 1.1));
      const b2 = Math.max(0.22, Math.min(1, level * 1.45));
      const b3 = Math.max(0.28, Math.min(1, level * 0.95));
      if (bar1Ref.current) bar1Ref.current.style.transform = `scaleY(${b1.toFixed(2)})`;
      if (bar2Ref.current) bar2Ref.current.style.transform = `scaleY(${b2.toFixed(2)})`;
      if (bar3Ref.current) bar3Ref.current.style.transform = `scaleY(${b3.toFixed(2)})`;
    });
  }, [isThisPageRecording, voiceControl]);

  if (!interactive || !voiceControl) return null;

  if (isThisPageRecording) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#f2e8dc] dark:bg-[#2d1e1d] border border-[#8f3136]/45 dark:border-[#c95b60]/50 rounded text-[11.5px] sm:text-[12px] text-[#261f19] dark:text-[#f2e6df] shrink-0">
        <span
          className="w-2 h-2 rounded-full bg-[#9e2a2b] dark:bg-[#e56b6f] animate-pulse shrink-0"
          aria-hidden="true"
        />
        <span aria-hidden="true" className="inline-flex items-end gap-[2px] h-3">
          <span
            ref={bar1Ref}
            className="w-[2px] rounded-full bg-[#8f3136] dark:bg-[#e07b80] transition-transform duration-75 origin-bottom"
            style={{ height: '100%', transform: 'scaleY(0.28)' }}
          />
          <span
            ref={bar2Ref}
            className="w-[2px] rounded-full bg-[#8f3136] dark:bg-[#e07b80] transition-transform duration-75 origin-bottom"
            style={{ height: '100%', transform: 'scaleY(0.22)' }}
          />
          <span
            ref={bar3Ref}
            className="w-[2px] rounded-full bg-[#8f3136] dark:bg-[#e07b80] transition-transform duration-75 origin-bottom"
            style={{ height: '100%', transform: 'scaleY(0.28)' }}
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

/**
 * Renders an inline voice transcription error banner for the targeted page header when active.
 * @param props - Page coordinates, sign-in flag, VoiceControl state, and account trigger.
 * @returns Inline error notice with optional Sign-In and Dismiss buttons, or null.
 */
export const PageVoiceErrorBanner: React.FC<PageVoiceErrorBannerProps> = ({
  interactive,
  spreadIndex,
  side,
  isSignedIn,
  voiceControl,
  onOpenAccount,
}) => {
  const hasThisPageVoiceError = Boolean(
    voiceControl?.error &&
      voiceControl.errorTarget?.spreadIndex === spreadIndex &&
      voiceControl.errorTarget?.side === side
  );

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
