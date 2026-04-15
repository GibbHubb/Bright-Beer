import { useMemo } from 'react';
import { getSunPosition } from '../lib/sunCalc';
import { classifyVenues } from '../lib/venueStatus';
import type { Venue } from '../lib/overpass';
import type { FeatureCollection, Polygon } from 'geojson';
import styles from './SunnyWindowBar.module.css';

interface Props {
  venue: Venue;
  dateStr: string;  // 'YYYY-MM-DD'
  shadows: FeatureCollection<Polygon>;
}

const SLOTS = 48; // every 30 minutes

export default function SunnyWindowBar({ venue, dateStr, shadows }: Props) {
  const slots = useMemo(() => {
    const base = new Date(dateStr + 'T00:00:00');
    return Array.from({ length: SLOTS }, (_, i) => {
      const d = new Date(base.getTime() + i * 30 * 60 * 1000);
      const sun = getSunPosition(d);
      const [classified] = classifyVenues([venue], shadows, sun.isAboveHorizon);
      return classified.status;
    });
  }, [venue.id, dateStr, shadows]);

  const sunnyCount = slots.filter((s) => s === 'sunny').length;
  const sunnyHours = (sunnyCount * 0.5).toFixed(1);

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>
        <span>Sun today</span>
        <span className={styles.hours}>{sunnyHours}h</span>
      </div>
      <div className={styles.bar}>
        {slots.map((s, i) => (
          <div
            key={i}
            className={styles.slot}
            style={{ background: s === 'sunny' ? '#FFD700' : s === 'night' ? '#111827' : '#374151' }}
            title={`${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'} — ${s}`}
          />
        ))}
      </div>
      <div className={styles.axis}>
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h} style={{ left: `${(h / 24) * 100}%` }}>
            {h.toString().padStart(2, '0')}
          </span>
        ))}
      </div>
    </div>
  );
}
