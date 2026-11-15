# Folio

**A quiet place to put your thoughts.**

Folio is a digital journal designed to feel like opening a book. Write on customizable paper, turn pages with a natural curl, and keep your entries on your device or sync them across devices.

**Live app:** [folio-journal on Google Cloud](https://ais-pre-kdmulkwyfabpgll6ftbxkn-136037145469.asia-southeast1.run.app)

## Features

- **A book-like writing experience** with animated page turns and responsive layouts.
- **Your page, your way** with ruled, dotted, or blank paper and three ink colors.
- **Voice dictation** to turn recordings into text.
- **Guest mode** with entries saved in your browser, plus optional Google sign-in and cloud sync.
- **An entries index and CSV export** to find and back up your writing.

## Get started

### Requirements

- Node.js 20 or newer
- A Gemini API key for voice dictation

### Run locally

```bash
git clone https://github.com/ArnavPoswal15/FOLIO.git
cd FOLIO
npm install
cp .env.example .env
```

Add your Gemini API key to `.env`:

```env
GEMINI_API_KEY="your_gemini_api_key"
```

Then start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Voice dictation requires `GEMINI_API_KEY`. Google sign-in and cloud sync use the Firebase settings in `firebase-applet-config.json`; configure that file for your Firebase project if you want to use those features.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run lint` | Check TypeScript types |
| `npm run build` | Create a production build |
| `NODE_ENV=production npm start` | Start the production server |

## Built with

React · TypeScript · Vite · Tailwind CSS · GSAP · Express · Firebase · Google GenAI
