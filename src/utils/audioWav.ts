export interface WavConversionResult {
  blob: Blob;
  durationSec: number;
  rms: number;
  peak: number;
}

export interface PreparedAudioResult {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  rms: number;
  peak: number;
  isSilent: boolean;
  usedWavBoost: boolean;
}

const DIRECT_COMPRESSED_MIMES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
]);

function measureSpeechStats(channel: Float32Array, sampleRate: number): {
  rms: number;
  peak: number;
} {
  // Trim 50ms edges to avoid mouse-click spikes skewing peak/RMS
  const edgeSamples = Math.min(
    Math.floor(sampleRate * 0.05),
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

function encodeMonoWavFromChannel(
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
 * Fast audio preparation for transcription:
 * - Decodes once to detect silent recordings and measure speech RMS.
 * - If volume is already clear on a compact compressed format (webm/ogg/mp4),
 *   uploads the small compressed blob directly (10x smaller & faster upload).
 * - If the microphone is quiet (rms < 0.025) or the container needs normalizing,
 *   resamples to 16 kHz mono WAV with safe RMS gain boost for accuracy.
 */
export async function prepareAudioForTranscription(
  rawBlob: Blob,
  recordedMime: string
): Promise<PreparedAudioResult | null> {
  const cleanMime = recordedMime.split(';')[0].trim().toLowerCase() || 'audio/webm';
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

    if (peak < 0.0005 && rms < 0.0001) {
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

    // Fast path: healthy volume + compact compressed container -> skip WAV bloat
    if (
      rms >= 0.025 &&
      DIRECT_COMPRESSED_MIMES.has(cleanMime) &&
      rawBlob.size <= 2.5 * 1024 * 1024
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

    // Quiet mic or non-standard container: resample to 16 kHz mono WAV with gain boost
    const OfflineCtx =
      window.OfflineAudioContext ||
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .webkitOfflineAudioContext;
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

    const targetSampleRate = 16000;
    const targetLength = Math.max(1, Math.ceil(decoded.duration * targetSampleRate));
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
      const desiredGain = 0.12 / monoStats.rms;
      const maxSafeGain = monoStats.peak > 0 ? 0.9 / monoStats.peak : 8;
      gain = Math.max(1, Math.min(8, desiredGain, maxSafeGain));
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
