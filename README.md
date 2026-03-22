# ⟁ VOID COMMANDER v2 — Node.js

Hand-gesture space shooter. MediaPipe + Vercel Blob.

## Run locally (Termux / PC)

```bash
npm install
node server.js
# open http://localhost:5000
```

## Deploy to Vercel

1. Push this repo to GitHub (all files are in root — no subfolders)
2. Import to vercel.com → New Project
3. Add env var: `BLOB_READ_WRITE_TOKEN`
   - Vercel Dashboard → Storage → Blob → your store → .env.local
4. Deploy

## Env vars

| Var | Where to get it |
|-----|----------------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Dashboard → Storage → Blob |
| `PORT` | optional, default 5000 |

## File structure (flat)

```
index.html
main.css
game.js
app.js
server.js
package.json
vercel.json
.env.example
README.md
```
