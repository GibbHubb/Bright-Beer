import { useMemo } from 'react';
import styles from './TimeSlider.module.css';
import { useSunMarkers } from '../hooks/useSunMarkers';

interface Props {
  minutes: number;       // 0–1439
  onChange: (m: number) => void;
  date: Date;
  cityCentre: [number, number];
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

const TICK_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

const MARKER_COLOR: Record<string, string> = {
  // Morning markers (S31) — cool blue-violet → warm amber gradient
  dawn:          '#6366f1', // indigo — deep pre-dawn
  sunrise:       '#f59e42', // warm amber-orange — first light
  goldenHourEnd: '#fbbf24', // yellow-gold — morning golden hour ends
  // Evening markers (S26)
  goldenHour:  '#f59e0b',
  sunsetStart: '#f97316',
  sunset:      '#ef4444',
  dusk:        '#8b5cf6',
};

export default function TimeSlider({ minutes, onChange, date, cityCentre }: Props) {
  const markers = useSunMarkers(date, cityCentre);

  // Stagger label direction: alternate up/down when adjacent markers are within 60 min.
  const staggered = useMemo(() =>
    markers.map((m, i) => {
      const prev = markers[i - 1];
      const labelAbove = Boolean(prev && Math.abs(m.minutes - prev.minutes) < 60 && i % 2 === 1);
      return { ...m, labelAbove };
    }),
    [markers],
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.timeDisplay}>{formatTime(minutes)}</div>
      <div className={styles.sliderWrap}>
        <input
          type="range"
          min={0}
          max={1439}
          value={minutes}
          onChange={(e) => onChange(Number(e.target.value))}
          className={styles.slider}
        />
        <div className={styles.markers}>
          {staggered.map((m) => (
            <span
              key={m.type}
              className={`${styles.marker} ${m.labelAbove ? styles.markerAbove : ''}`}
              style={{ left: `${(m.minutes / 1440) * 100}%` }}
              title={m.label}
            >
              <span
                className={styles.markerLine}
                style={{ background: MARKER_COLOR[m.type] ?? '#9ca3af' }}
              />
              <span className={styles.markerLabel}>{m.label}</span>
            </span>
          ))}
        </div>
        <div className={styles.ticks}>
          {TICK_HOURS.map((h) => (
            <span key={h} className={styles.tick} style={{ left: `${(h / 24) * 100}%` }}>
              {h.toString().padStart(2, '0')}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
