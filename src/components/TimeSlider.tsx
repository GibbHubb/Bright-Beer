import styles from './TimeSlider.module.css';

interface Props {
  minutes: number;       // 0–1439
  onChange: (m: number) => void;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

const TICK_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

export default function TimeSlider({ minutes, onChange }: Props) {
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
