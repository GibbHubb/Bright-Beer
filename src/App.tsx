import { useState, useCallback, useMemo } from 'react';
import Map from './components/Map';
import TimeSlider from './components/TimeSlider';
import DatePicker from './components/DatePicker';
import FilterBar from './components/FilterBar';
import VenuePopup from './components/VenuePopup';
import { useSunPosition } from './hooks/useSunPosition';
import { useVenues } from './hooks/useVenues';
import { useShadows } from './hooks/useShadows';
import { useBuildingTiles } from './hooks/useBuildingTiles';
import { classifyVenues, applyFilters } from './lib/venueStatus';
import type { VenueWithStatus, VenueFilter } from './lib/venueStatus';
import { AMSTERDAM_CENTER } from './constants/amsterdam';
import './index.css';

type Bounds = { north: number; south: number; east: number; west: number };

const MAX_VENUES = 250;

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowMinutes() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

/** Haversine distance in km between two lat/lng points. */
function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function App() {
  const [dateStr,   setDateStr]   = useState(todayStr);
  const [minutes,   setMinutes]   = useState(nowMinutes);
  const [sunnyOnly, setSunnyOnly] = useState(false);
  const [filters,   setFilters]   = useState<VenueFilter[]>([]);
  const [selected,  setSelected]  = useState<VenueWithStatus | null>(null);
  const [bounds,    setBounds]    = useState<Bounds | null>(null);
  const [zoom,      setZoom]      = useState(14);
  const [center,    setCenter]    = useState<[number, number]>(AMSTERDAM_CENTER); // [lng, lat]

  const date = useMemo(() => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  }, [dateStr, minutes]);

  const sunPosition                         = useSunPosition(date);
  const { venues: rawVenues, loading, error } = useVenues();
  const buildings                           = useBuildingTiles(bounds, zoom);
  const shadows                             = useShadows(buildings, sunPosition, zoom);

  // Classify all venues, cap to 250 closest to map centre
  const venues: VenueWithStatus[] = useMemo(() => {
    const classified = classifyVenues(rawVenues, shadows, sunPosition.isAboveHorizon);
    if (classified.length <= MAX_VENUES) return classified;
    const [cLng, cLat] = center;
    return classified
      .map(v => ({ v, d: distKm(v.lat, v.lng, cLat, cLng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_VENUES)
      .map(({ v }) => v);
  }, [rawVenues, shadows, sunPosition.isAboveHorizon, center]);

  const filteredVenues = useMemo(() => {
    let result = venues;
    if (filters.length) result = applyFilters(result, filters);
    if (sunnyOnly)       result = result.filter(v => v.status === 'sunny');
    return result;
  }, [venues, filters, sunnyOnly]);

  const sunnyCount = useMemo(() => filteredVenues.filter(v => v.status === 'sunny').length, [filteredVenues]);

  const handleVenueClick = useCallback((v: VenueWithStatus) => setSelected(v), []);
  const handleClose      = useCallback(() => setSelected(null), []);
  const handleBounds     = useCallback((b: Bounds, z: number, c: [number, number]) => {
    setBounds(b); setZoom(z); setCenter(c);
  }, []);

  const toggleFilter = useCallback((f: VenueFilter) => {
    setFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  }, []);

  return (
    <div className="layout">
      <header className="header">
        <div className="header-brand">
          <span className="header-sun">☀️</span>
          <span className="header-title">Sunny Amsterdam</span>
        </div>
        <div className="header-controls">
          <DatePicker date={dateStr} onChange={setDateStr} />
        </div>
      </header>

      <div className="map-wrap">
        <Map
          venues={filteredVenues}
          shadows={shadows}
          onVenueClick={handleVenueClick}
          onBoundsChange={handleBounds}
        />

        <div className="slider-overlay">
          <TimeSlider minutes={minutes} onChange={setMinutes} />
        </div>

        <div className="filter-overlay">
          <FilterBar
            sunnyCount={sunnyCount}
            totalCount={filteredVenues.length}
            sunnyOnly={sunnyOnly}
            onToggle={() => setSunnyOnly(o => !o)}
            activeFilters={filters}
            onFilterChange={toggleFilter}
          />
          {loading && <div className="status-pill">Loading venues…</div>}
          {error   && <div className="status-pill status-pill--error">⚠ {error}</div>}
        </div>

        {selected && (
          <VenuePopup
            venue={selected}
            dateStr={dateStr}
            buildings={buildings}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  );
}
