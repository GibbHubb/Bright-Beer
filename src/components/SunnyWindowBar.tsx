import { useMemo, useDeferredValue } from 'react';
import type { Feature, Polygon } from 'geojson';
import type { Venue } from '../lib/overpass';
import { nearbyBuildings, computeSlotStatus } from '../lib/windowSlots';
import type { Slot } from '../lib/windowSlots';
import styles from './SunnyWindowBar.module.css';

interface Props {
  venue:     Venue;
  dateStr:   string;            // 'YYYY-MM-DD'
  buildings: Feature<Polygon>[]; // viewport buildings from useBuildingTiles
}

const SLOTS = 48; // every 30 minutes

export default function SunnyWindowBar({ venue, dateStr, buildings }: Props) {
  // Defer heavy computation so popup opens immediately; bar fills in shortly after
  const deferredBuildings = useDeferredValue(buildings);

  const nearby = useMemo(
    () => nearbyBuildings(venue, deferredBuildings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [venue.id, deferredBuildings],
  );

  const slots: Slot[] = useMemo(() => {
    const base = new Date(dateStr + 'T00:00:00');
    return Array.from({ length: SLOTS }, (_, i) => {
      const d = new Date(base.getTime() + i * 30 * 60 * 1000);
      return computeSlotStatus(venue, nearby, d);
    });
  }, [venue, dateStr, nearby]);

  const sunnyHours = ((slots.filter((s) => s === 'sunny').length) * 0.5).toFixed(1);

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
            style={{
              background: s === 'sunny' ? '#FFD700' : s === 'night' ? '#111827' : '#374151',
            }}
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
