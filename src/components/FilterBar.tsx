import type { VenueFilter } from '../lib/venueStatus';
import styles from './FilterBar.module.css';

interface Props {
  sunnyCount:    number;
  totalCount:    number;
  sunnyOnly:     boolean;
  onToggle:      () => void;
  activeFilters: VenueFilter[];
  onFilterChange:(f: VenueFilter) => void;
}

const CHIPS: { id: VenueFilter; label: string }[] = [
  { id: 'wine',  label: '🍷 Wine' },
  { id: 'canal', label: '🌊 Canal' },
  { id: 'big',   label: '👥 Big' },
  { id: 'cafe',  label: '☕ Café' },
];

export default function FilterBar({
  sunnyCount, totalCount, sunnyOnly, onToggle, activeFilters, onFilterChange,
}: Props) {
  return (
    <div className={styles.bar}>
      <div className={styles.top}>
        <span className={styles.count}>
          <span className={styles.sunny}>{sunnyCount}</span>
          <span className={styles.muted}> / {totalCount} sunny</span>
        </span>
        <button
          className={`${styles.toggle} ${sunnyOnly ? styles.active : ''}`}
          onClick={onToggle}
        >
          ☀️ Sunny only
        </button>
      </div>
      <div className={styles.chips}>
        {CHIPS.map(({ id, label }) => (
          <button
            key={id}
            className={`${styles.chip} ${activeFilters.includes(id) ? styles.active : ''}`}
            onClick={() => onFilterChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
