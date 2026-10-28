import { fetchWithTimeout, num } from './http';
import type { Territory, FeedSource } from '@/types/environmental';

/**
 * CANOPY/SENTRY context — US environmental indices, county level, all free:
 *
 *   • US Drought Monitor (weekly, via waterdata.dev drought-county) — share of
 *     county area in drought categories D0–D4
 *   • EPA daily AQI by county (via airdata.dev county-aqi-daily) — real daily
 *     AQI with category + defining pollutant
 *
 * Both are fetched for a fixed set of real focus counties near the US
 * territory's analysis points (dots sit at real county centroids). Range
 * requests keep responses tiny (tail of the CSV, never years of history).
 */

export interface UsIndexPoint {
  countyFips: string;      // e.g. us-county-04013
  countyName: string;
  lat: number;             // real county centroid (mapping anchor)
  lon: number;
  /** drought */
  d0?: number; d1?: number; d2?: number; d3?: number; d4?: number;
  droughtDate?: string;
  droughtClass?: 'NONE' | 'D0' | 'D1' | 'D2' | 'D3' | 'D4';
  /** aqi */
  aqi?: number;
  aqiCategory?: string;
  aqiPollutant?: string;
  aqiDate?: string;
}

/** Real focus counties with their geographic centroids. */
const FOCUS_COUNTIES: { fips: string; name: string; lat: number; lon: number }[] = [
  { fips: 'us-county-04005', name: 'Coconino, AZ', lat: 35.77, lon: -111.63 },
  { fips: 'us-county-04013', name: 'Maricopa, AZ', lat: 33.65, lon: -112.67 },
  { fips: 'us-county-04015', name: 'Mohave, AZ', lat: 35.35, lon: -113.63 },
  { fips: 'us-county-04027', name: 'Yuma, AZ', lat: 32.77, lon: -113.77 },
  { fips: 'us-county-32003', name: 'Clark, NV', lat: 36.16, lon: -115.13 },
  { fips: 'us-county-32031', name: 'Washoe, NV', lat: 39.63, lon: -119.82 },
  { fips: 'us-county-06029', name: 'Kern, CA', lat: 35.34, lon: -118.6 },
  { fips: 'us-county-06019', name: 'Fresno, CA', lat: 36.74, lon: -119.79 },
  { fips: 'us-county-06037', name: 'Los Angeles, CA', lat: 34.42, lon: -118.16 },
  { fips: 'us-county-06065', name: 'Riverside, CA', lat: 33.66, lon: -115.4 },
  { fips: 'us-county-06071', name: 'San Bernardino, CA', lat: 34.11, lon: -116.42 },
  { fips: 'us-county-06025', name: 'Imperial, CA', lat: 33.04, lon: -115.62 },
];

export async function fetchUsDrought(
  territory: Territory,
): Promise<{ items: UsIndexPoint[]; source: FeedSource }> {
  if (!(territory.code === 'US' || territory.global)) return { items: [], source: 'NOT-APPLICABLE' };
  const items = await Promise.all(
    FOCUS_COUNTIES.map(async (c): Promise<UsIndexPoint> => {
      const base: UsIndexPoint = { countyFips: c.fips, countyName: c.name, lat: c.lat, lon: c.lon, droughtClass: 'NONE' };
      try {
        const res = await fetchWithTimeout(
          `https://api.waterdata.dev/v1/drought-county/area/${c.fips}.json`,
          9000,
        );
        const j = await res.json();
        const rows = (j?.data ?? []) as Record<string, unknown>[];
        const last = rows[rows.length - 1];
        if (!last) return base;
        const d0 = num(last.d0, 0), d1 = num(last.d1, 0), d2 = num(last.d2, 0), d3 = num(last.d3, 0), d4 = num(last.d4, 0);
        const worst = d4 > 0 ? 'D4' : d3 > 0 ? 'D3' : d2 > 0 ? 'D2' : d1 > 0 ? 'D1' : d0 > 0 ? 'D0' : 'NONE';
        return { ...base, d0, d1, d2, d3, d4, droughtDate: String(last.date ?? ''), droughtClass: worst };
      } catch {
        return base;
      }
    }),
  );
  return { items, source: 'LIVE:US-DROUGHT-MONITOR' };
}

/** AQI CSV column order (verified): date,aqi,category,defining_parameter,defining_site,sites_reporting,validated */
const AQI_TAIL_BYTES = 60_000; // ≈ last 500 days of one row/day — plenty

function lastCsvRows(text: string, n = 2): string[] {
  const lines = text.trim().split('\n');
  // first line may be a partial row (range tail) — keep only complete lines
  const complete = lines.slice(1, -1).concat(lines[lines.length - 1]);
  return complete.slice(-n);
}

export async function fetchCountyAqi(
  territory: Territory,
): Promise<{ items: UsIndexPoint[]; source: FeedSource }> {
  if (!(territory.code === 'US' || territory.global)) return { items: [], source: 'NOT-APPLICABLE' };
  const items = await Promise.all(
    FOCUS_COUNTIES.map(async (c): Promise<UsIndexPoint> => {
      const base: UsIndexPoint = { countyFips: c.fips, countyName: c.name, lat: c.lat, lon: c.lon };
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 9000);
        const res = await fetch(`https://api.airdata.dev/v1/county-aqi-daily/aqi/${c.fips}.csv`, {
          headers: { Range: `bytes=-${AQI_TAIL_BYTES}` },
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));
        if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
        const tail = await res.text();
        const rows = lastCsvRows(tail).map((line) => line.split(','));
        const valid = rows.filter((cols) => cols.length >= 7 && /^\d{4}-\d{2}-\d{2}$/.test(cols[0]));
        const last = valid[valid.length - 1];
        if (!last) return base;
        return {
          ...base,
          aqi: num(last[1], Number.NaN),
          aqiCategory: last[2],
          aqiPollutant: last[3],
          aqiDate: last[0],
        };
      } catch {
        return base;
      }
    }),
  );
  const any = items.some((i) => i.aqi !== undefined);
  return { items, source: any ? 'LIVE:EPA-AQI' : 'UNAVAILABLE' };
}
