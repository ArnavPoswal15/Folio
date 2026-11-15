export interface WavConversionResult {
  blob: Blob;
  durationSec: number;
  rms: number;
  peak: number;
}

/**
 * Converts a recorded browser MediaRecorder Blob (webm/ogg/mp4) into a clean
 * 16 kHz mono 16-bit PCM WAV Blob for consistent server-side transcription.
 * Uses RMS-based speech normalization (ignoring initial/final click transients)
 * so quiet laptop microphones remain clear. Returns null if Web Audio decoding fails.
 */
export async function convertBlobToMonoWav(
  blob: Blob
): Promise<WavConversionResult | null> {
  if (typeof window === 'undefined') return null;

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;

  if (!AudioCtx || !OfflineCtx) return null;

  const ctx = new AudioCtx();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));

    if (!decoded || decoded.length === 0 || decoded.duration <= 0) {
      return null;
    }

    const targetSampleRate = 16000;
    const targetLength = Math.max(1, Math.ceil(decoded.duration * targetSampleRate));
    const offline = new OfflineCtx(1, targetLength, targetSampleRate);

    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);

    const rendered = await offline.startRendering();
    const channel = rendered.getChannelData(0);

    // Measure peak & RMS across body of clip (trimming 50ms edges to avoid mouse-click spikes)
    const edgeSamples = Math.min(800, Math.floor(channel.length * 0.1));
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
    const rms = Math.sqrt(sumSq / count);

    // Boost quiet speech safely toward ~0.12 RMS while avoiding clipping
    let gain = 1;
    if (rms > 0.0004 && rms < 0.08) {
      const desiredGain = 0.12 / rms;
      const maxSafeGain = peak > 0 ? 0.9 / peak : 8;
      gain = Math.max(1, Math.min(8, desiredGain, maxSafeGain));
    }

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
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // AudioFormat = PCM
    view.setUint16(22, 1, true); // NumChannels = 1 (mono)
    view.setUint32(24, targetSampleRate, true);
    view.setUint32(28, targetSampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    writeAscii(36, 'data');
    view.setUint32(40, channel.length * 2, true);

    let offset = 44;
    for (let i = 0; i < channel.length; i++) {
      const scaled = Math.max(-1, Math.min(1, channel[i] * gain));
      const intSample = scaled < 0 ? scaled * 0x8000 : scaled * 0x7fff;
      view.setInt16(offset, Math.round(intSample), true);
      offset += 2;
    }

    return {
      blob: new Blob([wavBuffer], { type: 'audio/wav' }),
      durationSec: decoded.duration,
      rms,
      peak,
    };
  } catch {
    return null;
  } finally {
    void ctx.close().catch(() => {});
  }
}
