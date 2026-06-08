import { useEffect, useRef, useState } from 'react';
import type { City } from '../constants/cities';
import type { Venue } from '../lib/overpass';
import { sunnyCountFor } from '../lib/cityStatus';
import { useMultiCityCache } from '../hooks/useMultiCityCache';
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
  const { venuesByCity, loadingCities, fetchAll } = useMultiCityCache();

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
    return sunnyCountFor(c, venues, date);
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
            const loading = loadingCities.has(c.id);
            const active = c.id === city.id;
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
