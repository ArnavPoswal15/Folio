# Folio — Handwritten Daily Journal

> A quiet, tactile notebook for the browser — complete with a 3D hardbound book cover, interactive drag-to-fold page turns, voice-to-handwriting dictation, and optional cross-device cloud sync.

---

## Overview

**Folio** reimagines digital journaling as a physical clothbound notebook resting on a warm architectural studio desk. Instead of rigid dashboards or noisy feeds, every session opens a leather-and-linen volume where you can write in fountain-pen inks on ruled, dotted, or blank archival paper, turn pages by dragging corners, record spoken reflections straight onto the page, and optionally sync across devices with Google Sign-In.

---

## Key Features

- **Tactile 3D Hardbound Book & Natural Paper-Curl Physics**
  - Smooth GSAP-driven 3D cover opening/closing with stitched bookcloth texture, layered page edges, and a woven burgundy bookmark ribbon.
  - Real-time geometric page folding: drag any corner or outer margin (or tap navigation controls / arrow keys) to peel and curl pages with cast fold shadows and crease lighting.
  - Responsive across desktop two-page spreads and single-page mobile layouts.

- **Authentic Handwriting & Paper Customization**
  - Edit each spread's date, add a quiet setting/mood note, and write across facing left and right pages in **Caveat** handwriting paired with **Cormorant Garamond** headings.
  - Switch per-spread between **Charcoal Ink**, **Fountain Blue**, or **Warm Sepia**, and toggle **Ruled**, **Dotted**, or **Blank** paper textures aligned to line height.

- **Voice Recording & Server-Side Transcription**
  - Quiet, non-intrusive **Record** control on each page with a live 3-bar microphone level meter and elapsed duration timer.
  - Converts browser recordings into RMS-normalized `16 kHz` mono PCM WAV (`audio/wav`) on the client and transcribes via `/api/transcribe` (`gemini-3.5-transcribe` with `gemini-4-hydrogen` fallback), appending clean prose directly onto the active page.

- **Guest Preview + Optional Google Sync**
  - Start immediately as a guest (saved locally in `localStorage`) from the flyleaf welcome spread.
  - Sign in optionally with **Google Authentication** to sync entries in real time across devices via **Cloud Firestore**. Any entries drafted as a guest merge automatically into your cloud notebook upon sign-in.

- **Entries Index & CSV Export**
  - Open the **hamburger menu (`☰`)** alongside **Close** to browse the **Entries Index** with newest/oldest sorting, month filtering, preset ranges (`7d`, `30d`, `90d`), and custom From/To date filters.
  - Export journal entries to **CSV** filtered by **1 Week**, **2 Weeks**, **1 Month**, **3 Months**, **6 Months**, **12 Months**, or **All Time**.

---

## How It Works

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Browser Client (React 19 + Vite + Tailwind CSS + GSAP)                    │
│                                                                           │
│  1. Interactive Book Stage (`PageCurlStage` + `pageCurlGeometry`)         │
│     └─ GSAP 3D cover rotation + real-time reflection/clip-path curl       │
│                                                                           │
│  2. Persistence (`useJournalStore` + `AuthContext`)                       │
│     ├─ Guest mode  ──▶ localStorage (`folio_journal_spreads_v1`)          │
│     └─ Google Auth ──▶ Auto-merges local drafts + debounced Firestore     │
│                        writes + real-time `onSnapshot` listener           │
│                                                                           │
│  3. Voice Dictation (`useVoiceRecorder` + `audioWav`)                     │
│     └─ Captures stream ─▶ RMS-normalized 16 kHz mono WAV ─▶ POST /api/... │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Express Full-Stack Server (`server.ts`)                                   │
│                                                                           │
│  • Serves Vite dev middleware (dev) or `dist/` static build (prod)        │
│  • `POST /api/transcribe`                                                 │
│     └─ `@google/genai` (`gemini-3.5-transcribe` -> `gemini-4-hydrogen`)   │
└───────────────────────────────────────────────────────────────────────────┘
```

1. **Page-Turning Geometry**: Pointer coordinates inside the spread compute a fold bisector line, mirroring the turning underside onto a dynamically clipped layer (`clipPath`) with intensity-scaled cast shadows and edge highlights.
2. **State & Sync Isolation**: Guest notes live in local browser storage so visitors can explore immediately. Signing in with Google authenticates via Firebase Auth, writes/reads under strict owner-scoped Firestore security rules (`/users/{uid}/spreads/{spreadId}`), and reconciles local guest drafts without overwriting newer timestamps.
3. **Audio Capture & Transcription**: Recording locks accidental page turns, reads live microphone amplitude via Web Audio `AnalyserNode`, downsamples to normalized `16 kHz` mono WAV to eliminate cross-browser container quirks, and calls the server-side Gemini endpoint so API credentials never reach the client.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Lucide Icons |
| **Animation & Physics** | GSAP (`gsap`), custom 2D fold-reflection geometry |
| **Backend** | Node.js, Express (`server.ts`), Vite middleware |
| **Speech Transcription** | Google GenAI SDK (`@google/genai` — `gemini-3.5-transcribe` & `gemini-4-hydrogen`) |
| **Auth & Cloud Sync** | Firebase Authentication (Google OAuth) & Cloud Firestore |

---

## Project Structure

```text
├── server.ts                        # Express + Vite server & /api/transcribe endpoint
├── firestore.rules                  # Owner-verified Firestore security rules
├── firebase-blueprint.json          # Firestore data schema definition
├── src/
│   ├── App.tsx                      # Responsive viewport sizing, auth & voice orchestration
│   ├── index.css                    # Studio desk, cotton paper, ruling, and ink styles
│   ├── components/
│   │   ├── PageCurlStage.tsx        # 3D book cover, spine, bookmark & curl interaction layer
│   │   ├── JournalPageContent.tsx   # Page header, menu, dictation, ink/paper controls & body
│   │   ├── WelcomeSpreadContent.tsx # Guest / Google Sign-In flyleaf onboarding spread
│   │   ├── EntriesIndexModal.tsx    # Chronological index with date/month sorting & filters
│   │   ├── ExportJournalModal.tsx   # Time-range CSV export modal
│   │   └── AccountModal.tsx         # Google account & cloud sync status modal
│   ├── hooks/
│   │   ├── useJournalStore.ts       # Local/Firestore store, auto-merge & debounced sync
│   │   └── useVoiceRecorder.ts      # MediaRecorder capture, level metering & transcription
│   ├── utils/
│   │   ├── pageCurlGeometry.ts      # Reflection matrix, fold bisector & clip-path math
│   │   ├── audioWav.ts              # Client-side 16 kHz mono PCM WAV conversion
│   │   └── exportCsv.ts             # Duration filtering & RFC-4180 CSV generation
│   ├── contexts/AuthContext.tsx     # Firebase Google Auth state & popup handling
│   └── lib/firebase.ts              # Firebase client & Firestore initialization
└── .env.example                     # Required runtime environment variable template
```

---

## Getting Started

### Prerequisites
- **Node.js** `>= 20` (tested on `v22`)
- A **Gemini API key** (`GEMINI_API_KEY`) for voice transcription
- Optional: A **Firebase** project configured in `firebase-applet-config.json` for Google Sign-In & Firestore sync

### Installation & Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   Copy `.env.example` to `.env` and set your Gemini API key:
   ```bash
   cp .env.example .env
   ```
   ```env
   GEMINI_API_KEY="your_gemini_api_key"
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build & Start

```bash
npm run lint
npm run build
NODE_ENV=production npm start
```
