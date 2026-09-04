# Resonance

AI text-to-speech and voice generation. A [Next.js](https://nextjs.org) app that turns
text into speech using a self-hosted [Chatterbox](https://github.com/resemble-ai/chatterbox)
TTS model, with voice cloning from a library of system and custom voices.

> **Status:** work in progress. This README is updated as the app moves toward
> production-ready. Sections marked _TODO_ are not done yet.

## Architecture

Three independent pieces, each owning one job:

```
Browser ──▶ Next.js server ──▶ Modal GPU container ──▶ Hugging Face (model, once)
   ▲             │                      │
   │             ▼                      ▼
   └──────  Azure Blob  ◀───────────────┘   (voice + generated audio)
```

- **Next.js app** — UI, auth, tRPC API, and the only place that talks to the database.
  The browser sends a `voiceId`; the server resolves the storage key and calls Modal.
- **Modal** (`chatterbox_tts.py`) — serverless GPU container running the TTS model.
  Deployed separately with `modal deploy`. Downloads voices from Azure Blob itself.
- **Azure Blob Storage** — stores voice samples (`voices/system/<id>`) and generated
  audio (`generations/orgs/<orgId>/<id>`).
- **Hugging Face** — hosts the public model weights; Modal downloads them on first
  container start (cached on a Modal Volume thereafter). We upload nothing there.

### Why the browser never sees secrets

`CHATTERBOX_API_KEY`, the Azure connection string, and `HF_TOKEN` are all server-side
only. The client sends `voiceId`; everything sensitive stays on the Next.js server or
inside Modal. See [src/lib/chatterbox-client.ts](src/lib/chatterbox-client.ts).

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| API | tRPC + TanStack Query |
| Auth | Clerk (organization-scoped) |
| DB | PostgreSQL via Prisma (Prisma Accelerate) |
| Storage | Azure Blob Storage |
| TTS compute | Modal (serverless A10G GPU) |
| Model | ResembleAI/chatterbox-turbo (Hugging Face) |
| Audio UI | wavesurfer.js (desktop), native `<audio>` (mobile) |

## Getting started

### Prerequisites

- Node.js 20+ and npm
- A populated `.env` (see below)
- For editing the TTS backend: Python 3.10+ and the Modal CLI (`py -3.12 -m modal`)

### Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To run everything through one dashboard, use `npm run dev:all` (mprocs). Modal is
deployed and does not need to run locally — see [mprocs.yaml](mprocs.yaml).

## Environment variables

All server-side. Never expose the non-`NEXT_PUBLIC_` values to the browser.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres/Accelerate connection string |
| `APP_URL` | App base URL (e.g. `http://localhost:3000`) |
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Blob access |
| `AZURE_STORAGE_CONTAINER` | Blob container name (`voices`) |
| `CHATTERBOX_API_URL` | Deployed Modal endpoint |
| `CHATTERBOX_API_KEY` | Shared secret guarding the Modal API |
| `NEXT_PUBLIC_CLERK_*` / `CLERK_SECRET_KEY` | Clerk auth |

`HF_TOKEN` is **not** here — it lives only in the Modal `hf-token` secret, used by the
GPU container, not by Next.js.

## Common tasks

```bash
npm run dev            # start the app
npm run dev:all        # start via mprocs
npm run sync-api       # regenerate TS types from the Modal OpenAPI schema
npm run lint           # eslint
npx prisma migrate deploy                 # apply DB migrations
npx tsx scripts/seed-system-voices.ts     # seed system voices from scripts/system-voices/
```

## The TTS backend (Modal)

`chatterbox_tts.py` is a standalone Modal app, deployed independently of the Next.js app.

```bash
py -3.12 -m modal deploy chatterbox_tts.py    # deploy / redeploy
py -3.12 -m modal serve  chatterbox_tts.py    # hot-reloading dev endpoint
```

Required Modal secrets: `hf-token`, `chatterbox-api-key`, `azure-storage`. After any
change to the API surface, run `npm run sync-api` to refresh the TypeScript types.

## Data model

Two Prisma models: `Voice` and `Generation`. Both hold a `storageKey` column (formerly
`r2ObjectKey` — the app migrated from Cloudflare R2 to Azure Blob; the value is the blob
key). See [prisma/schema.prisma](prisma/schema.prisma).

## Manual test checklist

- [ ] Sign in and select an organization
- [ ] Voices page: list, search, and (custom) delete
- [ ] Text-to-speech: enter text, pick a voice, adjust settings, Generate
- [ ] Playback: desktop waveform + mobile bar; play/pause, seek ±10s, download
- [ ] Resize across 1024px — audio does not double-play
- [ ] Reload a generation detail URL — settings and audio restore

## Roadmap (TODO)

- [ ] Rate limiting / quota on generation
- [ ] Per-user API auth instead of a shared key
- [ ] Background cleanup of orphaned blobs
- [ ] Production observability and error reporting
