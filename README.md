# ⟁ VOID COMMANDER v2 — Node.js Edition

Hand-gesture space shooter. MediaPipe + Vercel Blob.

## Setup

```bash
npm install
```

## Termux / Local

```bash
node server.js
# Open http://localhost:5000
```

## Vercel Deploy

1. Push repo to GitHub
2. Import to Vercel
3. Add env var: `BLOB_READ_WRITE_TOKEN` (from Vercel Blob dashboard)
4. Deploy

## What's new in v2
- Node.js/Express (no Python)
- Vercel Blob: player data + face photos stored in the cloud
- Face capture: 5-second countdown on game start → full-res selfie with neon overlay → saved to Blob
- Pilot photo shown on game over screen
- All ships + upgrades unlocked for free
- Harder difficulty: faster debris, double spawns from wave 3, boss asteroids from wave 5

## Env vars
| Var | Purpose |
|-----|---------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob R/W token |
| `PORT` | HTTP port (default 5000) |
# Space-shoter-hand-interaction
