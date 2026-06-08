// S10 — venue photo storage with a stub-first design.
//
// Two modes, toggled by `VITE_PHOTO_WORKER_URL`:
//
//   - **demo mode** (no env): photos are downscaled to ≤ 320px, stored as
//     base64 thumbnails in `localStorage`. Persists across reloads on the
//     same device only. A banner in the gallery tells users this is local.
//
//   - **worker mode** (env set): the worker is expected to expose:
//        POST  {VITE_PHOTO_WORKER_URL}/venues/:venueId/photos/presign
//              body: { contentType, contentLength }
//              -> { uploadUrl, getUrl, key } — uploadUrl is a presigned PUT
//        POST  {VITE_PHOTO_WORKER_URL}/photos/complete
//              body: { venueId, key, width, height }
//              -> { id, url } — server now serves a thumbnail at this URL
//        GET   {VITE_PHOTO_WORKER_URL}/venues/:venueId/photos
//              -> [{ id, url, fullUrl, uploadedAt, reported }]
//        POST  {VITE_PHOTO_WORKER_URL}/photos/:id/report
//              -> 204
//     A reference Worker scaffold lives at `worker/README.md` in this repo.
//
// File constraints are enforced client-side both ways: jpeg/png/webp,
// ≤ 8 MB, ≤ 4000×4000. The same checks need to live in the Worker too.

const WORKER_URL = (import.meta.env.VITE_PHOTO_WORKER_URL ?? '').replace(/\/$/, '');
const DEMO_KEY_PREFIX = 'bright-beer-photos-v1:';
const SESSION_KEY = 'bright-beer-session-id-v1';
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_DIM   = 4000;
const THUMB_MAX = 320;
const ALLOWED   = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DAILY_CAP = 5;   // per venue per session per day

export interface PhotoRecord {
  id: string;
  url: string;       // thumbnail (or base64 in demo mode)
  fullUrl?: string;  // full-size (omitted in demo mode — base64 is already small)
  uploadedAt: string;
  reported?: boolean;
}

export const PHOTOS_MODE: 'worker' | 'demo' = WORKER_URL ? 'worker' : 'demo';

/** Session id, persisted in localStorage. Used for rate-limit attribution. */
export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function todayStamp(): string { return new Date().toISOString().slice(0, 10); }
function rateKey(venueId: string): string { return `bright-beer-rate-v1:${venueId}:${todayStamp()}`; }

/** True if the per-venue-per-day cap is reached. Mutates on each accepted upload. */
function checkAndBumpRateLimit(venueId: string): boolean {
  const key = rateKey(venueId);
  const n = parseInt(localStorage.getItem(key) ?? '0', 10);
  if (n >= DAILY_CAP) return false;
  localStorage.setItem(key, String(n + 1));
  return true;
}

export class PhotoUploadError extends Error {
  code: 'too_large' | 'bad_type' | 'too_big_dim' | 'rate_limit' | 'network';
  constructor(code: 'too_large' | 'bad_type' | 'too_big_dim' | 'rate_limit' | 'network', msg: string) {
    super(msg);
    this.code = code;
  }
}

/** Validate type + byte size synchronously (file dialog stage). */
export function validateFile(file: File): void {
  if (!ALLOWED.has(file.type)) throw new PhotoUploadError('bad_type', 'Only JPEG, PNG, and WebP are accepted.');
  if (file.size > MAX_BYTES) throw new PhotoUploadError('too_large', 'Maximum file size is 8 MB.');
}

/** Decode the file to check pixel dimensions; also returns the natural size. */
async function readImageDims(file: File): Promise<{ width: number; height: number; bitmap: ImageBitmap }> {
  const bitmap = await createImageBitmap(file);
  if (bitmap.width > MAX_DIM || bitmap.height > MAX_DIM) {
    bitmap.close();
    throw new PhotoUploadError('too_big_dim', `Maximum dimensions are ${MAX_DIM}×${MAX_DIM}.`);
  }
  return { width: bitmap.width, height: bitmap.height, bitmap };
}

/** Render a centred contain thumbnail to a data URL — used in demo mode. */
async function toThumbDataUrl(bitmap: ImageBitmap): Promise<string> {
  const scale = Math.min(1, THUMB_MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoUploadError('network', 'Canvas unavailable.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.78);
}

// ── demo mode storage ──────────────────────────────────────────────────────

function demoKey(venueId: string): string { return DEMO_KEY_PREFIX + venueId; }

function demoRead(venueId: string): PhotoRecord[] {
  try {
    const raw = localStorage.getItem(demoKey(venueId));
    return raw ? (JSON.parse(raw) as PhotoRecord[]) : [];
  } catch {
    return [];
  }
}

function demoWrite(venueId: string, list: PhotoRecord[]): void {
  try {
    localStorage.setItem(demoKey(venueId), JSON.stringify(list));
  } catch (e) {
    // QuotaExceeded — silently drop the oldest until it fits.
    while (list.length > 1) {
      list.shift();
      try {
        localStorage.setItem(demoKey(venueId), JSON.stringify(list));
        return;
      } catch { /* try again */ }
    }
  }
}

// ── public API ─────────────────────────────────────────────────────────────

export async function listPhotos(venueId: string): Promise<PhotoRecord[]> {
  if (PHOTOS_MODE === 'demo') {
    return demoRead(venueId).filter((p) => !p.reported);
  }
  const res = await fetch(`${WORKER_URL}/venues/${venueId}/photos`);
  if (!res.ok) throw new PhotoUploadError('network', `List failed (HTTP ${res.status})`);
  return (await res.json()) as PhotoRecord[];
}

export async function uploadPhoto(venueId: string, file: File): Promise<PhotoRecord> {
  validateFile(file);
  const { width, height, bitmap } = await readImageDims(file);
  if (!checkAndBumpRateLimit(venueId)) {
    bitmap.close();
    throw new PhotoUploadError('rate_limit', `You can only upload ${DAILY_CAP} photos per venue per day.`);
  }

  if (PHOTOS_MODE === 'demo') {
    const dataUrl = await toThumbDataUrl(bitmap);
    bitmap.close();
    const record: PhotoRecord = {
      id: crypto.randomUUID(),
      url: dataUrl,
      uploadedAt: new Date().toISOString(),
    };
    const next = [...demoRead(venueId), record];
    demoWrite(venueId, next);
    return record;
  }

  // Worker mode: presign → PUT → complete
  bitmap.close();
  const presign = await fetch(`${WORKER_URL}/venues/${venueId}/photos/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() },
    body: JSON.stringify({ contentType: file.type, contentLength: file.size }),
  });
  if (!presign.ok) throw new PhotoUploadError('network', `Presign failed (HTTP ${presign.status})`);
  const { uploadUrl, key } = await presign.json() as { uploadUrl: string; key: string };

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!putRes.ok) throw new PhotoUploadError('network', `Upload failed (HTTP ${putRes.status})`);

  const complete = await fetch(`${WORKER_URL}/photos/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() },
    body: JSON.stringify({ venueId, key, width, height }),
  });
  if (!complete.ok) throw new PhotoUploadError('network', `Finalise failed (HTTP ${complete.status})`);
  return (await complete.json()) as PhotoRecord;
}

export async function reportPhoto(venueId: string, photoId: string): Promise<void> {
  if (PHOTOS_MODE === 'demo') {
    const list = demoRead(venueId).map((p) => (p.id === photoId ? { ...p, reported: true } : p));
    demoWrite(venueId, list);
    return;
  }
  await fetch(`${WORKER_URL}/photos/${photoId}/report`, {
    method: 'POST',
    headers: { 'X-Session-Id': getSessionId() },
  });
}
