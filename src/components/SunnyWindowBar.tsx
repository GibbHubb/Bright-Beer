import { useMemo } from 'react';
import { getSunPosition } from '../lib/sunCalc';
import { projectShadow } from '../lib/shadowGeometry';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import type { Feature, Polygon } from 'geojson';
import type { Venue } from '../lib/overpass';
import styles from './SunnyWindowBar.module.css';

interface Props {
  venue:     Venue;
  dateStr:   string;            // 'YYYY-MM-DD'
  buildings: Feature<Polygon>[]; // viewport buildings from useBuildingTiles
}

const SLOTS       = 48;   // every 30 minutes
const NEARBY_DEG  = 0.004; // ~400m bbox around venue

/** Filter buildings to only those within ±NEARBY_DEG of the venue (fast pre-filter). */
function nearbyBuildings(venue: Venue, all: Feature<Polygon>[]): Feature<Polygon>[] {
  const { lat, lng } = venue;
  return all.filter((f) => {
    const coords = f.geometry.coordinates[0];
    return coords.some(([bLng, bLat]) =>
      Math.abs(bLng - lng) < NEARBY_DEG && Math.abs(bLat - lat) < NEARBY_DEG,
    );
  });
}

type Slot = 'sunny' | 'shaded' | 'night';

function computeSlotStatus(
  venue:    Venue,
  nearby:   Feature<Polygon>[],
  date:     Date,
): Slot {
  const sun = getSunPosition(date);
  if (!sun.isAboveHorizon) return 'night';

  const pt = point([venue.lng, venue.lat]);

  for (const building of nearby) {
    const shadow = projectShadow(building, sun.azimuth, sun.altitude);
    if (shadow && booleanPointInPolygon(pt, shadow)) return 'shaded';
  }
  return 'sunny';
}

export default function SunnyWindowBar({ venue, dateStr, buildings }: Props) {
  const nearby = useMemo(
    () => nearbyBuildings(venue, buildings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [venue.id, buildings],
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
