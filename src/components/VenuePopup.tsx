import { useState, useEffect } from 'react';
import type { Feature, Polygon } from 'geojson';
import type { VenueWithStatus } from '../lib/venueStatus';
import SunnyWindowBar from './SunnyWindowBar';
import styles from './VenuePopup.module.css';

interface Props {
  venue:     VenueWithStatus;
  dateStr:   string;
  minutes:   number;
  buildings: Feature<Polygon>[];
  onClose:   () => void;
  isFavourite?:     boolean;
  onToggleFavourite?: (id: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  sunny:  '☀️ In direct sun',
  shaded: '🌑 In shade',
  night:  '🌙 Night',
};

function buildShareUrl(venue: VenueWithStatus, dateStr: string, minutes: number): string {
  const base = window.location.href.split('?')[0];
  const params = new URLSearchParams({
    lat: venue.lat.toFixed(5),
    lng: venue.lng.toFixed(5),
    date: dateStr,
    time: String(minutes),
    venue: venue.id,
  });
  return `${base}?${params}`;
}

/** Strip protocol and trailing slash for display only. */
function prettyWebsite(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** Normalise website URL for the href attribute (ensure protocol). */
function normaliseWebsite(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

export default function VenuePopup({
  venue, dateStr, minutes, buildings, onClose,
  isFavourite = false, onToggleFavourite,
}: Props) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;
  const [copied, setCopied] = useState(false);

  // S6 — close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleShare = async () => {
    const url = buildShareUrl(venue, dateStr, minutes);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for non-HTTPS
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className={styles.popup} role="dialog" aria-label={venue.name}>
      <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>

      <div className={styles.headerRow}>
        <div className={styles.headerMain}>
          <div className={styles.status}>{STATUS_LABEL[venue.status] ?? venue.status}</div>
          <h3 className={styles.name}>{venue.name}</h3>
        </div>
        {onToggleFavourite && (
          <button
            className={`${styles.favBtn} ${isFavourite ? styles.favActive : ''}`}
            onClick={() => onToggleFavourite(venue.id)}
            aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
            title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          >
            {isFavourite ? '♥' : '♡'}
          </button>
        )}
      </div>

      <div className={styles.details}>
        <div className={styles.row}>
          <span className={styles.rowIcon}>📍</span>
          <span className={styles.rowText}>
            {venue.address || <em className={styles.muted}>Address not available</em>}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowIcon}>🕐</span>
          <span className={styles.rowText}>
            {venue.openingHours || <em className={styles.muted}>Hours not available</em>}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowIcon}>🌐</span>
          <span className={styles.rowText}>
            {venue.website
              ? (
                <a
                  href={normaliseWebsite(venue.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.link}
                >
                  {prettyWebsite(venue.website)}
                </a>
              )
              : <em className={styles.muted}>Website not available</em>
            }
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowIcon}>📞</span>
          <span className={styles.rowText}>
            {venue.phone
              ? <a href={`tel:${venue.phone}`} className={styles.link}>{venue.phone}</a>
              : <em className={styles.muted}>Phone not available</em>
            }
          </span>
        </div>
      </div>

      <SunnyWindowBar venue={venue} dateStr={dateStr} buildings={buildings} />

      <div className={styles.actions}>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={styles.mapsLink}>
          Open in Maps →
        </a>
        <button className={styles.shareBtn} onClick={handleShare}>
          {copied ? '✓ Copied!' : 'Share ↗'}
        </button>
      </div>
    </aside>
  );
}
