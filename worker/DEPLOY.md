# S10b — deploying the photo worker

Everything in this folder is written and typechecked. **The steps below are
yours**, because they need a Cloudflare account: only you can authenticate
wrangler, hold the R2 API token, and add the payment method R2 requires (the
free tier — 10 GB storage — still needs a card on file).

Run these from `worker/`.

## 1. Install and authenticate

```bash
cd worker
npm install
npx wrangler login          # opens a browser
npx wrangler whoami         # note the Account ID
```

## 2. Create the storage

```bash
npx wrangler r2 bucket create bright-beer-photos
npx wrangler kv namespace create PHOTO_META      # prints an id
```

Enable public access on the bucket (R2 → bright-beer-photos → Settings →
Public access), which gives you a `https://pub-xxxxx.r2.dev` URL.

## 3. Fill in `wrangler.toml`

Four placeholders:

| key | value |
|---|---|
| `kv_namespaces.id` | the id printed in step 2 |
| `R2_ACCOUNT_ID` | from `wrangler whoami` |
| `PUBLIC_BASE_URL` | the `pub-xxxxx.r2.dev` URL (no trailing slash) |
| `ALLOWED_ORIGINS` | your GitHub Pages origin — see the CORS note below |

## 4. Create the R2 API token and set the secrets

R2 → **Manage R2 API Tokens** → Create token, permission **Object Read &
Write**, scoped to `bright-beer-photos` only.

```bash
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

Never put these in `wrangler.toml` — it is committed.

## 5. Test locally before deploying

```bash
npx wrangler dev
curl http://localhost:8787/health          # -> {"status":"ok"}
```

The presign path is the fiddly one (SigV4 against R2 wants `region: auto` and
a matching host), so exercise a real upload here before shipping.

## 6. Deploy

```bash
npx wrangler deploy          # -> https://bright-beer-photos.<subdomain>.workers.dev
```

## 7. Point the frontend at it

The site deploys to GitHub Pages via Actions, so the flag is baked in at build
time. Add a repository **variable** (not a secret — the Worker URL is public
and a secret would be a lie about its sensitivity):

*Settings → Secrets and variables → Actions → Variables → New variable*

```
VITE_PHOTO_WORKER_URL = https://bright-beer-photos.<subdomain>.workers.dev
```

Then reference it in the build step of the Pages workflow:

```yaml
- run: npm run build
  env:
    VITE_PHOTO_WORKER_URL: ${{ vars.VITE_PHOTO_WORKER_URL }}
```

`src/lib/photos.ts` flips out of demo mode the moment that value is non-empty.
Nothing else on the client changes.

## ⚠️ CORS is the failure you should expect

`ALLOWED_ORIGINS` must contain the exact origin the browser sends — scheme and
host, no path, no trailing slash. For GitHub Pages that is
`https://<user>.github.io`, **not** `https://<user>.github.io/Bright-Beer`.

Get it wrong and `curl` still passes while the browser silently fails, because
CORS is enforced only by the browser. Test the real upload from the deployed
site, not from a terminal.

## What is deliberately not built

- **No thumbnail pipeline.** Cloudflare Images is a paid add-on and Sharp does
  not run on Workers, so `url` and `fullUrl` point at the same object. The
  client already downscales before upload and the lightbox falls back to
  `url`, so the gallery is correct — just not bandwidth-optimised.
- **No EXIF stripping**, for the same reason. The README's S10 §8 note stands
  as a follow-up: route through Cloudflare Images if you enable it.

Both are worth a backlog item once the worker is live and you can see whether
they matter.
