# Setup Guide

## Prerequisites

- Node.js 20.x (`node --version` to check)
- npm 9+ (comes with Node.js)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy ArcGIS assets to public folder
npm run copy-arcgis-assets

# 3. Create your environment file
cp .env.example .env.local

# 4. Add your API key (minimum required)
#    Open .env.local and set:
#    ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# 5. Start development server
npm run dev
```

The app will be available at http://localhost:3000.

## Environment Variables

### Required

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `ANTHROPIC_API_KEY` | Powers AI chat features | [Anthropic Console](https://console.anthropic.com/settings/keys) |

### Recommended

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `NEXT_PUBLIC_ARCGIS_API_KEY` | Mapping, geocoding, demographics | [ArcGIS Developers](https://developers.arcgis.com/api-keys/) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Storage for data | [Vercel Dashboard](https://vercel.com/dashboard/stores) |

### Optional

See `.env.example` for the full list of optional variables (FEC, Census, database, Redis, monitoring, etc.). The app runs without these but some features will be limited.

## Available Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run test         # Run tests
npm run lint         # Run linter
```

## Production Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Set the same environment variables from `.env.local` in your Vercel project settings.

## Troubleshooting

**Build runs out of memory:**
The build script already sets `--max-old-space-size=4096`. If still failing, increase it in `package.json`.

**ArcGIS maps not loading:**
Make sure you ran `npm run copy-arcgis-assets` and set `NEXT_PUBLIC_ARCGIS_API_KEY` in `.env.local`.

**AI chat not responding:**
Check that `ANTHROPIC_API_KEY` is set and valid. The key should start with `sk-ant-`.

**`legacy-peer-deps` errors:**
The `.npmrc` file already has `legacy-peer-deps=true` set. If you still see peer dep errors, run: `npm install --legacy-peer-deps`.
