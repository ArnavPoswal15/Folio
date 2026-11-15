import 'dotenv/config';
import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import express, { type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_START_MS = Date.now();

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const PORT = parsePositiveInt(process.env.PORT, 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Voice transcription protection limits
const REQUIRE_TRANSCRIBE_AUTH =
  process.env.ALLOW_UNAUTHENTICATED_TRANSCRIBE !== 'true';
const RATE_WINDOW_MS = 60_000;
const IP_RATE_LIMIT_PER_MIN = parsePositiveInt(
  process.env.TRANSCRIBE_IP_RATE_LIMIT_PER_MIN,
  15
);
const USER_RATE_LIMIT_PER_MIN = parsePositiveInt(
  process.env.TRANSCRIBE_USER_RATE_LIMIT_PER_MIN,
  8
);
const USER_DAILY_REQUEST_LIMIT = parsePositiveInt(
  process.env.TRANSCRIBE_USER_DAILY_REQUESTS,
  60
);
const USER_DAILY_AUDIO_SECONDS = parsePositiveInt(
  process.env.TRANSCRIBE_USER_DAILY_AUDIO_SECONDS,
  900
);
const GLOBAL_DAILY_REQUEST_LIMIT = parsePositiveInt(
  process.env.TRANSCRIBE_GLOBAL_DAILY_REQUESTS,
  1000
);
const MAX_AUDIO_SECONDS = parsePositiveInt(
  process.env.TRANSCRIBE_MAX_AUDIO_SECONDS,
  185
);
const MIN_AUDIO_SECONDS = 0.2;
const MIN_AUDIO_BYTES = 128;
const MAX_WAV_BYTES = 6 * 1024 * 1024;
const MAX_COMPRESSED_AUDIO_BYTES = 3 * 1024 * 1024;

function loadFirebaseProjectId(): string {
  const envId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (envId) return envId;

  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
        projectId?: unknown;
      };
      if (typeof parsed.projectId === 'string' && parsed.projectId.trim()) {
        return parsed.projectId.trim();
      }
    }
  } catch (err) {
    console.warn('Could not read firebase-applet-config.json:', err);
  }
  return '';
}

const FIREBASE_PROJECT_ID = loadFirebaseProjectId();
const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

interface CertCacheState {
  certs: Record<string, string>;
  expiresAtMs: number;
  lastFetchedMs: number;
}

let certCache: CertCacheState = {
  certs: {},
  expiresAtMs: 0,
  lastFetchedMs: 0,
};

async function getFirebasePublicCerts(
  forceRefresh = false
): Promise<Record<string, string>> {
  const now = Date.now();
  if (
    !forceRefresh &&
    now < certCache.expiresAtMs &&
    Object.keys(certCache.certs).length > 0
  ) {
    return certCache.certs;
  }

  // Prevent stampeding Google's certs endpoint on repeated unknown kids
  if (
    forceRefresh &&
    now - certCache.lastFetchedMs < 60_000 &&
    Object.keys(certCache.certs).length > 0
  ) {
    return certCache.certs;
  }

  const res = await fetch(FIREBASE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase public certificates (${res.status}).`);
  }

  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') ?? '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number.parseInt(maxAgeMatch[1], 10) : 3600;

  certCache = {
    certs,
    expiresAtMs: now + Math.max(60, maxAgeSec) * 1000,
    lastFetchedMs: now,
  };
  return certs;
}

function decodeBase64UrlJson<T>(segment: string): T | null {
  try {
    const json = Buffer.from(segment, 'base64url').toString('utf8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

interface VerifiedFirebaseUser {
  uid: string;
  emailVerified: boolean;
}

async function verifyFirebaseIdToken(
  token: string
): Promise<VerifiedFirebaseUser | null> {
  if (!FIREBASE_PROJECT_ID) return null;

  const segments = token.split('.');
  if (segments.length !== 3) return null;

  const [headerSeg, payloadSeg, sigSeg] = segments;
  const header = decodeBase64UrlJson<{ alg?: unknown; kid?: unknown }>(headerSeg);
  const payload = decodeBase64UrlJson<{
    aud?: unknown;
    iss?: unknown;
    sub?: unknown;
    exp?: unknown;
    iat?: unknown;
    auth_time?: unknown;
    email_verified?: unknown;
  }>(payloadSeg);

  if (!header || !payload) return null;
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    return null;
  }

  let certs = await getFirebasePublicCerts(false);
  let pem = certs[header.kid];
  if (!pem) {
    certs = await getFirebasePublicCerts(true);
    pem = certs[header.kid];
  }
  if (!pem) return null;

  let signatureValid = false;
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerSeg}.${payloadSeg}`);
    verifier.end();
    signatureValid = verifier.verify(pem, Buffer.from(sigSeg, 'base64url'));
  } catch {
    return null;
  }
  if (!signatureValid) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

  if (payload.aud !== FIREBASE_PROJECT_ID) return null;
  if (payload.iss !== expectedIssuer) return null;
  if (
    typeof payload.sub !== 'string' ||
    payload.sub.length === 0 ||
    payload.sub.length > 128
  ) {
    return null;
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) return null;
  if (
    typeof payload.auth_time === 'number' &&
    payload.auth_time > nowSec + 300
  ) {
    return null;
  }

  return {
    uid: payload.sub,
    emailVerified: payload.email_verified === true,
  };
}

// In-memory sliding-window rate limits and daily quotas
const ipRateBuckets = new Map<string, number[]>();
const userRateBuckets = new Map<string, number[]>();

interface DailyUsageRecord {
  day: string;
  requests: number;
  audioSeconds: number;
}

const userDailyQuotas = new Map<string, DailyUsageRecord>();
let globalDailyQuota: DailyUsageRecord = {
  day: getUtcDayKey(),
  requests: 0,
  audioSeconds: 0,
};

function getUtcDayKey(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function secondsUntilUtcMidnight(nowMs = Date.now()): number {
  const tomorrow = new Date(nowMs);
  tomorrow.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((tomorrow.getTime() - nowMs) / 1000));
}

function consumeSlidingWindow(
  store: Map<string, number[]>,
  key: string,
  limit: number,
  nowMs: number
): { allowed: boolean; remaining: number; resetSec: number } {
  const cutoff = nowMs - RATE_WINDOW_MS;
  const existing = store.get(key) ?? [];
  const active = existing.filter((ts) => ts > cutoff);

  if (active.length >= limit) {
    store.set(key, active);
    const oldest = active[0] ?? nowMs;
    const resetSec = Math.max(1, Math.ceil((oldest + RATE_WINDOW_MS - nowMs) / 1000));
    return { allowed: false, remaining: 0, resetSec };
  }

  active.push(nowMs);
  store.set(key, active);
  const oldest = active[0] ?? nowMs;
  const resetSec = Math.max(1, Math.ceil((oldest + RATE_WINDOW_MS - nowMs) / 1000));
  return {
    allowed: true,
    remaining: Math.max(0, limit - active.length),
    resetSec,
  };
}

function getOrResetUserDailyQuota(uid: string, today: string): DailyUsageRecord {
  const existing = userDailyQuotas.get(uid);
  if (!existing || existing.day !== today) {
    const fresh: DailyUsageRecord = { day: today, requests: 0, audioSeconds: 0 };
    userDailyQuotas.set(uid, fresh);
    return fresh;
  }
  return existing;
}

// Periodically prune expired rate-limit & quota buckets
const cleanupTimer = setInterval(() => {
  const nowMs = Date.now();
  const cutoff = nowMs - RATE_WINDOW_MS;
  const today = getUtcDayKey(nowMs);

  for (const [key, timestamps] of ipRateBuckets) {
    const active = timestamps.filter((ts) => ts > cutoff);
    if (active.length === 0) ipRateBuckets.delete(key);
    else ipRateBuckets.set(key, active);
  }
  for (const [key, timestamps] of userRateBuckets) {
    const active = timestamps.filter((ts) => ts > cutoff);
    if (active.length === 0) userRateBuckets.delete(key);
    else userRateBuckets.set(key, active);
  }
  for (const [uid, record] of userDailyQuotas) {
    if (record.day !== today) {
      userDailyQuotas.delete(uid);
    }
  }
  if (globalDailyQuota.day !== today) {
    globalDailyQuota = { day: today, requests: 0, audioSeconds: 0 };
  }
}, 10 * 60_000);
cleanupTimer.unref();

let genaiClient: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!genaiClient) {
    genaiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return genaiClient;
}

const ALLOWED_AUDIO_MIME_PREFIXES = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/aac',
  'audio/flac',
]);

function normalizeAudioMimeType(raw?: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    return 'audio/webm';
  }
  const base = raw.split(';')[0].trim().toLowerCase();
  if (ALLOWED_AUDIO_MIME_PREFIXES.has(base)) {
    if (base === 'audio/x-wav' || base === 'audio/wave') return 'audio/wav';
    if (base === 'audio/mp3') return 'audio/mpeg';
    return base;
  }
  if (base === 'video/webm') return 'audio/webm';
  if (base === 'video/mp4') return 'audio/mp4';
  return 'audio/webm';
}

interface ValidatedAudio {
  buffer: Buffer;
  cleanBase64: string;
  mimeType: string;
  durationSec: number;
}

type AudioValidationOutcome =
  | { ok: true; audio: ValidatedAudio }
  | { ok: false; status: 400 | 413; error: string };

function inspectWavBuffer(buffer: Buffer): {
  valid: boolean;
  durationSec: number;
} {
  if (
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    return { valid: false, durationSec: 0 };
  }

  let audioFormat = 0;
  let numChannels = 0;
  let sampleRate = 0;
  let byteRate = 0;
  let dataSize = 0;
  let foundFmt = false;
  let foundData = false;

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const bodyStart = offset + 8;

    if (chunkId === 'fmt ' && chunkSize >= 16 && bodyStart + 16 <= buffer.length) {
      audioFormat = buffer.readUInt16LE(bodyStart);
      numChannels = buffer.readUInt16LE(bodyStart + 2);
      sampleRate = buffer.readUInt32LE(bodyStart + 4);
      byteRate = buffer.readUInt32LE(bodyStart + 8);
      foundFmt = true;
    } else if (chunkId === 'data') {
      const available = Math.max(0, buffer.length - bodyStart);
      dataSize = Math.min(chunkSize, available);
      foundData = true;
    }

    const paddedSize = chunkSize + (chunkSize % 2);
    const nextOffset = bodyStart + paddedSize;
    if (nextOffset <= offset) break;
    offset = nextOffset;
  }

  if (
    !foundFmt ||
    !foundData ||
    (audioFormat !== 1 && audioFormat !== 3) ||
    numChannels < 1 ||
    numChannels > 2 ||
    sampleRate < 8000 ||
    sampleRate > 96000 ||
    byteRate <= 0
  ) {
    return { valid: false, durationSec: 0 };
  }

  return { valid: true, durationSec: dataSize / byteRate };
}

function hasValidAudioSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 8) return false;
  if (mimeType === 'audio/webm') {
    return (
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    );
  }
  if (mimeType === 'audio/ogg') {
    return buffer.toString('ascii', 0, 4) === 'OggS';
  }
  if (mimeType === 'audio/mp4') {
    return buffer.toString('ascii', 4, 8) === 'ftyp';
  }
  if (mimeType === 'audio/flac') {
    return buffer.toString('ascii', 0, 4) === 'fLaC';
  }
  if (mimeType === 'audio/mpeg' || mimeType === 'audio/aac') {
    const isId3 = buffer.toString('ascii', 0, 3) === 'ID3';
    const isAdtsOrMpegSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
    return isId3 || isAdtsOrMpegSync;
  }
  return false;
}

function parseAndValidateAudio(
  audioBase64: unknown,
  rawMimeType: unknown,
  reportedDurationSec: unknown
): AudioValidationOutcome {
  if (typeof audioBase64 !== 'string' || audioBase64.trim().length < 16) {
    return {
      ok: false,
      status: 400,
      error: 'No recorded audio was received. Please try recording again.',
    };
  }

  const cleanBase64 = audioBase64.replace(/\s+/g, '');
  if (cleanBase64.length > 9 * 1024 * 1024) {
    return {
      ok: false,
      status: 413,
      error: 'Recording is too large. Please keep voice notes under 3 minutes.',
    };
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleanBase64)) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid audio encoding. Please try recording again.',
    };
  }

  const buffer = Buffer.from(cleanBase64, 'base64');
  const mimeType = normalizeAudioMimeType(rawMimeType);

  if (buffer.length < MIN_AUDIO_BYTES) {
    return {
      ok: false,
      status: 400,
      error: 'Recording was too short. Speak clearly and try again.',
    };
  }

  if (mimeType === 'audio/wav') {
    if (buffer.length > MAX_WAV_BYTES) {
      return {
        ok: false,
        status: 413,
        error: 'Recording exceeds the maximum allowed audio size (6 MB).',
      };
    }

    const wav = inspectWavBuffer(buffer);
    if (!wav.valid) {
      return {
        ok: false,
        status: 400,
        error: 'Invalid WAV audio payload. Please try recording again.',
      };
    }
    if (wav.durationSec < MIN_AUDIO_SECONDS) {
      return {
        ok: false,
        status: 400,
        error: 'Recording was too short. Speak clearly and try again.',
      };
    }
    if (wav.durationSec > MAX_AUDIO_SECONDS) {
      return {
        ok: false,
        status: 413,
        error: 'Recording is too long. Please keep voice notes under 3 minutes.',
      };
    }

    return {
      ok: true,
      audio: {
        buffer,
        cleanBase64,
        mimeType,
        durationSec: wav.durationSec,
      },
    };
  }

  if (buffer.length > MAX_COMPRESSED_AUDIO_BYTES) {
    return {
      ok: false,
      status: 413,
      error: 'Recording exceeds the maximum allowed audio size.',
    };
  }

  if (!hasValidAudioSignature(buffer, mimeType)) {
    return {
      ok: false,
      status: 400,
      error: 'Unsupported or corrupted audio file.',
    };
  }

  let durationSec = 30;
  if (
    typeof reportedDurationSec === 'number' &&
    Number.isFinite(reportedDurationSec)
  ) {
    if (reportedDurationSec < MIN_AUDIO_SECONDS) {
      return {
        ok: false,
        status: 400,
        error: 'Recording was too short. Speak clearly and try again.',
      };
    }
    if (reportedDurationSec > MAX_AUDIO_SECONDS) {
      return {
        ok: false,
        status: 413,
        error: 'Recording is too long. Please keep voice notes under 3 minutes.',
      };
    }
    durationSec = reportedDurationSec;
  }

  return {
    ok: true,
    audio: {
      buffer,
      cleanBase64,
      mimeType,
      durationSec,
    },
  };
}

function hashForLog(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function logTranscribeAudit(entry: {
  uidPrefix: string;
  ipHash: string;
  status: number;
  mimeType?: string;
  bytes?: number;
  durationSec?: number;
  model?: string;
  latencyMs: number;
  outcome: string;
}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event: 'api.transcribe',
      ...entry,
    })
  );
}

function extractResponseText(response: GenerateContentResponse): string {
  const direct = (response.text ?? '').trim();
  if (direct) return direct;

  const parts = response.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .filter(
      (part) =>
        typeof part.text === 'string' &&
        part.text.trim().length > 0 &&
        !(part as { thought?: boolean }).thought
    )
    .map((part) => part.text!.trim())
    .join(' ')
    .trim();
}

function cleanTranscriptText(raw: string): string {
  let text = raw.trim();
  if (!text) return '';

  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }

  if (
    /^(?:NO_SPEECH|\[(?:silence|inaudible|no speech|blank_audio|music|noise)\]|\((?:silence|inaudible|no speech|music|noise)\))$/i.test(
      text
    )
  ) {
    return '';
  }

  return text;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  const transcribeJsonParser = express.json({ limit: '9mb' });
  app.use((req, res, next) => {
    if (req.path === '/api/transcribe') {
      next();
      return;
    }
    express.json({ limit: '100kb' })(req, res, next);
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'folio',
      uptimeSec: Math.floor((Date.now() - SERVER_START_MS) / 1000),
      authRequired: REQUIRE_TRANSCRIBE_AUTH,
      transcriptionConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    });
  });

  app.post(
    '/api/transcribe',
    transcribeJsonParser,
    async (req: Request, res: Response) => {
      const startedAt = Date.now();
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const ipHash = hashForLog(clientIp);
      let uid = 'anonymous';

      try {
        // 1. Authenticate caller via Firebase ID token
        if (REQUIRE_TRANSCRIBE_AUTH) {
          const authHeader = req.header('authorization') ?? '';
          const match = authHeader.match(/^Bearer\s+(.+)$/i);
          if (!match) {
            logTranscribeAudit({
              uidPrefix: 'none',
              ipHash,
              status: 401,
              latencyMs: Date.now() - startedAt,
              outcome: 'missing_auth',
            });
            res.status(401).json({
              error: 'Sign in with Google to use voice dictation.',
              code: 'AUTH_REQUIRED',
            });
            return;
          }

          const verifiedUser = await verifyFirebaseIdToken(match[1].trim());
          if (!verifiedUser) {
            logTranscribeAudit({
              uidPrefix: 'invalid',
              ipHash,
              status: 401,
              latencyMs: Date.now() - startedAt,
              outcome: 'invalid_token',
            });
            res.status(401).json({
              error: 'Your session expired. Please sign in again to dictate.',
              code: 'AUTH_INVALID',
            });
            return;
          }

          uid = verifiedUser.uid;
        }

        const uidPrefix = uid === 'anonymous' ? 'anon' : uid.slice(0, 8);
        const nowMs = Date.now();
        const today = getUtcDayKey(nowMs);

        // 2. Per-IP and per-user burst rate limiting
        const ipRate = consumeSlidingWindow(
          ipRateBuckets,
          clientIp,
          IP_RATE_LIMIT_PER_MIN,
          nowMs
        );
        if (!ipRate.allowed) {
          res.setHeader('Retry-After', String(ipRate.resetSec));
          res.setHeader('X-RateLimit-Limit', String(IP_RATE_LIMIT_PER_MIN));
          res.setHeader('X-RateLimit-Remaining', '0');
          res.setHeader('X-RateLimit-Reset', String(ipRate.resetSec));
          logTranscribeAudit({
            uidPrefix,
            ipHash,
            status: 429,
            latencyMs: Date.now() - startedAt,
            outcome: 'ip_rate_limited',
          });
          res.status(429).json({
            error: `Too many requests from this network. Try again in ${ipRate.resetSec}s.`,
          });
          return;
        }

        const userRate = consumeSlidingWindow(
          userRateBuckets,
          uid,
          USER_RATE_LIMIT_PER_MIN,
          nowMs
        );
        res.setHeader('X-RateLimit-Limit', String(USER_RATE_LIMIT_PER_MIN));
        res.setHeader('X-RateLimit-Remaining', String(userRate.remaining));
        res.setHeader('X-RateLimit-Reset', String(userRate.resetSec));

        if (!userRate.allowed) {
          res.setHeader('Retry-After', String(userRate.resetSec));
          logTranscribeAudit({
            uidPrefix,
            ipHash,
            status: 429,
            latencyMs: Date.now() - startedAt,
            outcome: 'user_rate_limited',
          });
          res.status(429).json({
            error: `You are dictating too quickly. Please wait ${userRate.resetSec}s and try again.`,
          });
          return;
        }

        // 3. Global & per-user daily quota checks
        if (globalDailyQuota.day !== today) {
          globalDailyQuota = { day: today, requests: 0, audioSeconds: 0 };
        }
        if (globalDailyQuota.requests >= GLOBAL_DAILY_REQUEST_LIMIT) {
          const resetSec = secondsUntilUtcMidnight(nowMs);
          res.setHeader('Retry-After', String(resetSec));
          logTranscribeAudit({
            uidPrefix,
            ipHash,
            status: 429,
            latencyMs: Date.now() - startedAt,
            outcome: 'global_quota_exceeded',
          });
          res.status(429).json({
            error: 'Daily transcription capacity reached. Please try again tomorrow.',
          });
          return;
        }

        const userQuota = getOrResetUserDailyQuota(uid, today);
        res.setHeader('X-Quota-Daily-Limit', String(USER_DAILY_REQUEST_LIMIT));
        res.setHeader(
          'X-Quota-Daily-Remaining',
          String(Math.max(0, USER_DAILY_REQUEST_LIMIT - userQuota.requests))
        );

        if (userQuota.requests >= USER_DAILY_REQUEST_LIMIT) {
          const resetSec = secondsUntilUtcMidnight(nowMs);
          res.setHeader('Retry-After', String(resetSec));
          logTranscribeAudit({
            uidPrefix,
            ipHash,
            status: 429,
            latencyMs: Date.now() - startedAt,
            outcome: 'user_daily_requests_exceeded',
          });
          res.status(429).json({
            error: `Daily limit of ${USER_DAILY_REQUEST_LIMIT} voice transcriptions reached. Resets at 00:00 UTC.`,
          });
          return;
        }

        // 4. Validate audio payload, magic bytes, size, and duration
        const { audioBase64, mimeType, durationSec } = req.body ?? {};
        const validation = parseAndValidateAudio(
          audioBase64,
          mimeType,
          durationSec
        );
        if (!validation.ok) {
          logTranscribeAudit({
            uidPrefix,
            ipHash,
            status: validation.status,
            latencyMs: Date.now() - startedAt,
            outcome: 'invalid_audio',
          });
          res.status(validation.status).json({ error: validation.error });
          return;
        }

        const { audio } = validation;
        if (
          userQuota.audioSeconds + audio.durationSec >
          USER_DAILY_AUDIO_SECONDS
        ) {
          const resetSec = secondsUntilUtcMidnight(nowMs);
          res.setHeader('Retry-After', String(resetSec));
          logTranscribeAudit({
            uidPrefix,
            ipHash,
            status: 429,
            mimeType: audio.mimeType,
            bytes: audio.buffer.length,
            durationSec: Number(audio.durationSec.toFixed(2)),
            latencyMs: Date.now() - startedAt,
            outcome: 'user_daily_audio_exceeded',
          });
          res.status(429).json({
            error: 'Daily voice dictation duration quota reached. Resets at 00:00 UTC.',
          });
          return;
        }

        // 5. Verify Gemini client availability before charging quota
        const ai = getGenAIClient();
        if (!ai) {
          logTranscribeAudit({
            uidPrefix,
            ipHash,
            status: 503,
            mimeType: audio.mimeType,
            bytes: audio.buffer.length,
            durationSec: Number(audio.durationSec.toFixed(2)),
            latencyMs: Date.now() - startedAt,
            outcome: 'service_unconfigured',
          });
          res.status(503).json({
            error: 'Voice transcription service is not configured right now.',
          });
          return;
        }

        // Charge usage quota before downstream API call
        userQuota.requests += 1;
        userQuota.audioSeconds += audio.durationSec;
        globalDailyQuota.requests += 1;
        globalDailyQuota.audioSeconds += audio.durationSec;
        res.setHeader(
          'X-Quota-Daily-Remaining',
          String(Math.max(0, USER_DAILY_REQUEST_LIMIT - userQuota.requests))
        );

        const audioPart = {
          inlineData: {
            mimeType: audio.mimeType,
            data: audio.cleanBase64,
          },
        };

        let transcript = '';
        let modelUsed = 'gemini-3.5-transcribe';
        let primaryError: unknown = null;

        try {
          const primaryResponse = await ai.models.generateContent({
            model: 'gemini-3.5-transcribe',
            contents: {
              parts: [audioPart, { text: 'Transcribe this audio.' }],
            },
          });
          transcript = cleanTranscriptText(extractResponseText(primaryResponse));
        } catch (err) {
          primaryError = err;
          console.warn(
            'Primary transcription (gemini-3.5-transcribe) failed, trying fallback:',
            err
          );
        }

        if (!transcript) {
          try {
            modelUsed = 'gemini-4-hydrogen';
            const fallbackResponse = await ai.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents: [
                {
                  role: 'user',
                  parts: [
                    audioPart,
                    {
                      text: 'Listen carefully to this voice recording and transcribe every spoken word verbatim into clean, punctuated text. Output only the spoken transcript with no extra commentary. If there is genuinely no speech in the audio, output NO_SPEECH.',
                    },
                  ],
                },
              ],
            });
            transcript = cleanTranscriptText(extractResponseText(fallbackResponse));
          } catch (fallbackErr) {
            if (primaryError) throw primaryError;
            throw fallbackErr;
          }
        }

        logTranscribeAudit({
          uidPrefix,
          ipHash,
          status: 200,
          mimeType: audio.mimeType,
          bytes: audio.buffer.length,
          durationSec: Number(audio.durationSec.toFixed(2)),
          model: modelUsed,
          latencyMs: Date.now() - startedAt,
          outcome: transcript ? 'transcribed' : 'no_speech',
        });

        res.json({ text: transcript });
      } catch (error) {
        console.error('Transcription error:', error);
        const rawMessage =
          error instanceof Error ? error.message : String(error ?? '');
        const uidPrefix = uid === 'anonymous' ? 'anon' : uid.slice(0, 8);
        logTranscribeAudit({
          uidPrefix,
          ipHash,
          status: 500,
          latencyMs: Date.now() - startedAt,
          outcome: 'server_error',
        });

        if (
          rawMessage.includes('API_KEY_INVALID') ||
          rawMessage.includes('PERMISSION_DENIED')
        ) {
          res.status(500).json({
            error: 'Voice transcription API key is invalid or unauthorized.',
          });
          return;
        }
        res.status(500).json({
          error: 'Could not transcribe recording right now. Please try again.',
        });
      }
    }
  );

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Folio server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
