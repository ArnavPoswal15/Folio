/** Maximum recording length and MediaRecorder / audio normalization thresholds. */
export const VOICE_RECORDER_CONFIG = {
  MAX_RECORDING_SECONDS: 180,
  AUDIO_BITS_PER_SECOND: 32_000,
  MIN_BLOB_BYTES: 250,
  ANALYSER_FFT_SIZE: 256,
  METER_RMS_GAIN: 5.5,
  TARGET_SAMPLE_RATE_HZ: 16000,
  DIRECT_COMPRESSED_MIN_RMS: 0.025,
  MAX_DIRECT_UPLOAD_BYTES: 2.5 * 1024 * 1024,
  SILENCE_PEAK_THRESHOLD: 0.0005,
  SILENCE_RMS_THRESHOLD: 0.0001,
  EDGE_TRIM_SECONDS: 0.05,
  TARGET_WAV_RMS: 0.12,
  MAX_WAV_GAIN: 8,
  MAX_SAFE_PEAK: 0.9,
} as const;

/** Ordered MIME type preferences tested with MediaRecorder.isTypeSupported. */
export const PREFERRED_AUDIO_MIME_TYPES: readonly string[] = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

/** Compact compressed container MIME types eligible to skip WAV re-encoding. */
export const DIRECT_COMPRESSED_MIMES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
]);
