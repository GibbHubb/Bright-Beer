import React, { useState, useCallback, useMemo } from 'react';
import Map from './components/Map';
import TimeSlider from './components/TimeSlider';
import DatePicker from './components/DatePicker';
import FilterBar from './components/FilterBar';
import VenuePopup from './components/VenuePopup';
import { useSunPosition } from './hooks/useSunPosition';
import { useVenues } from './hooks/useVenues';
import { useShadows } from './hooks/useShadows';
import { useBuildingTiles } from './hooks/useBuildingTiles';
import { classifyVenues } from './lib/venueStatus';
import type { VenueWithStatus } from './lib/venueStatus';

import './index.css';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export default function App() {
  const [dateStr,   setDateStr]   = useState(todayStr);
  const [minutes,   setMinutes]   = useState(nowMinutes);
  const [sunnyOnly, setSunnyOnly] = useState(false);
  const [selected,  setSelected]  = useState<VenueWithStatus | null>(null);
  const [bounds,    setBounds]    = useState<{ north: number; south: number; east: number; west: number } | null>(null);

  // Derive a Date from dateStr + minutes
  const date = useMemo(() => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
    return dt;
  }, [dateStr, minutes]);

  const sunPosition  = useSunPosition(date);
  const rawVenues    = useVenues();
  const buildings    = useBuildingTiles(bounds);
  const shadows      = useShadows(buildings, sunPosition);

  const venues: VenueWithStatus[] = useMemo(
    () => classifyVenues(rawVenues, shadows, sunPosition.isAboveHorizon),
    [rawVenues, shadows, sunPosition.isAboveHorizon],
  );

  const filteredVenues = useMemo(
    () => sunnyOnly ? venues.filter(v => v.status === 'sunny') : venues,
    [venues, sunnyOnly],
  );

  const sunnyCount = useMemo(() => venues.filter(v => v.status === 'sunny').length, [venues]);

  const handleVenueClick = useCallback((v: VenueWithStatus) => setSelected(v), []);
  const handleClose      = useCallback(() => setSelected(null), []);
  const handleBounds     = useCallback((b: MapBounds) => setBounds(b), []);

  return (
    <div className="layout">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <span className="header-sun">☀️</span>
          <span className="header-title">Sunny Amsterdam</span>
        </div>
        <div className="header-controls">
          <DatePicker value={dateStr} onChange={setDateStr} />
        </div>
      </header>

      {/* Map fills the rest */}
      <div className="map-wrap">
        <Map
          venues={filteredVenues}
          shadows={shadows}
          onVenueClick={handleVenueClick}
          onBoundsChange={handleBounds}
        />

        {/* Time slider overlay */}
        <div className="slider-overlay">
          <TimeSlider value={minutes} onChange={setMinutes} />
        </div>

        {/* Filter bar overlay */}
        <div className="filter-overlay">
          <FilterBar
            sunnyCount={sunnyCount}
            totalCount={venues.length}
            sunnyOnly={sunnyOnly}
            onToggle={() => setSunnyOnly(o => !o)}
          />
        </div>

        {/* Venue popup */}
        {selected && (
          <VenuePopup
            venue={selected}
            dateStr={dateStr}
            shadows={shadows}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  );
}
