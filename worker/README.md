# S10 photo worker — reference contract

The frontend (`src/lib/photos.ts`) ships in **demo mode** by default — photos
are downscaled to a 320 px JPEG thumbnail and stored in `localStorage` on the
device that uploaded them.

To switch to real R2-backed uploads, set `VITE_PHOTO_WORKER_URL` in `.env` /
the deploy environment to the URL of a service that implements the four
endpoints below.

## Constraints (must match the client)

- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Max file size: 8 MB
- Max dimensions: 4000 × 4000 (validated client-side before presign; the
  worker should sanity-check the `width`/`height` reported at completion)
- Rate limit: 5 uploads per venue per session per day (client tracks this in
  `localStorage`; the worker should enforce it too, attributed by
  `X-Session-Id` header)

## Endpoints

```
POST  /venues/:venueId/photos/presign
      headers: { Content-Type: application/json, X-Session-Id: <uuid> }
      body:    { contentType: string, contentLength: number }
      -> 200  { uploadUrl: string, getUrl: string, key: string }
            uploadUrl is a presigned PUT URL for R2 (or S3-compatible)
            key      is the eventual object key, e.g.
                     "photos/{venueId}/{uuid}.{ext}"

PUT   {uploadUrl}            ← the client uploads the bytes directly
      headers: { Content-Type: <same contentType as presign> }
      body:    <file bytes>
      -> 200

POST  /photos/complete
      headers: { Content-Type: application/json, X-Session-Id: <uuid> }
      body:    { venueId: string, key: string, width: number, height: number }
      -> 200  { id, url, fullUrl?, uploadedAt, reported? }   (PhotoRecord)
            Worker should:
              - validate the object actually landed in R2 (HEAD)
              - generate a thumbnail (Cloudflare Images, or Sharp on a Node
                worker) — the `url` returned is the thumbnail URL
              - insert a row in the photos DB
              - return the public-facing record

GET   /venues/:venueId/photos
      -> 200  PhotoRecord[]   (exclude rows with reported === true)

POST  /photos/:id/report
      headers: { X-Session-Id: <uuid> }
      -> 204  (mark the row as reported; client will hide it)
```

## PhotoRecord shape (from `src/lib/photos.ts`)

```ts
interface PhotoRecord {
  id:          string;
  url:         string;   // thumbnail
  fullUrl?:    string;   // full-size; lightbox falls back to `url` if omitted
  uploadedAt:  string;   // ISO timestamp
  reported?:   boolean;
}
```

## Minimal Cloudflare Worker scaffold

```ts
import { AwsClient } from "aws4fetch";
const r2 = new AwsClient({
  accessKeyId:     env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
});

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // route by URL.pathname → one of the four handlers above
    // Use r2.sign(...) to mint the presigned PUT URL with a short TTL (60s)
    // Use env.DB (D1) or external Postgres for the metadata row
  }
};
```

EXIF stripping (per S10 plan §8): in the `/photos/complete` handler, before
returning, run the uploaded object through Cloudflare Images (which strips
EXIF by default) or Sharp's `.rotate()` + `.toBuffer()` pipeline. Replace the
R2 object with the stripped version, or store the stripped one under a
sibling key.
