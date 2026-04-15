import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Polygon } from 'geojson';
import type { VenueWithStatus } from '../lib/venueStatus';
import { statusColor } from '../lib/venueStatus';
import { AMSTERDAM_CENTER, DEFAULT_ZOOM, BASEMAP_STYLE } from '../constants/amsterdam';

const SHADOW_SOURCE   = 'shadows';
const SHADOW_LAYER    = 'shadow-fill';
const VENUE_SOURCE    = 'venues';
const VENUE_LAYER     = 'venue-circles';
const VENUE_PULSE     = 'venue-circles-pulse';
const VENUE_LAYER_HL  = 'venue-circles-hl';

interface Props {
  venues:    VenueWithStatus[];
  shadows:   FeatureCollection<Polygon>;
  onVenueClick: (v: VenueWithStatus) => void;
  onBoundsChange: (bounds: { north: number; south: number; east: number; west: number }) => void;
}

export default function Map({ venues, shadows, onVenueClick, onBoundsChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style:     BASEMAP_STYLE,
      center:    AMSTERDAM_CENTER,
      zoom:      DEFAULT_ZOOM,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    }), 'top-right');

    map.on('load', () => {
      // Shadow layer
      map.addSource(SHADOW_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id:     SHADOW_LAYER,
        type:   'fill',
        source: SHADOW_SOURCE,
        paint: {
          'fill-color':   '#1e3a5f',
          'fill-opacity': 0.45,
        },
      });

      // Venue circles
      map.addSource(VENUE_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      // Pulse halo for sunny venues — opacity animated via rAF below
      map.addLayer({
        id:     VENUE_PULSE,
        type:   'circle',
        source: VENUE_SOURCE,
        filter: ['==', ['get', 'status'], 'sunny'],
        paint: {
          'circle-radius':  ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 18],
          'circle-color':   '#FFD700',
          'circle-opacity': 0,
          'circle-blur':    1,
        },
      });

      map.addLayer({
        id:     VENUE_LAYER,
        type:   'circle',
        source: VENUE_SOURCE,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 5, 16, 9],
          'circle-color':  ['get', 'color'],
          'circle-stroke-color': '#111827',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.9,
        },
      });

      // Animate the pulse halo
      let rafId: number;
      const animate = () => {
        const t = (Date.now() % 2000) / 2000;
        const opacity = Math.sin(t * Math.PI) * 0.45;
        if (map.getLayer(VENUE_PULSE)) {
          map.setPaintProperty(VENUE_PULSE, 'circle-opacity', opacity);
        }
        rafId = requestAnimationFrame(animate);
      };
      rafId = requestAnimationFrame(animate);
      map.once('remove', () => cancelAnimationFrame(rafId));

      // Highlight ring on hover
      map.addLayer({
        id:     VENUE_LAYER_HL,
        type:   'circle',
        source: VENUE_SOURCE,
        filter: ['==', ['get', 'id'], ''],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 14],
          'circle-color':  'transparent',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });

      // Emit initial bounds
      const b = map.getBounds();
      onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
    });

    map.on('moveend', () => {
      const b = map.getBounds();
      onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
    });

    // Click handler
    map.on('click', VENUE_LAYER, (e) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const props = feat.properties as VenueWithStatus;
      onVenueClick(props);
      map.setFilter(VENUE_LAYER_HL, ['==', ['get', 'id'], props.id]);
    });

    // Cursor
    map.on('mouseenter', VENUE_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', VENUE_LAYER, () => { map.getCanvas().style.cursor = ''; });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Update shadows
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource(SHADOW_SOURCE) as maplibregl.GeoJSONSource | undefined;
    src?.setData(shadows);
  }, [shadows]);

  // Update venue markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource(VENUE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: 'FeatureCollection',
      features: venues.map((v) => ({
        type:       'Feature',
        geometry:   { type: 'Point', coordinates: [v.lng, v.lat] },
        properties: { ...v, color: statusColor(v.status) },
      })),
    });
  }, [venues]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
