/** Current lifecycle phase of the voice dictation recorder. */
export type RecordingStatus = 'idle' | 'recording' | 'transcribing';

/** Spread and page side targeted by an active or failed voice dictation session. */
export interface RecordingTarget {
  spreadIndex: number;
  side: 'left' | 'right';
}

/** Voice recording state and handlers exposed to page headers and error banners. */
export interface VoiceControl {
  status: RecordingStatus;
  target: RecordingTarget | null;
  elapsedSec: number;
  /** Subscribes a callback to 60fps RMS meter updates (0..1) without triggering React re-renders. */
  subscribeLevel: (listener: (level: number) => void) => () => void;
  error: string | null;
  errorTarget: RecordingTarget | null;
  onStart: (spreadIndex: number, side: 'left' | 'right') => void;
  onStop: () => void;
  onCancel: () => void;
  onClearError: () => void;
}

/** Options accepted by the useVoiceRecorder hook. */
export interface UseVoiceRecorderOptions {
  enabled: boolean;
  onTranscribed: (target: RecordingTarget, text: string) => void;
}

/** Output produced when normalizing recorded audio to 16 kHz mono WAV. */
export interface WavConversionResult {
  blob: Blob;
  durationSec: number;
  rms: number;
  peak: number;
}

/** Result returned by prepareAudioForTranscription indicating silence or gain-boosted WAV fallback. */
export interface PreparedAudioResult {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  rms: number;
  peak: number;
  isSilent: boolean;
  usedWavBoost: boolean;
}
