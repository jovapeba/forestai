import { fetchWithTimeout } from './http';
import type { RainRadar } from '@/types/environmental';

/**
 * RainViewer public weather-maps API — global precipitation radar mosaic,
 * free, no key, CORS-open (verified). Returns the latest radar frame path;
 * tiles are served from tilecache.rainviewer.com (no CORS needed for <img>).
 *
 * This is REAL radar reflectivity — rain and thunderstorm cells as seen by
 * the global radar network, refreshed every ~10 minutes.
 */
export async function fetchRainRadar(): Promise<RainRadar> {
  try {
    const res = await fetchWithTimeout('https://api.rainviewer.com/public/weather-maps.json', 9000);
    const j = await res.json();
    const past = j?.radar?.past ?? [];
    const last = past[past.length - 1];
    if (!last?.path || !j?.host) throw new Error('no radar frames');
    return { framePath: `${j.host}${last.path}`, frameTime: last.time, source: 'LIVE:RAINVIEWER' };
  } catch {
    return { framePath: null, frameTime: null, source: 'UNAVAILABLE' };
  }
}
