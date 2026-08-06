import { useState, useCallback, useMemo, useEffect } from 'react';
import Map from './components/Map';
import TimeSlider from './components/TimeSlider';
import DatePicker from './components/DatePicker';
import FilterBar from './components/FilterBar';
import VenuePopup from './components/VenuePopup';
import BestWindowBanner from './components/BestWindowBanner';
import { SunsetBanner } from './components/SunsetBanner';
import { VenueList } from './components/VenueList';
import { CityDropdown } from './components/CityDropdown';
import { useSunPosition } from './hooks/useSunPosition';
import { useVenues } from './hooks/useVenues';
import { useShadows } from './hooks/useShadows';
import { useBuildingTiles } from './hooks/useBuildingTiles';
import { useWeather, getConfidence } from './hooks/useWeather';
import { useFavourites } from './hooks/useFavourites';
import { useDebugFlag } from './hooks/useDebugFlag';
import { useCity } from './hooks/useCity';
import SunDebugOverlay from './dev/SunDebugOverlay';
import { setSunReferencePoint, getSunPosition } from './lib/sunCalc';
import { classifyVenues, applyFilters } from './lib/venueStatus';
import { computeBestWindow } from './lib/bestWindow';
import { getMorningSampleTime, computeMorningShadows, filterMorningSun } from './lib/morningSun';
import type { VenueWithStatus, VenueFilter } from './lib/venueStatus';
import type { WeatherConfidence } from './hooks/useWeather';
import { AMSTERDAM_CENTER } from './constants/amsterdam';
import { findNeighbourhood } from './constants/neighbourhoods';
import './index.css';

type Bounds = { north: number; south: number; east: number; west: number };

const MAX_VENUES = 250;

// S4 — read URL params once at module level
const _params = new URLSearchParams(window.location.search);

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
  // S4 — initialise from URL params if present
  const [dateStr,   setDateStr]   = useState(() => _params.get('date') ?? todayStr());
  const [minutes,   setMinutes]   = useState(() => {
    const t = parseInt(_params.get('time') ?? '', 10);
    return isFinite(t) ? t : nowMinutes();
  });
  const [sunnyOnly, setSunnyOnly] = useState(false);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [filters,   setFilters]   = useState<VenueFilter[]>([]);
  const [neighbourhoodId, setNeighbourhoodId] = useState<string | null>(
    () => _params.get('hood'),
  );
  // S11 — Terrace-only filter, off by default; opt-in via chip or ?terrace=1
  const [terraceOnly, setTerraceOnly] = useState<boolean>(
    () => _params.get('terrace') === '1',
  );
  // S31 — Morning-sun filter (off by default)
  const [morningSunOnly, setMorningSunOnly] = useState(false);
  const [selected,  setSelected]  = useState<VenueWithStatus | null>(null);
  const [bounds,    setBounds]    = useState<Bounds | null>(null);
  const [zoom,      setZoom]      = useState(14);
  // S12 — initial centre falls back to whatever city the URL chose, but
  // explicit ?lat/?lng wins. Re-centring on city change is handled by Map.
  const [center,    setCenter]    = useState<[number, number]>(() => {
    const lat = parseFloat(_params.get('lat') ?? '');
    const lng = parseFloat(_params.get('lng') ?? '');
    return isFinite(lat) && isFinite(lng) ? [lng, lat] : AMSTERDAM_CENTER;
  });
  const [venueIdFromUrl] = useState(() => _params.get('venue'));

  const date = useMemo(() => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  }, [dateStr, minutes]);

  // S12 — active city drives venue fetch + map centre + sun reference point
  const { city, cities, setCityId } = useCity();
  // Sync sun-calc reference point on every city change so any module-scoped
  // consumer (currently none) sees the new origin.
  useEffect(() => { setSunReferencePoint(city.center); }, [city.center]);
  // Neighbourhood ids are city-scoped; clear on city change.
  // S31-fu1 — classic reset-on-prop-change. React's sanctioned replacement is
  // adjusting state during render against a prevCityId, which changes *when*
  // the reset lands (render vs commit). Not changed blind. Tracked as S31-fu2.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setNeighbourhoodId(null); setSelected(null); }, [city.id]);

  const sunPosition                           = useSunPosition(date);
  const debugMode                             = useDebugFlag();
  const { venues: rawVenues, loading, error } = useVenues(city);
  const buildings                           = useBuildingTiles(bounds, zoom);
  const shadows                             = useShadows(buildings, sunPosition, zoom);
  const { favouriteIds, isFavourite, toggleFavourite } = useFavourites();

  // S31 — Morning sample: memoised per dateStr + city.center (fixed for a day/city).
  // We construct a noon-anchored Date from dateStr so changes to the slider
  // minute-of-day do NOT invalidate this memo — only date or city do.
  const morningSampleTime = useMemo(() => {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const dayDate = new Date(y, mo - 1, d, 12, 0, 0, 0); // noon anchor — any hour works
    return getMorningSampleTime(dayDate, city.center);
  }, [dateStr, city.center]);
  const morningShadows = useMemo(() => {
    if (!morningSampleTime) return { type: 'FeatureCollection' as const, features: [] };
    return computeMorningShadows(buildings, morningSampleTime, city.center);
  }, [buildings, morningSampleTime, city.center]);
  const morningSunIsAboveHorizon = useMemo(() => {
    if (!morningSampleTime) return false;
    return getSunPosition(morningSampleTime, city.center).isAboveHorizon;
  }, [morningSampleTime, city.center]);

  // S5 — weather confidence
  const weather = useWeather();
  const weatherConfidence: WeatherConfidence | null = useMemo(() => {
    if (dateStr !== todayStr()) return null; // only apply to today
    const hourIdx = Math.floor(minutes / 60);
    return getConfidence(weather, hourIdx);
  }, [weather, minutes, dateStr]);

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

  const neighbourhood = useMemo(
    () => findNeighbourhood(neighbourhoodId, city.id),
    [neighbourhoodId, city.id],
  );

  const filteredVenues = useMemo(() => {
    let result = venues;
    if (filters.length)  result = applyFilters(result, filters);
    if (sunnyOnly)       result = result.filter(v => v.status === 'sunny');
    if (favouritesOnly)  result = result.filter(v => favouriteIds.has(v.id));
    if (terraceOnly)     result = result.filter(v => v.hasOutdoorSeating);
    // S31 — morning-sun filter: terrace-aware, derived from occlusion at sample time
    if (morningSunOnly)  result = filterMorningSun(result, morningShadows, morningSunIsAboveHorizon);
    if (neighbourhood) {
      const [s, w, n, e] = neighbourhood.bbox;
      result = result.filter(v => v.lat >= s && v.lat <= n && v.lng >= w && v.lng <= e);
    }
    return result;
  }, [venues, filters, sunnyOnly, favouritesOnly, terraceOnly, morningSunOnly,
      morningShadows, morningSunIsAboveHorizon, favouriteIds, neighbourhood]);

  const sunnyCount = useMemo(() => filteredVenues.filter(v => v.status === 'sunny').length, [filteredVenues]);
  // S11 — count of terrace-eligible venues in the current view (used for the chip label)
  const terraceCount = useMemo(
    () => filteredVenues.filter(v => v.hasOutdoorSeating).length,
    [filteredVenues],
  );

  // S3 — best sunny window banner (recomputes only on date / buildings change)
  const bestWindow = useMemo(
    () => computeBestWindow(venues, buildings, dateStr, center),
    [venues, buildings, dateStr, center],
  );

  // S4 — open venue popup from URL param when venues first load
  useEffect(() => {
    if (!venueIdFromUrl || !venues.length) return;
    const match = venues.find((v) => v.id === venueIdFromUrl);
    if (match) {
      // S31-fu1 — one-shot sync from a URL param once venues arrive. Genuinely
      // external-input driven, so the effect is defensible; the rule cannot
      // tell that apart. Tracked as S31-fu2.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(match);
      setCenter([match.lng, match.lat]);
    }
  }, [venues, venueIdFromUrl]);

  // S8 — sync neighbourhood to URL (?hood=<id>) without reloading
  useEffect(() => {
    const url = new URL(window.location.href);
    if (neighbourhoodId) url.searchParams.set('hood', neighbourhoodId);
    else                 url.searchParams.delete('hood');
    window.history.replaceState({}, '', url.toString());
  }, [neighbourhoodId]);

  // S11 — sync terrace filter to URL (?terrace=1)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (terraceOnly) url.searchParams.set('terrace', '1');
    else             url.searchParams.delete('terrace');
    window.history.replaceState({}, '', url.toString());
  }, [terraceOnly]);

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
          <span className="header-title">Sunny {city.name}</span>
        </div>
        <div className="header-controls">
          {/* S28 — multi-city radar dropdown */}
          <CityDropdown
            city={city}
            cities={cities}
            setCityId={setCityId}
            activeVenues={rawVenues}
            date={date}
          />
          <DatePicker date={dateStr} onChange={setDateStr} />
        </div>
      </header>

      {/* S3 — Best window banner */}
      <BestWindowBanner window={bestWindow} />

      {/* S25 — Sunset countdown banner */}
      <SunsetBanner dateStr={dateStr} cityCentre={city.center} />

      <div className="map-wrap">
        <Map
          venues={filteredVenues}
          shadows={shadows}
          onVenueClick={handleVenueClick}
          onBoundsChange={handleBounds}
          weatherConfidence={weatherConfidence}
          fitBboxTarget={neighbourhood?.bbox ?? null}
          city={city}
        />

        <div className="slider-overlay">
          <TimeSlider minutes={minutes} onChange={setMinutes} date={date} cityCentre={city.center} />
        </div>

        <div className="filter-overlay">
          <FilterBar
            sunnyCount={sunnyCount}
            totalCount={filteredVenues.length}
            sunnyOnly={sunnyOnly}
            onToggle={() => setSunnyOnly(o => !o)}
            activeFilters={filters}
            onFilterChange={toggleFilter}
            weatherConfidence={weatherConfidence}
            favouritesOnly={favouritesOnly}
            onFavouritesToggle={() => setFavouritesOnly(o => !o)}
            favouriteCount={favouriteIds.size}
            neighbourhoodId={neighbourhoodId}
            onNeighbourhoodChange={setNeighbourhoodId}
            cityId={city.id}
            terraceOnly={terraceOnly}
            onTerraceToggle={() => setTerraceOnly(o => !o)}
            terraceCount={terraceCount}
            morningSunOnly={morningSunOnly}
            onMorningSunToggle={() => setMorningSunOnly(o => !o)}
          />
          {loading && <div className="status-pill">Loading venues…</div>}
          {error   && <div className="status-pill status-pill--error">⚠ {error}</div>}
        </div>

        {/* S24 — hidden gem + sunny venue list (bottom-left, collapsible) */}
        <VenueList
          venues={filteredVenues}
          favouriteIds={favouriteIds}
          onVenueClick={handleVenueClick}
          onToggleFavourite={toggleFavourite}
        />

        {/* S13 — dev-only sun debug overlay (DEV mode or ?debug=1) */}
        {debugMode && (
          <SunDebugOverlay
            sunPosition={sunPosition}
            date={date}
            sunnyCount={sunnyCount}
            totalCount={filteredVenues.length}
          />
        )}

        {selected && (
          <VenuePopup
            venue={selected}
            dateStr={dateStr}
            minutes={minutes}
            buildings={buildings}
            onClose={handleClose}
            isFavourite={isFavourite(selected.id)}
            onToggleFavourite={toggleFavourite}
          />
        )}
      </div>
    </div>
  );
}
