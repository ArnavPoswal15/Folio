# Changelog

All notable changes to **Folio** are documented in this file.

## [1.1.0] — 2026-11-17

### Added
- **Dark Mode ("Evening Desk & Charcoal Cotton Paper")**:
  - Added `ThemeProvider` / `useTheme` with `folio-theme` `localStorage` persistence, OS `prefers-color-scheme` fallback, and a zero-flash inline `<head>` script in `index.html`.
  - Styled `.desk-surface`, `.cover-cloth`, `.paper-grain`, `.paper-ruled`, `.paper-dotted`, paper edge stacks, spine gutters, and 3D page-curl shadows/highlights for dark mode.
  - Added high-contrast dark ink tokens (`darkHex` / `darkSwatch`) for **Charcoal**, **Fountain Blue**, and **Warm Sepia** plus optical letter-spacing compensation.
  - Added Dark / Light theme toggle controls on the closed desk, Welcome spread, and open journal pages, with full light/dark pairing across all modals.
- **Fast Voice Dictation with Groq Whisper**:
  - Switched primary server-side speech-to-text in `POST /api/transcribe` to Groq `whisper-large-v3-turbo` (`GROQ_API_KEY`) with automatic Gemini fallback (`GEMINI_API_KEY`).
  - Added client-side silence gating and smart audio preparation (`32 kbps` compressed upload by default, 16 kHz mono WAV boost only when mic levels are low or unsupported).
- **Release & Diagnostics**:
  - Added `GET /api/health` exposing service status, release `version`, uptime, and active `transcriptionProvider`.
  - Added `oxlint` + TypeScript (`tsc --noEmit`) linting configuration via `.oxlintrc.json`.

### Changed
- **Clean Signed-In Workspace**: Signed-in users open straight to a clean dated spread instead of guest sample entries, while guest writing merges cleanly upon sign-in.
- **Local Calendar Dates**: Replaced UTC `.toISOString().slice(0, 10)` date defaults in `sanitizeIsoDate` and CSV export filenames with `formatLocalIsoDate()`.
- **Container Image Optimization**: Updated `Dockerfile` to run `npm run build && npm prune --omit=dev`, removing dev-only packages from production images.
- **Repository Cleanup**: Removed duplicate root `favicon.ico` (retaining `public/favicon.ico`) and stale workflow/lock files.

### Security
- **Server-Side Transcription Protection**: Enforced Firebase Auth RS256 ID token verification, sliding-window per-IP and per-user rate limits, per-user and global daily quotas, JSON payload size caps (`9 MB` on `/api/transcribe`, `100 KB` elsewhere), container magic-byte + WAV duration validation (`0.2s`–`185s`), and structured JSON audit logs.
- **HTTP & Cert Fetch Hardening**: Disabled `x-powered-by`, added `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`, and added an `8s` timeout (`AbortSignal.timeout`) on Google x509 certificate fetches.
- **CSV Formula Injection Guard**: Prefixed CSV cells starting with `=`, `+`, `-`, `@`, or `\t` with `'` before quoting in `escapeCsvCell()`.

## [1.0.0] — Initial Release

- Interactive 3D opening book cover and GSAP drag-to-fold page-curl physics for desktop two-page spreads and mobile single-page navigation.
- Ruled, dotted, and blank paper styles with three fountain-pen ink tones.
- Guest `localStorage` persistence with optional Google Sign-In and owner-only Cloud Firestore sync.
- Entries Index with date sorting, month/range filtering, and CSV export.
