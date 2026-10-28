import { fetchWithTimeout } from './http';
import type { FeedSource } from '@/types/environmental';

/**
 * CANOPY — global air-quality city grid via the Open-Meteo CAMS air-quality
 * API. Unrestricted, no key, CORS-open. ALL cities come from ONE batched
 * request (comma-separated coordinates) — real PM2.5 / PM10 / NO₂ / O₃ and
 * the European AQI at each city's true location. Values are model-assimilated
 * CAMS estimates at city centres, clearly labelled as such (not ground-station
 * measurements; those exist per-territory via OpenAQ with a free key).
 */

export interface CityAqRow {
  city: string;
  region: string;
  lat: number;
  lon: number;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  euAqi: number | null;
  time: string;
  source: FeedSource;
}

export interface CityAqBundle {
  rows: CityAqRow[];
  source: FeedSource;
}

/** Real city-centre coordinates (OpenStreetMap canonical points). */
const CITIES: { name: string; region: string; lat: number; lon: number }[] = [
  // Europe
  { name: 'London', region: 'GB', lat: 51.5074, lon: -0.1278 },
  { name: 'Paris', region: 'FR', lat: 48.8566, lon: 2.3522 },
  { name: 'Berlin', region: 'DE', lat: 52.52, lon: 13.405 },
  { name: 'Madrid', region: 'ES', lat: 40.4168, lon: -3.7038 },
  { name: 'Rome', region: 'IT', lat: 41.9028, lon: 12.4964 },
  { name: 'Warsaw', region: 'PL', lat: 52.2297, lon: 21.0122 },
  { name: 'Ljubljana', region: 'SI', lat: 46.0569, lon: 14.5058 },
  { name: 'Kyiv', region: 'UA', lat: 50.4501, lon: 30.5234 },
  { name: 'Istanbul', region: 'TR', lat: 41.0082, lon: 28.9784 },
  { name: 'Stockholm', region: 'SE', lat: 59.3293, lon: 18.0686 },
  { name: 'Athens', region: 'GR', lat: 37.9838, lon: 23.7275 },
  // Asia
  { name: 'Delhi', region: 'IN', lat: 28.6139, lon: 77.209 },
  { name: 'Beijing', region: 'CN', lat: 39.9042, lon: 116.4074 },
  { name: 'Shanghai', region: 'CN', lat: 31.2304, lon: 121.4737 },
  { name: 'Tokyo', region: 'JP', lat: 35.6762, lon: 139.6503 },
  { name: 'Seoul', region: 'KR', lat: 37.5665, lon: 126.978 },
  { name: 'Bangkok', region: 'TH', lat: 13.7563, lon: 100.5018 },
  { name: 'Jakarta', region: 'ID', lat: -6.2088, lon: 106.8456 },
  { name: 'Manila', region: 'PH', lat: 14.5995, lon: 120.9842 },
  { name: 'Dhaka', region: 'BD', lat: 23.8103, lon: 90.4125 },
  { name: 'Karachi', region: 'PK', lat: 24.8607, lon: 67.0011 },
  // Africa
  { name: 'Cairo', region: 'EG', lat: 30.0444, lon: 31.2357 },
  { name: 'Lagos', region: 'NG', lat: 6.5244, lon: 3.3792 },
  { name: 'Nairobi', region: 'KE', lat: -1.2921, lon: 36.8219 },
  { name: 'Johannesburg', region: 'ZA', lat: -26.2041, lon: 28.0473 },
  { name: 'Addis Ababa', region: 'ET', lat: 9.03, lon: 38.74 },
  { name: 'Casablanca', region: 'MA', lat: 33.5731, lon: -7.5898 },
  // Americas
  { name: 'New York', region: 'US', lat: 40.7128, lon: -74.006 },
  { name: 'Los Angeles', region: 'US', lat: 34.0522, lon: -118.2437 },
  { name: 'Mexico City', region: 'MX', lat: 19.4326, lon: -99.1332 },
  { name: 'São Paulo', region: 'BR', lat: -23.5505, lon: -46.6333 },
  { name: 'Santiago', region: 'CL', lat: -33.4489, lon: -70.6693 },
  // Oceania
  { name: 'Sydney', region: 'AU', lat: -33.8688, lon: 151.2093 },
];

/** European AQI band → hex (EEA scale, 0-20 good … >100 extremely poor). */
export const euAqiColor = (aqi: number | null): string => {
  if (aqi == null || !Number.isFinite(aqi)) return '#64748b';
  if (aqi <= 20) return '#4ade80';
  if (aqi <= 40) return '#a3e635';
  if (aqi <= 60) return '#fde047';
  if (aqi <= 80) return '#fb923c';
  if (aqi <= 100) return '#ef4444';
  return '#a855f7';
};

/* Session cache — one ~10 KB request per 20 min. */
let cache: { bundle: CityAqBundle; fetchedAt: number } | null = null;
const CACHE_MS = 20 * 60_000;

export async function fetchCityAqGrid(): Promise<CityAqBundle> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) return cache.bundle;
  const empty: CityAqBundle = { rows: [], source: 'UNAVAILABLE' };
  try {
    const lats = CITIES.map((c) => c.lat).join(',');
    const lons = CITIES.map((c) => c.lon).join(',');
    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}` +
      `&hourly=pm2_5,pm10,nitrogen_dioxide,ozone,european_aqi&forecast_days=2&past_days=1`;
    const res = await fetchWithTimeout(url, 15000);
    const json = (await res.json()) as
      | { hourly?: Record<string, unknown>; time?: string[] }
      | Array<{ hourly?: Record<string, unknown>; time?: string[] }>;
    // multi-location returns an array (or a single object for one location)
    const arr = Array.isArray(json) ? json : [json];
    const now = Date.now();
    const rows: CityAqRow[] = CITIES.map((c, i): CityAqRow | null => {
      const a = arr[i];
      if (!a?.hourly) return null;
      // Multi-location responses nest the time axis INSIDE hourly
      const times = ((a.hourly.time ?? []) as string[]);
      // latest slot strictly <= now (real present-time read, not a forecast)
      let idx = times.findIndex((t) => new Date(`${t}:00Z`).getTime() > now);
      if (idx === -1) idx = times.length;
      idx = Math.min(Math.max(idx - 1, 0), times.length - 1);
      const pick = (k: string): number | null => {
        const series = (a.hourly?.[k] ?? []) as (number | null)[];
        const v = series[idx];
        return typeof v === 'number' && Number.isFinite(v) ? v : null;
      };
      const pm25 = pick('pm2_5');
      if (pm25 == null) return null;
      return {
        city: c.name,
        region: c.region,
        lat: c.lat,
        lon: c.lon,
        pm25,
        pm10: pick('pm10'),
        no2: pick('nitrogen_dioxide'),
        o3: pick('ozone'),
        euAqi: pick('european_aqi'),
        time: times[idx] ?? '',
        source: 'LIVE:CAMS-AQ-GRID',
      };
    }).filter((r): r is CityAqRow => r !== null);
    if (rows.length === 0) throw new Error('no rows');
    const bundle = { rows, source: 'LIVE:CAMS-AQ-GRID' as FeedSource };
    cache = { bundle, fetchedAt: Date.now() };
    return bundle;
  } catch {
    cache = { bundle: empty, fetchedAt: Date.now() };
    return empty;
  }
}
