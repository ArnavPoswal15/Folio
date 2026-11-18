import { useCallback, useEffect, useRef, useState } from 'react';
import { VOICE_RECORDER_CONFIG } from '../constants/voice';
import { auth } from '../lib/firebase';
import {
  RecordingStatus,
  RecordingTarget,
  UseVoiceRecorderOptions,
  VoiceControl,
} from '../types/voice';
import { prepareAudioForTranscription } from '../utils/audioWav';
import {
  blobToBase64,
  formatMicError,
  selectSupportedMimeType,
} from '../utils/voice';
import { useAudioLevelMeter } from './useAudioLevelMeter';

/**
 * Manages microphone capture via MediaRecorder, audio normalization, and authenticated transcription requests.
 * @param options - Configuration specifying enabled gate and transcript delivery callback.
 * @returns VoiceControl state, level subscriber, and recording lifecycle handlers.
 */
export function useVoiceRecorder({
  enabled,
  onTranscribed,
}: UseVoiceRecorderOptions): VoiceControl {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [target, setTarget] = useState<RecordingTarget | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorTarget, setErrorTarget] = useState<RecordingTarget | null>(null);

  const { startMeter, stopMeter, subscribeLevel } = useAudioLevelMeter();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
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
    stopMeter();
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
  }, [stopMeter]);

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
            ? new MediaRecorder(stream, {
                mimeType,
                audioBitsPerSecond: VOICE_RECORDER_CONFIG.AUDIO_BITS_PER_SECOND,
              })
            : new MediaRecorder(stream, {
                audioBitsPerSecond: VOICE_RECORDER_CONFIG.AUDIO_BITS_PER_SECOND,
              });
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
          if (rawBlob.size < VOICE_RECORDER_CONFIG.MIN_BLOB_BYTES) {
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
            const prepared = await prepareAudioForTranscription(
              rawBlob,
              recordedMime
            );

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
              setError(
                'No clear speech was detected. Please try speaking a little closer to the mic.'
              );
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

        startMeter(stream);
        recorder.start();

        timerRef.current = window.setInterval(() => {
          setElapsedSec((prev) => {
            const next = prev + 1;
            if (next >= VOICE_RECORDER_CONFIG.MAX_RECORDING_SECONDS) {
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
    [enabled, onStop, startMeter, status, stopMediaTracks]
  );

  return {
    status,
    target,
    elapsedSec,
    subscribeLevel,
    error,
    errorTarget,
    onStart,
    onStop,
    onCancel,
    onClearError,
  };
}
