import { fetchWithTimeout, num } from './http';
import { parseSpecies } from '@/data/territoriesData';
import type { Territory, Occurrence, FeedSource, SpeciesObservations } from '@/types/environmental';

export type { SpeciesObservations };

/**
 * FAUNA — biodiversity observations. 100% real data, two datasets:
 *
 *   🌍 GBIF          — global occurrence backbone (CORS-open, verified)
 *   🌿 iNaturalist   — recent community field observations incl. photos
 *                      (api.inaturalist.org, CORS-open, verified)
 *
 * Movebank collar/event streams require institutional credentials and are
 * therefore NOT used: no collar telemetry is simulated anywhere. When a
 * dataset is unreachable the caller receives source 'UNAVAILABLE' and the
 * UI shows an explicit no-data state.
 */

/* ------------------------------ helpers -------------------------------- */

/** Keep only records inside the focused territory bbox (map dot scope). */
function inBbox(lat: number, lon: number, bbox: [number, number, number, number]): boolean {
  const [w, s, e, n] = bbox;
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= s && lat <= n && lon >= w && lon <= e;
}

const taxonKeyCache = new Map<string, number | null>();

async function matchTaxonKey(latin: string): Promise<number | null> {
  if (taxonKeyCache.has(latin)) return taxonKeyCache.get(latin)!;
  try {
    const res = await fetchWithTimeout(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(latin)}`, 7000);
    const json = await res.json();
    const key = json?.usageKey ? num(json.usageKey, Number.NaN) : Number.NaN;
    const out = Number.isFinite(key) ? key : null;
    taxonKeyCache.set(latin, out);
    return out;
  } catch {
    taxonKeyCache.set(latin, null);
    return null;
  }
}

/* ------------------------------ 🌍 GBIF -------------------------------- */

export async function fetchSpeciesObservations(territory: Territory): Promise<SpeciesObservations[]> {
  const speciesList = territory.species.map(parseSpecies);
  const global = Boolean(territory.global);
  const results = await Promise.all(
    speciesList.map(async ({ latin, commonName }): Promise<SpeciesObservations> => {
      if (global) return { species: latin, commonName, dataset: 'LIVE:GBIF', items: [], source: 'UNAVAILABLE' };
      try {
        const key = await matchTaxonKey(latin);
        if (!key) throw new Error('no taxon match');
        const url =
          `https://api.gbif.org/v1/occurrence/search?taxon_key=${key}` +
          `&country=${territory.gbifCountry}&hasCoordinate=true&limit=30`;
        const res = await fetchWithTimeout(url, 8000);
        const json = await res.json();
        const items: Occurrence[] = (json?.results ?? [])
          .filter((r: Record<string, unknown>) => r.decimalLatitude && r.decimalLongitude)
          .map((r: Record<string, unknown>) => ({
            species: latin,
            lat: Number(r.decimalLatitude),
            lon: Number(r.decimalLongitude),
            date: String(r.eventDate ?? '').slice(0, 10) || 'date pending',
            source: `GBIF:${String(r.basisOfRecord ?? 'OBS').replace('_OBSERVATION', '')}`,
          }))
          .filter((o: Occurrence) => inBbox(o.lat, o.lon, territory.bbox))
          .slice(0, 8);
        if (items.length === 0) throw new Error('no geo-referenced records');
        return { species: latin, commonName, dataset: 'LIVE:GBIF', items, source: 'LIVE:GBIF' };
      } catch {
        return { species: latin, commonName, dataset: 'LIVE:GBIF', items: [], source: 'UNAVAILABLE' };
      }
    }),
  );
  return results;
}

/* --------------------------- 🌿 iNaturalist ----------------------------- */

export async function fetchInatSpeciesObservations(territory: Territory): Promise<SpeciesObservations[]> {
  const [lat, lon] = territory.mapCenter;
  const speciesList = territory.species.map(parseSpecies);
  const global = Boolean(territory.global);
  const results = await Promise.all(
    speciesList.map(async ({ latin, commonName }): Promise<SpeciesObservations> => {
      if (global) return { species: latin, commonName, dataset: 'LIVE:INATURALIST', items: [], source: 'UNAVAILABLE' };
      try {
        const url =
          `https://api.inaturalist.org/v1/observations?taxon_name=${encodeURIComponent(latin)}` +
          `&lat=${lat}&lng=${lon}&radius=300&per_page=16&order_by=observed_on&geojson=true`;
        const res = await fetchWithTimeout(url, 9000);
        const json = (await res.json()) as { results?: Record<string, unknown>[] } | null;
        const items: Occurrence[] = (json?.results ?? [])
          .map((r: Record<string, unknown>) => {
            const geo = r.geojson as { coordinates?: [number, number] } | undefined;
            const coord = geo?.coordinates; // [lon, lat]
            if (!coord) return null;
            const when = String(r.observed_at ?? r.time_observed_at ?? '').slice(0, 10) || 'date pending';
            return {
              species: latin,
              lat: coord[1],
              lon: coord[0],
              date: when,
              source: `INAT:${String(r.quality_grade ?? 'casual')}`,
            } as Occurrence;
          })
          .filter((o): o is Occurrence => o !== null && o !== undefined)
          .filter((o: Occurrence) => inBbox(o.lat, o.lon, territory.bbox))
          .slice(0, 6);
        if (items.length === 0) throw new Error('no georeferenced iNat records');
        return { species: latin, commonName, dataset: 'LIVE:INATURALIST', items, source: 'LIVE:INATURALIST' };
      } catch {
        return { species: latin, commonName, dataset: 'LIVE:INATURALIST', items: [], source: 'UNAVAILABLE' };
      }
    }),
  );
  return results;
}

/* ---------------------- country biodiversity window --------------------- */

export async function fetchOccurrences(territory: Territory): Promise<{ items: Occurrence[]; source: FeedSource }> {
  const global = Boolean(territory.global);
  // Worldwide window: georeferenced GBIF records observed in the last 30 days
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const until = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const url = global
    ? `https://api.gbif.org/v1/occurrence/search?hasCoordinate=true&limit=60&eventDate=${since},${until}`
    : `https://api.gbif.org/v1/occurrence/search?country=${territory.gbifCountry}&hasCoordinate=true&limit=25`;
  try {
    const res = await fetchWithTimeout(url, 9000);
    const json = await res.json();
    const results: Occurrence[] = (json?.results ?? [])
      .filter((r: Record<string, unknown>) => r.species && r.decimalLatitude && r.decimalLongitude)
      .map((r: Record<string, unknown>, i: number) => ({
        species: String(r.species),
        lat: Number(r.decimalLatitude),
        lon: Number(r.decimalLongitude),
        date: String(r.eventDate ?? r.dateIdentified ?? '').slice(0, 10) || 'recent',
        source: `GBIF:${String(r.datasetKey ?? 'FIELD').slice(0, 8).toUpperCase()}#${i}`,
      }))
      .slice(0, global ? 20 : 12);
    if (results.length < 3) throw new Error('thin GBIF window');
    return { items: results, source: 'LIVE:GBIF' };
  } catch {
    return { items: [], source: 'UNAVAILABLE' };
  }
}
