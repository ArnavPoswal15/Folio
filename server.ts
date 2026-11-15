import 'dotenv/config';
import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

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
    return base;
  }
  if (base === 'video/webm') return 'audio/webm';
  if (base === 'video/mp4') return 'audio/mp4';
  return 'audio/webm';
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

  app.use(express.json({ limit: '25mb' }));

  app.post('/api/transcribe', async (req: Request, res: Response) => {
    try {
      const { audioBase64, mimeType } = req.body ?? {};

      if (typeof audioBase64 !== 'string' || audioBase64.trim().length < 16) {
        res.status(400).json({
          error: 'No recorded audio was received. Please try recording again.',
        });
        return;
      }

      if (audioBase64.length > 20 * 1024 * 1024) {
        res.status(413).json({
          error: 'Recording is too long. Please keep voice notes under 3 minutes.',
        });
        return;
      }

      const ai = getGenAIClient();
      if (!ai) {
        res.status(503).json({
          error: 'Voice transcription service is not configured right now.',
        });
        return;
      }

      const cleanMimeType = normalizeAudioMimeType(mimeType);
      const audioPart = {
        inlineData: {
          mimeType: cleanMimeType,
          data: audioBase64.trim(),
        },
      };

      let transcript = '';
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
        console.warn('Primary transcription (gemini-3.5-transcribe) failed, trying fallback:', err);
      }

      // Fallback to multimodal gemini-4-hydrogen if primary transcription returned empty or failed
      if (!transcript) {
        try {
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

      res.json({ text: transcript });
    } catch (error) {
      console.error('Transcription error:', error);
      const rawMessage =
        error instanceof Error ? error.message : String(error ?? '');
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
  });

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
