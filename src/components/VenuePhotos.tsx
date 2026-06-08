import { useEffect, useRef, useState } from 'react';
import {
  listPhotos,
  uploadPhoto,
  reportPhoto,
  validateFile,
  PHOTOS_MODE,
  PhotoUploadError,
  type PhotoRecord,
} from '../lib/photos';
import styles from './VenuePhotos.module.css';

interface Props {
  venueId: string;
  venueName: string;
}

const MAX_THUMBS = 3;

export default function VenuePhotos({ venueId, venueName }: Props) {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPhotos(venueId)
      .then((list) => { if (!cancelled) setPhotos(list); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [venueId]);

  const handlePick = () => {
    setError(null);
    fileRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      validateFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const next = await uploadPhoto(venueId, file);
      setPhotos((prev) => [...prev, next]);
    } catch (err) {
      if (err instanceof PhotoUploadError) setError(err.message);
      else setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleReport = async (photo: PhotoRecord) => {
    if (!confirm('Report this photo as inappropriate? It will be hidden.')) return;
    await reportPhoto(venueId, photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setLightboxIdx(null);
  };

  const visible = photos.slice(0, MAX_THUMBS);
  const overflow = Math.max(0, photos.length - MAX_THUMBS);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.title}>📸 Photos</span>
        <button
          className={styles.uploadBtn}
          onClick={handlePick}
          disabled={uploading}
          title="Upload a photo of this venue"
        >
          {uploading ? 'Uploading…' : '+ Add'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={handleFile}
        />
      </div>

      {PHOTOS_MODE === 'demo' && (
        <div className={styles.demoBanner}>
          Photos are stored on this device only until the upload service is configured.
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : photos.length === 0 ? (
        <div className={styles.empty}>No photos yet — be the first.</div>
      ) : (
        <div className={styles.grid}>
          {visible.map((p, i) => (
            <button
              key={p.id}
              className={styles.thumbBtn}
              onClick={() => setLightboxIdx(i)}
              aria-label={`Open photo ${i + 1} of ${venueName}`}
            >
              <img src={p.url} alt="" className={styles.thumb} loading="lazy" />
            </button>
          ))}
          {overflow > 0 && (
            <button className={styles.thumbBtn} onClick={() => setLightboxIdx(MAX_THUMBS)}>
              <div className={styles.overflowTile}>+{overflow}</div>
            </button>
          )}
        </div>
      )}

      {lightboxIdx !== null && (
        <Lightbox
          photos={photos}
          startIdx={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onReport={handleReport}
          venueName={venueName}
        />
      )}
    </div>
  );
}

function Lightbox({
  photos, startIdx, onClose, onReport, venueName,
}: {
  photos: PhotoRecord[];
  startIdx: number;
  onClose: () => void;
  onReport: (p: PhotoRecord) => void;
  venueName: string;
}) {
  const [idx, setIdx] = useState(startIdx);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  setIdx((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(photos.length - 1, i + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, photos.length]);

  const photo = photos[idx];
  if (!photo) return null;

  return (
    <div className={styles.lightbox} role="dialog" aria-label={`Photo of ${venueName}`}>
      <button className={styles.lightboxClose} onClick={onClose} aria-label="Close">✕</button>
      <img src={photo.fullUrl ?? photo.url} alt={venueName} className={styles.lightboxImg} />
      <div className={styles.lightboxActions}>
        <button
          className={styles.lightboxNav}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
        >‹</button>
        <span className={styles.lightboxCounter}>{idx + 1} / {photos.length}</span>
        <button
          className={styles.lightboxNav}
          onClick={() => setIdx((i) => Math.min(photos.length - 1, i + 1))}
          disabled={idx === photos.length - 1}
        >›</button>
        <button className={styles.reportBtn} onClick={() => onReport(photo)}>Report</button>
      </div>
    </div>
  );
}
