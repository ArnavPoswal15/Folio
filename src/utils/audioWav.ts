import {
  DIRECT_COMPRESSED_MIMES,
  VOICE_RECORDER_CONFIG,
} from '../constants/voice';
import { PreparedAudioResult, WavConversionResult } from '../types/voice';

/**
 * Measures RMS and peak amplitude across the central speech portion of a PCM channel.
 * @param channel - Normalized mono float audio samples (-1..1).
 * @param sampleRate - Audio sample rate in Hz.
 * @returns Root-mean-square level and peak amplitude.
 */
export function measureSpeechStats(
  channel: Float32Array,
  sampleRate: number
): {
  rms: number;
  peak: number;
} {
  const edgeSamples = Math.min(
    Math.floor(sampleRate * VOICE_RECORDER_CONFIG.EDGE_TRIM_SECONDS),
    Math.floor(channel.length * 0.1)
  );
  const startIdx = edgeSamples;
  const endIdx = Math.max(startIdx + 1, channel.length - edgeSamples);

  let peak = 0;
  let sumSq = 0;
  for (let i = startIdx; i < endIdx; i++) {
    const sample = channel[i];
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
    sumSq += sample * sample;
  }

  const count = Math.max(1, endIdx - startIdx);
  return { rms: Math.sqrt(sumSq / count), peak };
}

/**
 * Encodes a mono Float32Array PCM buffer into a 16-bit PCM RIFF WAV Blob with linear gain.
 * @param channel - Normalized mono float audio samples (-1..1).
 * @param sampleRate - Output WAV sample rate in Hz.
 * @param gain - Linear gain multiplier applied before 16-bit quantization.
 * @returns Encoded WAV Blob (`audio/wav`).
 */
export function encodeMonoWavFromChannel(
  channel: Float32Array,
  sampleRate: number,
  gain: number
): Blob {
  const wavBuffer = new ArrayBuffer(44 + channel.length * 2);
  const view = new DataView(wavBuffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + channel.length * 2, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, channel.length * 2, true);

  let offset = 44;
  for (let i = 0; i < channel.length; i++) {
    const scaled = Math.max(-1, Math.min(1, channel[i] * gain));
    const intSample = scaled < 0 ? scaled * 0x8000 : scaled * 0x7fff;
    view.setInt16(offset, Math.round(intSample), true);
    offset += 2;
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Prepares recorded audio for transcription by rejecting silence, fast-passing clear compressed clips, or gain-boosting quiet mics to 16 kHz mono WAV.
 * @param rawBlob - Raw audio Blob captured from MediaRecorder.
 * @param recordedMime - Reported MediaRecorder MIME type string.
 * @returns Prepared audio payload metadata, or null if decoding failed.
 */
export async function prepareAudioForTranscription(
  rawBlob: Blob,
  recordedMime: string
): Promise<PreparedAudioResult | null> {
  const cleanMime =
    recordedMime.split(';')[0].trim().toLowerCase() || 'audio/webm';
  if (typeof window === 'undefined') return null;

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;

  const ctx = new AudioCtx();
  try {
    const arrayBuffer = await rawBlob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    if (!decoded || decoded.length === 0 || decoded.duration <= 0) {
      return null;
    }

    const channel0 = decoded.getChannelData(0);
    const { rms, peak } = measureSpeechStats(channel0, decoded.sampleRate);

    if (
      peak < VOICE_RECORDER_CONFIG.SILENCE_PEAK_THRESHOLD &&
      rms < VOICE_RECORDER_CONFIG.SILENCE_RMS_THRESHOLD
    ) {
      return {
        blob: rawBlob,
        mimeType: cleanMime,
        durationSec: decoded.duration,
        rms,
        peak,
        isSilent: true,
        usedWavBoost: false,
      };
    }

    if (
      rms >= VOICE_RECORDER_CONFIG.DIRECT_COMPRESSED_MIN_RMS &&
      DIRECT_COMPRESSED_MIMES.has(cleanMime) &&
      rawBlob.size <= VOICE_RECORDER_CONFIG.MAX_DIRECT_UPLOAD_BYTES
    ) {
      return {
        blob: rawBlob,
        mimeType: cleanMime,
        durationSec: decoded.duration,
        rms,
        peak,
        isSilent: false,
        usedWavBoost: false,
      };
    }

    const OfflineCtx =
      window.OfflineAudioContext ||
      (
        window as unknown as {
          webkitOfflineAudioContext?: typeof OfflineAudioContext;
        }
      ).webkitOfflineAudioContext;
    if (!OfflineCtx) {
      return {
        blob: rawBlob,
        mimeType: cleanMime,
        durationSec: decoded.duration,
        rms,
        peak,
        isSilent: false,
        usedWavBoost: false,
      };
    }

    const targetSampleRate = VOICE_RECORDER_CONFIG.TARGET_SAMPLE_RATE_HZ;
    const targetLength = Math.max(
      1,
      Math.ceil(decoded.duration * targetSampleRate)
    );
    const offline = new OfflineCtx(1, targetLength, targetSampleRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);

    const rendered = await offline.startRendering();
    const monoChannel = rendered.getChannelData(0);
    const monoStats = measureSpeechStats(monoChannel, targetSampleRate);

    let gain = 1;
    if (monoStats.rms > 0.0004 && monoStats.rms < 0.08) {
      const desiredGain = VOICE_RECORDER_CONFIG.TARGET_WAV_RMS / monoStats.rms;
      const maxSafeGain =
        monoStats.peak > 0
          ? VOICE_RECORDER_CONFIG.MAX_SAFE_PEAK / monoStats.peak
          : VOICE_RECORDER_CONFIG.MAX_WAV_GAIN;
      gain = Math.max(
        1,
        Math.min(VOICE_RECORDER_CONFIG.MAX_WAV_GAIN, desiredGain, maxSafeGain)
      );
    }

    return {
      blob: encodeMonoWavFromChannel(monoChannel, targetSampleRate, gain),
      mimeType: 'audio/wav',
      durationSec: decoded.duration,
      rms: monoStats.rms,
      peak: monoStats.peak,
      isSilent: false,
      usedWavBoost: true,
    };
  } catch {
    return null;
  } finally {
    void ctx.close().catch(() => {});
  }
}

/**
 * Convenience wrapper that prepares an arbitrary audio Blob into 16 kHz mono WAV stats.
 * @param blob - Raw audio Blob.
 * @returns Normalized WAV Blob and speech statistics, or null on decode failure.
 */
export async function convertBlobToMonoWav(
  blob: Blob
): Promise<WavConversionResult | null> {
  const res = await prepareAudioForTranscription(blob, blob.type || 'audio/webm');
  if (!res) return null;
  return {
    blob: res.blob,
    durationSec: res.durationSec,
    rms: res.rms,
    peak: res.peak,
  };
}
