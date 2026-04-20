import { useState } from 'react';
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

export default function VenuePopup({ venue, dateStr, minutes, buildings, onClose }: Props) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;
  const [copied, setCopied] = useState(false);

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
    <div className={styles.popup}>
      <button className={styles.close} onClick={onClose}>✕</button>
      <div className={styles.status}>{STATUS_LABEL[venue.status] ?? venue.status}</div>
      <h3 className={styles.name}>{venue.name}</h3>
      {venue.address && <p className={styles.address}>{venue.address}</p>}
      {venue.openingHours && <p className={styles.hours}>🕐 {venue.openingHours}</p>}
      <SunnyWindowBar venue={venue} dateStr={dateStr} buildings={buildings} />
      <div className={styles.actions}>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={styles.mapsLink}>
          Open in Maps →
        </a>
        <button className={styles.shareBtn} onClick={handleShare}>
          {copied ? '✓ Copied!' : 'Share ↗'}
        </button>
      </div>
    </div>
  );
}
