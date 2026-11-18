import { useCallback, useEffect, useRef } from 'react';
import { VOICE_RECORDER_CONFIG } from '../constants/voice';

/**
 * Samples live microphone RMS audio level via Web Audio API and notifies subscribers at 60fps without React re-renders.
 * @returns Controls to start/stop sampling and a `subscribeLevel` emitter for DOM-ref meter bars.
 */
export function useAudioLevelMeter() {
  const meterRafRef = useRef<number | null>(null);
  const meterCtxRef = useRef<AudioContext | null>(null);
  const listenersRef = useRef<Set<(level: number) => void>>(new Set());
  const currentLevelRef = useRef(0);

  const emitLevel = useCallback((level: number) => {
    currentLevelRef.current = level;
    listenersRef.current.forEach((listener) => listener(level));
  }, []);

  const stopMeter = useCallback(() => {
    if (meterRafRef.current !== null) {
      window.cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    if (meterCtxRef.current) {
      void meterCtxRef.current.close().catch(() => {});
      meterCtxRef.current = null;
    }
    emitLevel(0);
  }, [emitLevel]);

  const startMeter = useCallback(
    (stream: MediaStream) => {
      stopMeter();
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
        analyser.fftSize = VOICE_RECORDER_CONFIG.ANALYSER_FFT_SIZE;
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
          emitLevel(Math.min(1, rms * VOICE_RECORDER_CONFIG.METER_RMS_GAIN));
          meterRafRef.current = window.requestAnimationFrame(tick);
        };
        meterRafRef.current = window.requestAnimationFrame(tick);
      } catch {
        // Ignore if AudioContext meter is blocked
      }
    },
    [emitLevel, stopMeter]
  );

  const subscribeLevel = useCallback((listener: (level: number) => void) => {
    listenersRef.current.add(listener);
    listener(currentLevelRef.current);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => stopMeter, [stopMeter]);

  return {
    startMeter,
    stopMeter,
    subscribeLevel,
  };
}
