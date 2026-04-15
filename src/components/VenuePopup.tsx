import type { VenueWithStatus } from '../lib/venueStatus';
import type { FeatureCollection, Polygon } from 'geojson';
import SunnyWindowBar from './SunnyWindowBar';
import styles from './VenuePopup.module.css';

interface Props {
  venue: VenueWithStatus;
  dateStr: string;
  shadows: FeatureCollection<Polygon>;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  sunny:  '☀️ In direct sun',
  shaded: '🌑 In shade',
  night:  '🌙 Night',
};

export default function VenuePopup({ venue, dateStr, shadows, onClose }: Props) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;

  return (
    <div className={styles.popup}>
      <button className={styles.close} onClick={onClose}>✕</button>
      <div className={styles.status}>{STATUS_LABEL[venue.status] ?? venue.status}</div>
      <h3 className={styles.name}>{venue.name}</h3>
      {venue.address && <p className={styles.address}>{venue.address}</p>}
      {venue.openingHours && (
        <p className={styles.hours}>🕐 {venue.openingHours}</p>
      )}
      <SunnyWindowBar venue={venue} dateStr={dateStr} shadows={shadows} />
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={styles.mapsLink}>
        Open in Google Maps →
      </a>
    </div>
  );
}
