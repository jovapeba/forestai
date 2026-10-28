import { fetchWithTimeout, num } from './http';
import type { Territory, FeedSource } from '@/types/environmental';

/**
 * IGNIS — US wildland fire incidents & perimeters via wildfiredata.dev
 * (NIFC/WFIGS-derived, hourly, public-domain US Government work, CORS-open).
 *
 *   • fire-incidents  — current wildland fire incidents (name, acres,
 *                       percent contained, cause, county) → /table/all.json
 *   • fire-perimeters — current fire perimeters (GeoJSON polygons, by acres)
 *
 * Attribution: wildfire incident data derived from NIFC/WFIGS reporting.
 */

export interface FireIncident {
  id: string;
  name: string;
  type: string;              // WF wildfire · RX prescribed · CX complex
  lat: number;
  lon: number;
  acres: number;
  percentContained: number | null;
  state: string;             // region id, e.g. us-az
  county?: string;
  discovered: string;
  cause?: string;
  source: FeedSource;
}

export interface FirePerimeter {
  id: string;
  name: string;
  acres: number;
  percentContained: number | null;
  geometry: unknown;         // GeoJSON MultiPolygon geometry
  source: FeedSource;
}

/* Session cache — the incidents file is ~400 KB and identical for 1 h. */
let incidentsCache: { items: FireIncident[]; fetchedAt: number } | null = null;
let perimetersCache: { items: FirePerimeter[]; fetchedAt: number } | null = null;
const CACHE_MS = 30 * 60_000;

export async function fetchFireIncidents(
  territory: Territory,
): Promise<{ items: FireIncident[]; source: FeedSource }> {
  if (!(territory.code === 'US' || territory.global)) return { items: [], source: 'NOT-APPLICABLE' };
  if (incidentsCache && Date.now() - incidentsCache.fetchedAt < CACHE_MS) {
    return { items: incidentsCache.items, source: 'LIVE:US-FIRE-INCIDENTS' };
  }
  try {
    const res = await fetchWithTimeout('https://api.wildfiredata.dev/v1/fire-incidents/table/all.json', 15000);
    const j = await res.json();
    const rows = (j?.rows ?? []) as Record<string, unknown>[];
    const items: FireIncident[] = rows
      .map((r) => ({
        id: String(r.unique_fire_id ?? r.irwin_id ?? ''),
        name: String(r.name ?? 'Unnamed incident'),
        type: String(r.type ?? ''),
        lat: num(r.latitude, Number.NaN),
        lon: num(r.longitude, Number.NaN),
        acres: num(r.acres, 0),
        percentContained: r.percent_contained == null ? null : Math.round(num(r.percent_contained, 0)),
        state: String(r.state ?? ''),
        county: r.county ? String(r.county) : undefined,
        discovered: String(r.discovered ?? '').slice(0, 10),
        cause: r.cause ? String(r.cause) : undefined,
        source: 'LIVE:US-FIRE-INCIDENTS' as FeedSource,
      }))
      .filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lon))
      .sort((a, b) => b.acres - a.acres)
      .slice(0, 100);
    incidentsCache = { items, fetchedAt: Date.now() };
    return { items, source: 'LIVE:US-FIRE-INCIDENTS' };
  } catch {
    return { items: [], source: 'UNAVAILABLE' };
  }
}

export async function fetchFirePerimeters(
  territory: Territory,
): Promise<{ items: FirePerimeter[]; source: FeedSource }> {
  if (!(territory.code === 'US' || territory.global)) return { items: [], source: 'NOT-APPLICABLE' };
  if (perimetersCache && Date.now() - perimetersCache.fetchedAt < CACHE_MS) {
    return { items: perimetersCache.items, source: 'LIVE:US-FIRE-PERIMETERS' };
  }
  try {
    // 1) latest snapshot of current perimeters
    const idxRes = await fetchWithTimeout('https://api.wildfiredata.dev/v1/fire-perimeters/snapshots/index.json', 12000);
    const idx = await idxRes.json();
    const snapshots = (idx?.snapshots ?? []).filter((sn: Record<string, unknown>) => sn.retained !== false);
    if (snapshots.length === 0) throw new Error('no snapshots');
    const latest = snapshots[snapshots.length - 1];
    const snapRes = await fetchWithTimeout(`https://api.wildfiredata.dev/v1/fire-perimeters/${latest.path}`, 12000);
    const snap = await snapRes.json();
    const perims = (snap?.perimeters ?? []) as Record<string, unknown>[];
    // 2) fetch the geometry of the largest fires
    const top = [...perims]
      .sort((a, b) => num(b.gis_acres, 0) - num(a.gis_acres, 0))
      .slice(0, 6);
    const items: FirePerimeter[] = (
      await Promise.all(
        top.map(async (p): Promise<FirePerimeter | null> => {
          try {
            const res = await fetchWithTimeout(`https://api.wildfiredata.dev/v1/fire-perimeters/${p.path}`, 15000);
            const geo = await res.json();
            if (!geo?.geometry) return null;
            return {
              id: String(p.irwin_id ?? p.path),
              name: String(p.incident_name ?? 'Fire perimeter'),
              acres: num(p.gis_acres, 0),
              percentContained: p.percent_contained == null ? null : Math.round(num(p.percent_contained, 0)),
              geometry: geo.geometry,
              source: 'LIVE:US-FIRE-PERIMETERS' as FeedSource,
            };
          } catch {
            return null;
          }
        }),
      )
    ).filter((x): x is FirePerimeter => x !== null);
    perimetersCache = { items, fetchedAt: Date.now() };
    return { items, source: 'LIVE:US-FIRE-PERIMETERS' };
  } catch {
    return { items: [], source: 'UNAVAILABLE' };
  }
}
