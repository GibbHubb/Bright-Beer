// S9 — "Arriving now" 4-hour × 15-minute sun-status strip per venue.
//
// Reuses S3's `computeSlotStatus` so the visual matches the SunnyWindowBar's
// daylong view exactly. Updates live via the shared `useNow` ticker —
// re-renders once per minute (the now-marker sweeps across cells), and the
// 16-slot computation re-runs whenever the displayed minute crosses a
// 15-minute boundary (cheap: 16 calls × N nearby buildings).

import { useMemo, useDeferredValue } from 'react';
import type { Feature, Polygon } from 'geojson';
import type { Venue } from '../lib/overpass';
import { computeSlotStatus, nearbyBuildings } from '../lib/windowSlots';
import type { Slot } from '../lib/windowSlots';
import { useNow } from '../hooks/useNow';
import styles from './SunTimeline.module.css';

interface Props {
  venue: Venue;
  buildings: Feature<Polygon>[];
}

const SLOT_MINUTES = 15;
const SLOT_COUNT = 16;            // 4 hours
const TOTAL_MINUTES = SLOT_COUNT * SLOT_MINUTES;

const SLOT_LABEL: Record<Slot, string> = {
  sunny: '☀',
  shaded: '·',
  night: '🌙',
};

function fmtHM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function SunTimeline({ venue, buildings }: Props) {
  const now = useNow();
  // Defer the heavy nearby-building filter the same way SunnyWindowBar does.
  const deferredBuildings = useDeferredValue(buildings);

  const nearby = useMemo(
    () => nearbyBuildings(venue, deferredBuildings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [venue.id, deferredBuildings],
  );

  // Anchor the first cell at the current minute (no rounding to the next
  // quarter hour — keeps the now-marker pinned to the very left edge).
  // Slot computation re-runs whenever the minute crosses a 15-minute boundary.
  const slotKey = Math.floor(now.getTime() / (SLOT_MINUTES * 60 * 1000));
  const slots: { date: Date; status: Slot }[] = useMemo(() => {
    return Array.from({ length: SLOT_COUNT }, (_, i) => {
      const d = new Date(now.getTime() + i * SLOT_MINUTES * 60 * 1000);
      return { date: d, status: computeSlotStatus(venue, nearby, d) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue.id, slotKey, nearby]);

  // Now-marker advances each minute even when slot recompute hasn't fired.
  // Position is `(elapsedMinutesIntoCurrentSlot / SLOT_MINUTES) * cellWidthPct`.
  // We express it as a percent of the whole bar (1/16 per cell).
  const elapsedInSlot = (now.getMinutes() % SLOT_MINUTES) + now.getSeconds() / 60;
  const nowMarkerPct = (elapsedInSlot / SLOT_MINUTES) * (100 / SLOT_COUNT);

  const endTime = new Date(now.getTime() + TOTAL_MINUTES * 60 * 1000);

  return (
    <div className={styles.wrap}>
      <div className={styles.headerRow}>
        <span className={styles.label}>Next {TOTAL_MINUTES / 60}h</span>
        <span className={styles.range}>{fmtHM(now)} → {fmtHM(endTime)}</span>
      </div>
      <div className={styles.strip} role="img" aria-label={`Sun status for the next ${TOTAL_MINUTES / 60} hours`}>
        {slots.map(({ date, status }, i) => (
          <div
            key={i}
            className={`${styles.cell} ${styles[`cell_${status}`]}`}
            title={`${fmtHM(date)} · ${status}`}
            aria-label={`${fmtHM(date)} ${status}`}
          >
            <span className={styles.cellGlyph}>{SLOT_LABEL[status]}</span>
          </div>
        ))}
        <div className={styles.nowMarker} style={{ left: `${nowMarkerPct}%` }} aria-hidden="true" />
      </div>
    </div>
  );
}
