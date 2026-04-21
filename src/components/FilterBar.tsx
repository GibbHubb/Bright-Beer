import type { VenueFilter } from '../lib/venueStatus';
import type { WeatherConfidence } from '../hooks/useWeather';
import styles from './FilterBar.module.css';

interface Props {
  sunnyCount:        number;
  totalCount:        number;
  sunnyOnly:         boolean;
  onToggle:          () => void;
  activeFilters:     VenueFilter[];
  onFilterChange:    (f: VenueFilter) => void;
  weatherConfidence: WeatherConfidence | null;
  favouritesOnly:    boolean;
  onFavouritesToggle: () => void;
  favouriteCount:    number;
}

const CHIPS: { id: VenueFilter; label: string }[] = [
  { id: 'wine',  label: '🍷 Wine' },
  { id: 'canal', label: '🌊 Canal' },
  { id: 'big',   label: '👥 Big' },
  { id: 'cafe',  label: '☕ Cafe' },
];

const WEATHER_LABEL: Record<WeatherConfidence, string> = {
  clear:  '☀ Clear',
  cloudy: '⛅ Cloudy',
  rain:   '🌧 Rain expected',
};

export default function FilterBar({
  sunnyCount, totalCount, sunnyOnly, onToggle, activeFilters, onFilterChange, weatherConfidence,
  favouritesOnly, onFavouritesToggle, favouriteCount,
}: Props) {
  return (
    <div className={styles.bar}>
      <div className={styles.top}>
        <span className={styles.count}>
          <span className={styles.sunny}>{sunnyCount}</span>
          <span className={styles.muted}> / {totalCount} sunny</span>
        </span>
        <div className={styles.topRight}>
          {weatherConfidence && (
            <span className={`${styles.weatherBadge} ${styles[`weather_${weatherConfidence}`]}`}>
              {WEATHER_LABEL[weatherConfidence]}
            </span>
          )}
          <button
            className={`${styles.toggle} ${sunnyOnly ? styles.active : ''}`}
            onClick={onToggle}
          >
            ☀️ Sunny only
          </button>
        </div>
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
        <button
          className={`${styles.chip} ${styles.favChip} ${favouritesOnly ? styles.active : ''}`}
          onClick={onFavouritesToggle}
          disabled={favouriteCount === 0 && !favouritesOnly}
          title={favouriteCount === 0 ? 'Heart a venue to save favourites' : undefined}
        >
          ♥ Favourites{favouriteCount > 0 ? ` (${favouriteCount})` : ''}
        </button>
      </div>
    </div>
  );
}
