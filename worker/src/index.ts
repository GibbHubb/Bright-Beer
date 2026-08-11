/**
 * S10b — Bright-Beer photo worker.
 *
 * Implements the four-endpoint contract in ../README.md against R2 (objects)
 * and KV (metadata). The frontend already speaks this protocol — `photos.ts`
 * switches from device-local demo thumbnails to real uploads the moment
 * VITE_PHOTO_WORKER_URL is set, so nothing on the client changes.
 *
 * Upload flow: presign -> client PUTs bytes straight to R2 -> complete.
 * The bytes never pass through the worker, which keeps us inside the CPU
 * limit and off the request-size ceiling.
 *
 * ⚠️ CORS is the most likely thing to break here, and it breaks *only in a
 * browser* — curl will happily succeed against a worker whose
 * Access-Control-Allow-Origin is wrong. Test from the deployed origin.
 */
import { AwsClient } from 'aws4fetch';

export interface Env {
  PHOTOS: R2Bucket;
  PHOTO_META: KVNamespace;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET: string;
  /** Comma-separated list of allowed browser origins. */
  ALLOWED_ORIGINS: string;
  /** Public base URL objects are served from (R2 custom domain or this worker). */
  PUBLIC_BASE_URL: string;
}

interface PhotoRecord {
  id: string;
  url: string;
  fullUrl?: string;
  uploadedAt: string;
  reported?: boolean;
}

// Must match src/lib/photos.ts — a mismatch means the client validates one
// thing and the worker enforces another.
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_DIM = 4000;
const UPLOADS_PER_VENUE_PER_DAY = 5;
const PRESIGN_TTL_SECONDS = 60;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// ── helpers ────────────────────────────────────────────────────────────────

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  // Echo the origin only when it is on the list. Never reflect blindly, and
  // never use '*' — the client sends X-Session-Id, and a wildcard plus custom
  // headers is exactly the combination browsers reject.
  const allow = allowed.includes(origin) ? origin : allowed[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Session-Id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, req: Request, env: Env): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req, env) },
  });
}

function err(message: string, status: number, req: Request, env: Env): Response {
  return json({ error: message }, status, req, env);
}

const venueKey = (venueId: string) => `venue:${venueId}`;
const photoKey = (photoId: string) => `photo:${photoId}`;
const rateKey = (venueId: string, session: string, day: string) =>
  `rate:${venueId}:${session}:${day}`;

const today = () => new Date().toISOString().slice(0, 10);

/** Per-venue index of photo ids, newest first. */
async function readIndex(env: Env, venueId: string): Promise<string[]> {
  return (await env.PHOTO_META.get<string[]>(venueKey(venueId), 'json')) ?? [];
}

// ── handlers ───────────────────────────────────────────────────────────────

async function handlePresign(req: Request, env: Env, venueId: string): Promise<Response> {
  const session = req.headers.get('X-Session-Id');
  if (!session) return err('Missing X-Session-Id', 400, req, env);

  let body: { contentType?: string; contentLength?: number };
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON', 400, req, env);
  }

  const { contentType, contentLength } = body;
  if (!contentType || !ALLOWED_TYPES.has(contentType)) {
    return err('Unsupported content type', 415, req, env);
  }
  if (typeof contentLength !== 'number' || contentLength <= 0 || contentLength > MAX_BYTES) {
    return err('File too large', 413, req, env);
  }

  // Server-side rate limit. The client tracks this too, but localStorage is
  // trivially cleared, so the client copy is UX and this one is the control.
  const rk = rateKey(venueId, session, today());
  const used = Number((await env.PHOTO_META.get(rk)) ?? '0');
  if (used >= UPLOADS_PER_VENUE_PER_DAY) {
    return err('Daily upload limit reached for this venue', 429, req, env);
  }

  const id = crypto.randomUUID();
  const key = `photos/${venueId}/${id}.${EXT[contentType]}`;

  const r2 = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });

  const target = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`;
  const signed = await r2.sign(
    new Request(target, { method: 'PUT', headers: { 'Content-Type': contentType } }),
    { aws: { signQuery: true }, headers: { 'X-Amz-Expires': String(PRESIGN_TTL_SECONDS) } },
  );

  // Reserve the slot at presign rather than at complete. A client that
  // presigns and never finishes still burns its quota, which is the
  // conservative direction for an anonymous endpoint.
  await env.PHOTO_META.put(rk, String(used + 1), { expirationTtl: 60 * 60 * 26 });

  return json(
    { uploadUrl: signed.url, getUrl: `${env.PUBLIC_BASE_URL}/${key}`, key },
    200, req, env,
  );
}

async function handleComplete(req: Request, env: Env): Promise<Response> {
  const session = req.headers.get('X-Session-Id');
  if (!session) return err('Missing X-Session-Id', 400, req, env);

  let body: { venueId?: string; key?: string; width?: number; height?: number };
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON', 400, req, env);
  }

  const { venueId, key, width, height } = body;
  if (!venueId || !key) return err('venueId and key are required', 400, req, env);
  if (!key.startsWith(`photos/${venueId}/`)) {
    // Without this, a caller could claim an object belonging to another venue.
    return err('Key does not belong to this venue', 400, req, env);
  }
  if (typeof width !== 'number' || typeof height !== 'number'
      || width <= 0 || height <= 0 || width > MAX_DIM || height > MAX_DIM) {
    return err('Invalid image dimensions', 422, req, env);
  }

  // Confirm the object actually landed — otherwise the gallery gets a row
  // pointing at nothing.
  const head = await env.PHOTOS.head(key);
  if (!head) return err('Object not found in storage', 409, req, env);
  if (head.size > MAX_BYTES) {
    await env.PHOTOS.delete(key);
    return err('File too large', 413, req, env);
  }

  const id = key.split('/').pop()!.split('.')[0];
  const url = `${env.PUBLIC_BASE_URL}/${key}`;
  const record: PhotoRecord = {
    id,
    // No thumbnail pipeline yet — Cloudflare Images is a paid add-on and Sharp
    // does not run on Workers. The client already downscales before upload, so
    // url and fullUrl point at the same object; the lightbox falls back to
    // `url` anyway. Swap `url` for a transformed variant if Images is enabled.
    url,
    fullUrl: url,
    uploadedAt: new Date().toISOString(),
    reported: false,
  };

  await env.PHOTO_META.put(photoKey(id), JSON.stringify({ ...record, venueId, key }));
  const index = await readIndex(env, venueId);
  await env.PHOTO_META.put(venueKey(venueId), JSON.stringify([id, ...index]));

  return json(record, 200, req, env);
}

async function handleList(req: Request, env: Env, venueId: string): Promise<Response> {
  const ids = await readIndex(env, venueId);
  const rows = await Promise.all(
    ids.map((id) => env.PHOTO_META.get<PhotoRecord & { venueId: string }>(photoKey(id), 'json')),
  );
  const out = rows
    .filter((r): r is PhotoRecord & { venueId: string } => !!r && !r.reported)
    .map(({ id, url, fullUrl, uploadedAt, reported }) => ({ id, url, fullUrl, uploadedAt, reported }));
  return json(out, 200, req, env);
}

async function handleReport(req: Request, env: Env, photoId: string): Promise<Response> {
  const raw = await env.PHOTO_META.get<PhotoRecord & { venueId: string; key: string }>(
    photoKey(photoId), 'json',
  );
  // 204 even when the row is missing: reporting is fire-and-forget on the
  // client, and a 404 here would surface an error for something already gone.
  if (!raw) return new Response(null, { status: 204, headers: corsHeaders(req, env) });

  await env.PHOTO_META.put(photoKey(photoId), JSON.stringify({ ...raw, reported: true }));
  return new Response(null, { status: 204, headers: corsHeaders(req, env) });
}

// ── router ─────────────────────────────────────────────────────────────────

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req, env) });
    }

    const { pathname } = new URL(req.url);

    let m = pathname.match(/^\/venues\/([^/]+)\/photos\/presign$/);
    if (m && req.method === 'POST') return handlePresign(req, env, decodeURIComponent(m[1]));

    m = pathname.match(/^\/venues\/([^/]+)\/photos$/);
    if (m && req.method === 'GET') return handleList(req, env, decodeURIComponent(m[1]));

    if (pathname === '/photos/complete' && req.method === 'POST') return handleComplete(req, env);

    m = pathname.match(/^\/photos\/([^/]+)\/report$/);
    if (m && req.method === 'POST') return handleReport(req, env, decodeURIComponent(m[1]));

    if (pathname === '/health') return json({ status: 'ok' }, 200, req, env);

    return err('Not found', 404, req, env);
  },
};
