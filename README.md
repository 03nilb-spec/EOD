# AI EOD Report Generator

Next.js MVP for generating professional end-of-day reports from morning,
afternoon, evening, blocker, meeting, and tomorrow-plan notes.

## Features

- EOD input form
- Tone selector: professional, simple, detailed
- `/api/generate-eod` backend route
- Gemini API support through `GEMINI_API_KEY`
- Local fallback generator when no API key is configured
- Copy result button
- Output formats:
  - Professional EOD message
  - Short Slack/Teams version
  - Detailed email version
  - Bullet-point work summary
  - Tomorrow's plan

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Gemini

Create `.env.local`:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
```

The app still works without the key by using a local structured report fallback.
