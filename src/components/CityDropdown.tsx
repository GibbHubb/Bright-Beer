import { useEffect, useRef, useState } from 'react';
import type { City } from '../constants/cities';
import type { Venue } from '../lib/overpass';
import { sunnyCountFor } from '../lib/cityStatus';
import { useMultiCityCache } from '../hooks/useMultiCityCache';
import { useRadarCounts } from '../hooks/useRadarCounts';
import { usePinnedCities } from '../hooks/usePinnedCities';
import styles from './CityDropdown.module.css';

interface Props {
  city: City;
  cities: City[];
  setCityId: (id: string) => void;
  activeVenues: Venue[];
  date: Date;
}

function sunnyLabel(count: number | null, loading: boolean): string {
  if (loading) return '—';
  if (count === null) return '—';
  if (count === 0) return 'quiet now';
  return `${count} sunny terrace${count !== 1 ? 's' : ''}`;
}

export function CityDropdown({ city, cities, setCityId, activeVenues, date }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { venuesByCity, loadingCities, cachedCities, fetchAll, prefetchAndPersist, evictCached } = useMultiCityCache();
  const { isPinned, pin, unpin } = usePinnedCities();

  // Shadow-accurate counts for non-active cities (Amsterdam only).
  // For tile-less cities the hook returns nothing → falls back to sunnyCountFor.
  const { accurateCounts, computingCities } = useRadarCounts(venuesByCity, city.id, cities, date);

  useEffect(() => {
    if (!open) return;
    fetchAll(cities, city.id);
  }, [open, cities, city.id, fetchAll]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function getCount(c: City): number | null {
    if (c.id === city.id) return sunnyCountFor(c, activeVenues, date);
    const venues = venuesByCity.get(c.id);
    if (!venues) return null;
    // Prefer shadow-accurate count if available; fall back to horizon-only.
    return accurateCounts.has(c.id) ? accurateCounts.get(c.id)! : sunnyCountFor(c, venues, date);
  }

  async function handlePinToggle(e: React.MouseEvent, c: City) {
    e.stopPropagation(); // don't trigger city selection
    if (isPinned(c.id)) {
      unpin(c.id);
      evictCached(c.id);
    } else {
      pin(c.id);
      // Fetch + write durable cache; sets cachedCities once done.
      await prefetchAndPersist(c);
    }
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button className={styles.trigger} onClick={() => setOpen(o => !o)} aria-haspopup="listbox">
        {city.name}
        <span className={styles.caret}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <ul className={styles.menu} role="listbox">
          {cities.map(c => {
            const count = getCount(c);
            // Show computing state while the radar worker is running for this city.
            const isComputing = computingCities.has(c.id);
            const loading = loadingCities.has(c.id) || isComputing;
            const active = c.id === city.id;
            const cityIsPinned = isPinned(c.id);
            const isOfflineCached = cachedCities.has(c.id);
            return (
              <li
                key={c.id}
                role="option"
                aria-selected={active}
                className={`${styles.option} ${active ? styles.optionActive : ''}`}
                onClick={() => { setCityId(c.id); setOpen(false); }}
              >
                <span className={styles.cityName}>{c.name}</span>
                <span className={styles.cityCount}>{sunnyLabel(count, loading && !active)}</span>
                <span className={styles.pinArea}>
                  {isOfflineCached && (
                    <span
                      className={styles.offlineBadge}
                      title="Available offline"
                      aria-label="Available offline"
                    >
                      offline
                    </span>
                  )}
                  <button
                    className={`${styles.pinBtn} ${cityIsPinned ? styles.pinBtnActive : ''}`}
                    onClick={(e) => handlePinToggle(e, c)}
                    aria-label={cityIsPinned ? `Unpin ${c.name}` : `Pin ${c.name} for offline use`}
                    aria-pressed={cityIsPinned}
                    title={cityIsPinned ? `Unpin ${c.name}` : `Pin ${c.name} for offline use`}
                  >
                    📌
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
