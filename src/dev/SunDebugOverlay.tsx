// S13 — dev-only sun-path debug overlay. Two pieces:
//   1) A directional line pinned to the map centre, pointing toward the sun
//      (CSS rotation derived from SunCalc azimuth)
//   2) A bottom-right HUD with local time, azimuth°, altitude°, and the
//      number of currently in-sun venues.
//
// Controls: keyboard shortcut `d` toggles the overlay (only when flag is on).
//
// Per-venue arrows are deliberately out of scope for v1 — they require
// access to the map's projection function (lat/lng → pixel coords) which
// means refactoring Map.tsx to expose it. Future work.

import { useEffect, useState } from 'react';
import type { SunPosition } from '../lib/sunCalc';

interface Props {
  sunPosition: SunPosition;
  date: Date;
  sunnyCount: number;
  totalCount: number;
}

// SunCalc azimuth is radians from south, clockwise. CSS `rotate(0deg)` points
// up (= north). Bearing-from-north = azimuth + 180°. Convert to degrees.
function azimuthToBearingDeg(azimuthRad: number): number {
  const deg = (azimuthRad * 180) / Math.PI + 180;
  return ((deg % 360) + 360) % 360;
}

export default function SunDebugOverlay({ sunPosition, date, sunnyCount, totalCount }: Props) {
  const [shown, setShown] = useState(true);

  // Keyboard shortcut: `d` toggles. Skip when typing in an input/textarea.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === 'd' || e.key === 'D') setShown((s) => !s);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!shown) return null;

  const bearing = azimuthToBearingDeg(sunPosition.azimuth);
  const altitudeDeg = (sunPosition.altitude * 180) / Math.PI;
  const azimuthDeg = (sunPosition.azimuth * 180) / Math.PI;

  return (
    <>
      {/* Centre directional line. Vertical line + arrow tip at the top, rotated
          by `bearing` deg so it points from the centre toward the sun. */}
      <div
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: `translate(-50%, -100%) rotate(${bearing}deg)`,
          transformOrigin: '50% 100%',
          pointerEvents: 'none',
          zIndex: 999,
          opacity: sunPosition.isAboveHorizon ? 0.85 : 0.35,
          transition: 'transform 200ms linear, opacity 200ms linear',
        }}
        aria-hidden="true"
      >
        <svg width="20" height="160" viewBox="0 0 20 160" style={{ display: 'block' }}>
          <line x1="10" y1="160" x2="10" y2="20" stroke="#FFD700" strokeWidth="3" strokeLinecap="round" />
          <polygon points="10,0 4,18 16,18" fill="#FFD700" />
          <circle cx="10" cy="160" r="5" fill="#FFD700" />
        </svg>
      </div>

      {/* HUD */}
      <div
        style={{
          position: 'absolute',
          right: '12px', bottom: '12px',
          background: 'rgba(20, 20, 20, 0.85)',
          color: '#FFD700',
          padding: '0.6rem 0.8rem',
          borderRadius: '8px',
          font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
          minWidth: '180px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          zIndex: 1000,
          pointerEvents: 'auto',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between' }}>
          <span>☀ Sun debug</span>
          <button
            onClick={() => setShown(false)}
            title="Hide (press d to toggle)"
            style={{
              background: 'transparent', border: 'none', color: '#FFD700',
              cursor: 'pointer', padding: 0, font: 'inherit',
            }}
          >
            ✕
          </button>
        </div>
        <div>time:     {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        <div>azimuth:  {azimuthDeg.toFixed(1)}° (S→W); bearing {bearing.toFixed(1)}° (from N)</div>
        <div>altitude: {altitudeDeg.toFixed(1)}° {sunPosition.isAboveHorizon ? '' : '(below horizon)'}</div>
        <div>sunny:    {sunnyCount} / {totalCount} visible</div>
        <div style={{ marginTop: '0.3rem', fontSize: '10px', opacity: 0.6 }}>press `d` to toggle</div>
      </div>
    </>
  );
}
