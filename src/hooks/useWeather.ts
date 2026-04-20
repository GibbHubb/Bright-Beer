import { useEffect, useState } from 'react';

const API_URL = 'https://api.open-meteo.com/v1/forecast?latitude=52.37&longitude=4.9&hourly=cloud_cover,precipitation_probability&forecast_days=1&timezone=Europe/Amsterdam';
const CACHE_KEY = 'bright-beer-weather';
const CACHE_TTL = 3600000; // 1 hour

interface WeatherData {
  cloudCover: number[];    // hourly, 0–100
  precipProb: number[];    // hourly, 0–100
}

export type WeatherConfidence = 'clear' | 'cloudy' | 'rain';

export function useWeather(): WeatherData | null {
  const [data, setData] = useState<WeatherData | null>(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Date.now() - cached.ts < CACHE_TTL) return cached.data;
      }
    } catch { /* ignore */ }
    return null;
  });

  useEffect(() => {
    // If cache was valid, skip fetch
    if (data) return;

    let cancelled = false;
    fetch(API_URL)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const hourly = json?.hourly;
        if (!hourly) return;
        const result: WeatherData = {
          cloudCover: hourly.cloud_cover ?? [],
          precipProb: hourly.precipitation_probability ?? [],
        };
        setData(result);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: result }));
        } catch { /* ignore */ }
      })
      .catch(() => { /* graceful no-op */ });

    return () => { cancelled = true; };
  }, []);

  return data;
}

export function getConfidence(weather: WeatherData | null, hourIdx: number): WeatherConfidence | null {
  if (!weather) return null;
  const precip = weather.precipProb[hourIdx] ?? 0;
  const cloud = weather.cloudCover[hourIdx] ?? 0;
  if (precip >= 60) return 'rain';
  if (cloud >= 70) return 'cloudy';
  return 'clear';
}
