import { fetchWithTimeout, num } from './http';
import type { Territory, HydroPoint, HydrographPoint, FeedSource } from '@/types/environmental';

/**
 * FLUVIA — Copernicus GloFAS river discharge via the Open-Meteo Flood
 * API. GloFAS is global modelled discharge (m³/s), not an observed gauge —
 * it is REAL model output from the Copernicus Emergency Management Service
 * and is always labelled as modelled. No simulated fallback exists: if the
 * request fails the source is 'UNAVAILABLE' and the UI shows a no-data state.
 */
export interface FloodBundle {
  points: HydrographPoint[];
  source: FeedSource;
  stationId: string;
}

export async function fetchRiverDischarge(territory: Territory, stationIdx = 0): Promise<FloodBundle> {
  const point: HydroPoint = territory.hydroPoints[stationIdx] ?? territory.hydroPoints[0];
  const url =
    `https://flood-api.open-meteo.com/v1/flood?latitude=${point.lat}&longitude=${point.lon}` +
    `&daily=river_discharge,river_discharge_mean,river_discharge_max,river_discharge_min&forecast_days=7`;
  try {
    const res = await fetchWithTimeout(url);
    const json = await res.json();
    const d = json?.daily;
    if (!d?.time) throw new Error('empty daily block');
    const points: HydrographPoint[] = d.time.map((date: string, i: number) => {
      const dt = new Date(date + 'T00:00:00Z');
      return {
        date,
        label: dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }),
        discharge: Math.round(num(d.river_discharge?.[i], Number.NaN)),
        mean: Math.round(num(d.river_discharge_mean?.[i], Number.NaN)),
        max: Math.round(num(d.river_discharge_max?.[i], Number.NaN)),
        min: Math.round(num(d.river_discharge_min?.[i], Number.NaN)),
      };
    });
    if (points.length === 0 || !Number.isFinite(points[0].discharge)) throw new Error('no valid discharge rows');
    return { points, source: 'LIVE:GLOFAS', stationId: point.id };
  } catch {
    return { points: [], source: 'UNAVAILABLE', stationId: point.id };
  }
}
