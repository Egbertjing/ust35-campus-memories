# UST35 · Campus Memories

A 3D map of the HKUST Clear Water Bay campus where people pin their campus photos, built for the university's 35th anniversary.

**Site: https://ust35-campus-memories.ust35-campus-memories.workers.dev** (Cloudflare Workers, free plan).
Everything runs on Cloudflare; this repository is the source code plus a photo snapshot for backup.

## How the main site works

One Cloudflare Worker (`worker/index.ts`, config in `wrangler.jsonc`):

- **Static files**: the Vite build in `dist/`, served by Workers static assets.
- **API** (`/api/*`): the same endpoints as the original Python server (`/api/memories`, `/api/photos/<id>`, `/api/admin/*`).
- **D1 database `ust35-memories`**: photo text, location, version history, upload log (schema: `worker/schema.sql`).
- **KV namespace `ust35-photos`**: the photo files (one key per uploaded image; versions share keys).
- **Secret `ADMIN_KEY`**: the moderation key (set with `npx wrangler secret put ADMIN_KEY`; never commit it).

Free-plan limits that matter: KV 1 GB storage and 1,000 writes per day, so the site caps uploads at 800 per day
(`UPLOAD_GLOBAL_DAY`) and storage at 950 MB (`MAX_STORE_BYTES`); per-network limits are 20 per 10 minutes and 80 per day.
Photos are re-encoded in the browser to JPEG, max 2048 px, with location metadata removed.

The 31 MB 3D model is over the 25 MiB Workers file limit, so it is stored as two parts in `public/model/` and joined
in the browser when someone presses download.

## Deploying

```bash
npm install
npx wrangler login            # once
npm run deploy:cf             # build + deploy the main site to Cloudflare
```

## Backups

```bash
npx wrangler d1 export ust35-memories --remote --output backup.sql   # text, locations, history
python3 scripts/sync-photo-snapshot.py                              # current photos into public/memories (commit them)
```

## Development

```bash
npm run dev       # local dev server (no API; use the deployed site for uploads)
```

The 3D campus is a concept-level procedural reconstruction, not a survey model.
