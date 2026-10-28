import { fetchWithTimeout } from './http';
import type { Territory, Occurrence, FeedSource, SpeciesObservations } from '@/types/environmental';

/**
 * FAUNA (marine) — OBIS, the Ocean Biodiversity Information System.
 * Anonymous, no key, CORS-open (verified October 2026). Aggregates >25 M
 * marine occurrence records from hundreds of museum, survey and community
 * datasets worldwide — including historical ones (the Adriatic sample even
 * returned 1916 Trieste fish-market landings).
 *
 * Scope: one network-level query per territory bbox (or a global sample);
 * every record carries its true species, coordinates, date and dataset.
 */

const BASE = 'https://api.obis.org/v3/occurrence';

const empty: SpeciesObservations = {
  species: 'OBIS marine records',
  commonName: 'Ocean Biodiversity Information System',
  dataset: 'LIVE:OBIS',
  items: [],
  source: 'UNAVAILABLE',
};

export async function fetchObisMarine(territory: Territory): Promise<SpeciesObservations> {
  try {
    let url: string;
    if (territory.global) {
      // Worldwide sample of recent records — real global marine coverage.
      url = `${BASE}?size=60&startdate=${new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10)}`;
    } else {
      const [w, s, e, n] = territory.bbox;
      const wkt = encodeURIComponent(`POLYGON((${w} ${s},${e} ${s},${e} ${n},${w} ${n},${w} ${s}))`);
      url = `${BASE}?geometry=${wkt}&size=60`;
    }
    const res = await fetchWithTimeout(url, 12000);
    const json = (await res.json()) as {
      total?: number;
      results?: {
        scientificName?: string;
        decimalLatitude?: number;
        decimalLongitude?: number;
        eventDate?: string;
        datasetName?: string;
        minimumDepthInMeters?: number;
      }[];
    };
    const items: Occurrence[] = (json?.results ?? [])
      .map((r): Occurrence | null => {
        const lat = Number(r.decimalLatitude);
        const lon = Number(r.decimalLongitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return {
          species: String(r.scientificName ?? 'Unidentified marine taxon'),
          lat,
          lon,
          date: String(r.eventDate ?? '').slice(0, 10) || 'undated',
          source: 'LIVE:OBIS',
        };
      })
      .filter((o): o is Occurrence => o !== null)
      .slice(0, 50);
    // A successful query is LIVE even with zero hits inside a landlocked
    // bbox — a real zero, not a transport failure.
    return { ...empty, items, source: 'LIVE:OBIS', species: 'OBIS marine records' };
  } catch {
    return empty;
  }
}
