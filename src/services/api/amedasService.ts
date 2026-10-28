import { fetchWithTimeout } from './http';
import type { Territory, FeedSource } from '@/types/environmental';

/**
 * FLUVIA/SENTRY support — JMA AMeDAS station observations (Japan).
 *
 * Two anonymous, CORS-open JMA endpoints:
 *   • `const/amedastable.json`  — all 1,286 AMeDAS stations with English
 *     names and precise [degree, minute] coordinates
 *   • `data/latest_time.txt`    — timestamp of the most recent 10-minute
 *     observation slot
 *   • `data/map/{yyyymmddHHMMSS}.json` — one observation frame for every
 *     station nationwide (temp °C, precipitation 10m/1h/3h/24h mm, wind,
 *     humidity, sunshine) with per-value quality flags [value, quality]
 *
 * Everything is official JMA measurement. No interpolation, no synthesis.
 */

export interface AmedasRow {
  id: string;
  name: string;
  lat: number;
  lon: number;
  tempC: number | null;
  rain24hMm: number | null;
  rain1hMm: number | null;
  windMs: number | null;
  humidity: number | null;
  time: string;
  source: FeedSource;
}

export interface AmedasBundle {
  rows: AmedasRow[];
  source: FeedSource;
  frameTime: string | null;
}

const TABLE_URL = 'https://www.jma.go.jp/bosai/amedas/const/amedastable.json';
const BASE = 'https://www.jma.go.jp/bosai/amedas/data';

/** [degree, minute] pair → decimal degrees (JMA table format). */
const dm = (pair: unknown): number | null => {
  if (!Array.isArray(pair) || pair.length !== 2) return null;
  const [d, m] = pair as [number, number];
  if (typeof d !== 'number' || typeof m !== 'number') return null;
  return Number((d + m / 60).toFixed(4));
};

/* Session cache — the nationwide frame is ~250 KB and refreshes every 10 min. */
let cache: { bundle: AmedasBundle; fetchedAt: number } | null = null;
const CACHE_MS = 8 * 60_000;

export async function fetchAmedas(territory: Territory): Promise<AmedasBundle> {
  // AMeDAS is a Japanese national network: applicable only to the Japan view.
  // In the global earth view (and any other country) it is NOT-APPLICABLE —
  // 1,286 nationwide markers would bury the world map.
  if (territory.code !== 'JP') {
    return { rows: [], source: 'NOT-APPLICABLE', frameTime: null };
  }
  const empty: AmedasBundle = { rows: [], source: 'UNAVAILABLE', frameTime: null };
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) return cache.bundle;
  try {
    const timeRes = await fetchWithTimeout(`${BASE}/latest_time.txt`, 8000);
    const time = String((await timeRes.text()).trim());
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(time)) throw new Error('bad latest_time');
    const stamp = time.slice(0, 10).replace(/-/g, '') + time.slice(11, 16).replace(':', '') + '00';
    const [tableRes, mapRes] = await Promise.all([
      fetchWithTimeout(TABLE_URL, 12000),
      fetchWithTimeout(`${BASE}/map/${stamp}.json`, 15000),
    ]);
    const table = (await tableRes.json()) as Record<string, Record<string, unknown>>;
    const frame = (await mapRes.json()) as Record<string, Record<string, unknown>>;
    const rows: AmedasRow[] = [];
    for (const [id, st] of Object.entries(table)) {
      const obs = frame[id];
      const lat = dm(st.lat);
      const lon = dm(st.lon);
      if (!obs || lat == null || lon == null) continue;
      const val = (k: string): number | null => {
        const pair = obs[k] as [number, number] | undefined;
        return Array.isArray(pair) && typeof pair[0] === 'number' ? pair[0] : null;
      };
      rows.push({
        id,
        name: String(st.enName ?? st.kjName ?? id),
        lat,
        lon,
        tempC: val('temp'),
        rain24hMm: val('precipitation24h'),
        rain1hMm: val('precipitation1h'),
        windMs: val('wind'),
        humidity: val('humidity'),
        time,
        source: 'LIVE:JMA-AMEDAS',
      });
    }
    if (rows.length === 0) throw new Error('no rows');
    const bundle = { rows, source: 'LIVE:JMA-AMEDAS' as FeedSource, frameTime: time };
    cache = { bundle, fetchedAt: Date.now() };
    return bundle;
  } catch {
    cache = { bundle: empty, fetchedAt: Date.now() };
    return empty;
  }
}
