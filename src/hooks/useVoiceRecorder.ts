import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '../lib/firebase';
import { prepareAudioForTranscription } from '../utils/audioWav';

export type RecordingStatus = 'idle' | 'recording' | 'transcribing';

export interface RecordingTarget {
  spreadIndex: number;
  side: 'left' | 'right';
}

export interface VoiceControl {
  status: RecordingStatus;
  target: RecordingTarget | null;
  elapsedSec: number;
  level: number;
  error: string | null;
  errorTarget: RecordingTarget | null;
  onStart: (spreadIndex: number, side: 'left' | 'right') => void;
  onStop: () => void;
  onCancel: () => void;
  onClearError: () => void;
}

interface UseVoiceRecorderOptions {
  enabled: boolean;
  onTranscribed: (target: RecordingTarget, text: string) => void;
}

const MAX_RECORDING_SECONDS = 180;

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

function selectSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('Failed to encode audio recording.'));
        return;
      }
      resolve(result.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(new Error('Failed to read audio recording.'));
    reader.readAsDataURL(blob);
  });
}

function formatMicError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone permission was denied. Allow mic access to record.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Microphone is currently in use by another app.';
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Could not start voice recording.';
}

export function useVoiceRecorder({ enabled, onTranscribed }: UseVoiceRecorderOptions): VoiceControl {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [target, setTarget] = useState<RecordingTarget | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorTarget, setErrorTarget] = useState<RecordingTarget | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const meterCtxRef = useRef<AudioContext | null>(null);
  const startingRef = useRef(false);
  const actionRef = useRef<'transcribe' | 'cancel'>('transcribe');
  const targetRef = useRef<RecordingTarget | null>(null);
  const onTranscribedRef = useRef(onTranscribed);
  onTranscribedRef.current = onTranscribed;

  const stopMediaTracks = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (meterRafRef.current !== null) {
      window.cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    if (meterCtxRef.current) {
      void meterCtxRef.current.close().catch(() => {});
      meterCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      streamRef.current = null;
    }
    recorderRef.current = null;
    setLevel(0);
  }, []);

  const onCancel = useCallback(() => {
    actionRef.current = 'cancel';
    startingRef.current = false;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        stopMediaTracks();
      }
    } else {
      stopMediaTracks();
    }
    chunksRef.current = [];
    targetRef.current = null;
    setTarget(null);
    setElapsedSec(0);
    setStatus('idle');
  }, [stopMediaTracks]);

  const onStop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    actionRef.current = 'transcribe';
    try {
      recorder.stop();
    } catch {
      const captured = targetRef.current;
      stopMediaTracks();
      targetRef.current = null;
      setStatus('idle');
      setTarget(null);
      setErrorTarget(captured);
      setError('Could not finish recording.');
    }
  }, [stopMediaTracks]);

  useEffect(() => {
    if (!enabled && status === 'recording') {
      onCancel();
    }
  }, [enabled, onCancel, status]);

  useEffect(() => {
    return () => {
      actionRef.current = 'cancel';
      stopMediaTracks();
    };
  }, [stopMediaTracks]);

  const onClearError = useCallback(() => {
    setError(null);
    setErrorTarget(null);
  }, []);

  const startLiveLevelMeter = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      meterCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!meterCtxRef.current) return;
        analyser.getByteTimeDomainData(data);
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) {
          const normalized = (data[i] - 128) / 128;
          sumSq += normalized * normalized;
        }
        const rms = Math.sqrt(sumSq / data.length);
        setLevel(Math.min(1, rms * 5.5));
        meterRafRef.current = window.requestAnimationFrame(tick);
      };
      meterRafRef.current = window.requestAnimationFrame(tick);
    } catch {
      // Ignore if AudioContext meter is blocked
    }
  }, []);

  const onStart = useCallback(
    async (spreadIndex: number, side: 'left' | 'right') => {
      if (!enabled || status !== 'idle' || startingRef.current) return;

      const nextTarget: RecordingTarget = { spreadIndex, side };

      if (!auth.currentUser) {
        setErrorTarget(nextTarget);
        setError('Sign in with Google to use voice dictation.');
        return;
      }

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === 'undefined'
      ) {
        setErrorTarget(nextTarget);
        setError('Voice recording is not supported in this browser.');
        return;
      }

      startingRef.current = true;
      setError(null);
      setErrorTarget(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const mimeType = selectSupportedMimeType();
        let recorder: MediaRecorder;
        try {
          recorder = mimeType
            ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32_000 })
            : new MediaRecorder(stream, { audioBitsPerSecond: 32_000 });
        } catch {
          recorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);
        }

        recorderRef.current = recorder;
        chunksRef.current = [];
        actionRef.current = 'transcribe';
        targetRef.current = nextTarget;

        recorder.ondataavailable = (ev: BlobEvent) => {
          if (ev.data && ev.data.size > 0) {
            chunksRef.current.push(ev.data);
          }
        };

        recorder.onstop = async () => {
          const mode = actionRef.current;
          const capturedTarget = targetRef.current;
          const recordedMime = recorder.mimeType || mimeType || 'audio/webm';
          const blobs = chunksRef.current;
          chunksRef.current = [];

          stopMediaTracks();

          if (mode === 'cancel' || !capturedTarget) {
            targetRef.current = null;
            setTarget(null);
            setElapsedSec(0);
            setStatus('idle');
            return;
          }

          const rawBlob = new Blob(blobs, { type: recordedMime });
          if (rawBlob.size < 250) {
            targetRef.current = null;
            setTarget(null);
            setElapsedSec(0);
            setStatus('idle');
            setErrorTarget(capturedTarget);
            setError('Recording was too short. Speak clearly and try again.');
            return;
          }

          setStatus('transcribing');

          try {
            const prepared = await prepareAudioForTranscription(rawBlob, recordedMime);

            if (prepared?.isSilent) {
              setErrorTarget(capturedTarget);
              setError(
                'Your microphone captured silence. Check your mic input or unmute and try again.'
              );
              return;
            }

            const uploadBlob = prepared ? prepared.blob : rawBlob;
            const uploadMime = prepared
              ? prepared.mimeType
              : recordedMime.split(';')[0].trim() || 'audio/webm';

            const currentUser = auth.currentUser;
            if (!currentUser) {
              throw new Error('Sign in with Google to use voice dictation.');
            }
            const idToken = await currentUser.getIdToken();
            const audioBase64 = await blobToBase64(uploadBlob);

            const res = await fetch('/api/transcribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                audioBase64,
                mimeType: uploadMime,
                durationSec: prepared
                  ? Number(prepared.durationSec.toFixed(2))
                  : undefined,
              }),
            });

            const data = (await res.json().catch(() => ({}))) as {
              text?: string;
              error?: string;
            };

            if (!res.ok) {
              throw new Error(data.error || 'Could not transcribe recording.');
            }

            const transcript = (data.text ?? '').trim();
            if (!transcript) {
              setErrorTarget(capturedTarget);
              setError('No clear speech was detected. Please try speaking a little closer to the mic.');
            } else {
              onTranscribedRef.current(capturedTarget, transcript);
            }
          } catch (err) {
            setErrorTarget(capturedTarget);
            setError(
              err instanceof Error && err.message
                ? err.message
                : 'Could not transcribe recording right now.'
            );
          } finally {
            targetRef.current = null;
            setTarget(null);
            setElapsedSec(0);
            setStatus('idle');
          }
        };

        setTarget(nextTarget);
        setElapsedSec(0);
        setStatus('recording');

        startLiveLevelMeter(stream);
        // Record as a single intact media stream without slicing so container headers stay clean
        recorder.start();

        timerRef.current = window.setInterval(() => {
          setElapsedSec((prev) => {
            const next = prev + 1;
            if (next >= MAX_RECORDING_SECONDS) {
              window.setTimeout(() => onStop(), 0);
            }
            return next;
          });
        }, 1000);
      } catch (err) {
        stopMediaTracks();
        targetRef.current = null;
        setTarget(null);
        setElapsedSec(0);
        setStatus('idle');
        setErrorTarget(nextTarget);
        setError(formatMicError(err));
      } finally {
        startingRef.current = false;
      }
    },
    [enabled, onStop, startLiveLevelMeter, status, stopMediaTracks]
  );

  return {
    status,
    target,
    elapsedSec,
    level,
    error,
    errorTarget,
    onStart,
    onStop,
    onCancel,
    onClearError,
  };
}
