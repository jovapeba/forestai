import { fetchWithTimeout, num } from './http';
import type { Territory, FeedSource, UsgsDailyGage, UsgsDailyValue } from '@/types/environmental';

/**
 * FLUVIA — USGS daily streamflow via waterdata.dev.
 *
 * waterdata.dev republishes the USGS Water Data APIs (OGC) as clean JSON.
 * Both datasets are public domain (US Government work), refreshed daily:
 *
 *   • stream-gages     — every USGS gage that reported a daily mean
 *                        discharge in the last 400 days (coords, drainage
 *                        area, hydrologic unit) → /v1/stream-gages/table/{region}.json
 *   • streamflow-daily — daily mean discharge per gage, with provisional /
 *                        estimated / ice flags → /v1/streamflow-daily/discharge/{site_id}.json
 *
 * CORS-open (verified). Attribution required:
 * "Stream gage information courtesy of the U.S. Geological Survey."
 */

const CFS_TO_CMS = 0.0283168;

/** Regions (state partitions) fetched per territory. */
const USGS_REGIONS: Record<string, string[]> = {
  US: ['us-az', 'us-nv', 'us-ca'], // Colorado Basin focus states
  ALL: ['us-az', 'us-nv', 'us-ca'],
};

const MIN_DRAINAGE_MI2 = 1000; // major-river gages only
const MAX_GAGES = 6;

export async function fetchUsgsDailyGages(
  territory: Territory,
): Promise<{ items: UsgsDailyGage[]; source: FeedSource }> {
  const regions = USGS_REGIONS[territory.code];
  if (!regions) return { items: [], source: 'UNAVAILABLE' };
  const isDev = ((import.meta as unknown as { env?: Record<string, unknown> }).env ?? {}).DEV;
  void isDev; // CORS-open: browser-direct works; kept for symmetry

  const [w, s, e, n] = territory.bbox;
  const catalogs = await Promise.all(
    regions.map(async (region) => {
      try {
        const res = await fetchWithTimeout(`https://api.waterdata.dev/v1/stream-gages/table/${region}.json`, 12000);
        const j = await res.json();
        return (j?.rows ?? []) as Record<string, unknown>[];
      } catch {
        return [] as Record<string, unknown>[];
      }
    }),
  );

  const picked = catalogs
    .flat()
    .filter((r) => String(r.site_type_code ?? '') === 'ST') // streams (not canals/ditches)
    .filter((r) => num(r.drainage_area, 0) >= MIN_DRAINAGE_MI2)
    .filter((r) => {
      const lat = num(r.latitude, Number.NaN);
      const lon = num(r.longitude, Number.NaN);
      return (
        Number.isFinite(lat) && Number.isFinite(lon) &&
        lat >= s && lat <= n && lon >= w && lon <= e
      );
    })
    .sort((a, b) => num(b.drainage_area, 0) - num(a.drainage_area, 0))
    .slice(0, MAX_GAGES);

  if (picked.length === 0) return { items: [], source: 'UNAVAILABLE' };

  // One daily-discharge series per selected gage (real observed flow)
  const gages = await Promise.all(
    picked.map(async (r): Promise<UsgsDailyGage | null> => {
      const siteId = String(r.site_id ?? '');
      const siteNumber = String(r.site_number ?? '');
      if (!siteId || !siteNumber) return null;
      try {
        const res = await fetchWithTimeout(`https://api.waterdata.dev/v1/streamflow-daily/discharge/${siteId}.json`, 12000);
        const j = await res.json();
        const rows = (j?.data ?? []) as Record<string, unknown>[];
        if (rows.length === 0) return null;
        const tail = rows.slice(-30);
        const series: UsgsDailyValue[] = tail.map((row) => ({
          date: String(row.date ?? ''),
          cfs: num(row.value, Number.NaN),
          cms: Number((num(row.value, Number.NaN) * CFS_TO_CMS).toFixed(1)),
          provisional: row.provisional === true,
          estimated: row.estimated === true,
          ice: row.ice === true,
        })).filter((v) => Number.isFinite(v.cfs));
        if (series.length === 0) return null;
        return {
          siteId,
          siteNumber,
          name: String(r.name ?? siteNumber),
          lat: num(r.latitude, Number.NaN),
          lon: num(r.longitude, Number.NaN),
          drainageAreaMi2: num(r.drainage_area, 0),
          state: r.state ? String(r.state) : undefined,
          dailyEnd: String(r.daily_end ?? series[series.length - 1].date),
          series,
        };
      } catch {
        return null;
      }
    }),
  );
  const finalGages = gages.filter((g): g is UsgsDailyGage => g !== null);
  return { items: finalGages, source: finalGages.length > 0 ? 'LIVE:USGS' : 'UNAVAILABLE' };
}
