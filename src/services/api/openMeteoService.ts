import { fetchFirstReachable, fetchWithTimeout, num } from './http';
import { deriveFwi } from './hazard';
import type {
  Territory,
  FireHotspot,
  FireWeather,
  FireIndex,
  SoilPoint,
  AirQuality,
  FeedSource,
} from '@/types/environmental';

/**
 * IGNIS + CANOPY — Open-Meteo services. Global, no key, CORS-open.
 *
 * Every value here is REAL: live station/model weather, real model soil
 * moisture, real CAMS air quality, and real NASA FIRMS thermal detections.
 * If a request fails the caller receives source 'UNAVAILABLE' and the UI
 * renders an explicit no-data state — nothing is simulated.
 */

export interface WeatherBundle {
  weather: FireWeather | null;
  index: FireIndex | null;
}

export async function fetchFireWeather(territory: Territory): Promise<WeatherBundle> {
  const { fire } = territory.analysisPoints;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${fire[0]}&longitude=${fire[1]}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,weather_code&timezone=auto` +
    `&minutely_15=lightning_potential&forecast_minutely_15=32`;
  try {
    const res = await fetchWithTimeout(url);
    const json = await res.json();
    const c = json?.current ?? {};
    // lightning_potential (J/kg, 15-min CAMS-based model slots): the MAX over
    // the next ~8 hours marks genuine thunderstorm-charge potential
    const lp = (json?.minutely_15?.lightning_potential ?? []) as number[];
    const lightningMax = lp.length > 0 ? Math.max(...lp) : null;
    const weather: FireWeather = {
      temp: num(c.temperature_2m, Number.NaN),
      humidity: num(c.relative_humidity_2m, Number.NaN),
      wind: {
        speed: num(c.wind_speed_10m, Number.NaN),
        dir: num(c.wind_direction_10m, Number.NaN),
        gust: num(c.wind_gusts_10m, Number.NaN),
      },
      weatherCode: num(c.weather_code, 0),
      precipitation: num(c.precipitation, 0),
      lightningMax: lightningMax != null && Number.isFinite(lightningMax) ? Number(lightningMax.toFixed(0)) : null,
      source: 'LIVE:OPEN-METEO',
    };
    return { weather, index: deriveFwi(weather.temp, weather.humidity, weather.wind.speed) };
  } catch {
    return { weather: null, index: null };
  }
}

/**
 * NASA FIRMS hotspot detection.
 *
 * Path A (optional, best): the FIRMS area API with a free MAP_KEY
 * (register at https://firms.modaps.eosdis.nasa.gov/api/area/) — queries only
 * the territory bbox, tiny response. Set VITE_FIRMS_MAP_KEY in .env.local.
 * Path B (default): the global SUOMI-VIIRS CSV, 24h window then 48h. The CSV
 * (~4 MB) emits no CORS headers, so in dev it is proxied via /firms-csv
 * (vite.config.ts); in production a server-side proxy is required (README).
 *
 * A reachable-but-empty window is a REAL zero (LIVE source, empty list);
 * only a transport failure yields 'UNAVAILABLE'.
 */

/** Vite env under browser/build; {} under plain Node (tsx) so scripts run. */
const ENV: Record<string, unknown> =
  (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};

const FIRMS_MAP_KEY = (ENV.VITE_FIRMS_MAP_KEY as string | undefined) ?? '';

function buildFirmsAreaUrl(territory: Territory): string {
  const [w, s, e, n] = territory.bbox;
  return `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/VIIRS_SNPP_NRT/${w},${s},${e},${n}/2`;
}

/**
 * FIRMS emits no CORS headers for the CSV — candidates are the same-origin
 * proxy path first (Vite dev server / bundled nginx image), then the direct
 * URL (works from non-browser contexts and some hosting setups).
 */
function firmsCandidates(window: '24h' | '48h'): string[] {
  const path = `data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_${window}.csv`;
  return [`/firms-csv/${path}`, `https://firms.modaps.eosdis.nasa.gov/${path}`];
}

function parseFirmsCsv(csv: string, territory: Territory, window: '24h' | '48h'): FireHotspot[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const iLat = idx('latitude');
  const iLon = idx('longitude');
  const iFrp = idx('frp');
  const iConf = idx('confidence');
  const iDate = idx('acq_date');
  const iTime = idx('acq_time');
  const iSat = idx('satellite');
  const iDN = idx('daynight');
  const [w, s, e, n] = territory.bbox;
  const global = Boolean(territory.global);
  // Cap the stored pool, then stride-sample so the global view spreads dots
  // over the whole planet instead of clustering on the first CSV rows.
  const POOL_CAP = global ? 4000 : 40;
  const DISPLAY_CAP = global ? 300 : 18;
  const items: FireHotspot[] = [];
  for (let i = 1; i < lines.length && items.length < POOL_CAP; i++) {
    const cols = lines[i].split(',');
    const lat = num(cols[iLat], Number.NaN);
    const lon = num(cols[iLon], Number.NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (!global && (lat < s || lat > n || lon < w || lon > e)) continue;
    const rawConf = (cols[iConf]?.trim() ?? 'n').toLowerCase();
    items.push({
      id: `FIRMS-${window}-${i}`,
      lat,
      lon,
      frp: num(cols[iFrp], 1),
      confidence: rawConf.startsWith('h') ? 'h' : rawConf.startsWith('l') ? 'l' : 'n',
      acqDate: cols[iDate]?.trim() ?? '',
      acqTime: cols[iTime]?.trim() ?? '',
      satellite: cols[iSat]?.trim() ?? 'VIIRS',
      dayNight: cols[iDN]?.trim() === 'N' ? 'N' : 'D',
      vegetation: 'In-situ classification pending',
    });
  }
  if (global && items.length > DISPLAY_CAP) {
    const stride = Math.ceil(items.length / DISPLAY_CAP);
    const sampled: FireHotspot[] = [];
    for (let i = 0; i < items.length && sampled.length < DISPLAY_CAP; i += stride) sampled.push(items[i]);
    return sampled.sort((a, b) => b.frp - a.frp);
  }
  return items.sort((a, b) => b.frp - a.frp);
}

export async function fetchHotspots(territory: Territory): Promise<{ items: FireHotspot[]; source: FeedSource }> {
  const displayCap = territory.global ? 300 : 18;
  // Path A: bbox-scoped area API (needs a free MAP_KEY; also the production path)
  if (FIRMS_MAP_KEY) {
    try {
      const res = await fetchWithTimeout(buildFirmsAreaUrl(territory), 12000);
      const items = parseFirmsCsv(await res.text(), territory, '24h');
      return { items: items.slice(0, displayCap), source: 'LIVE:NASA-FIRMS' };
    } catch {
      /* fall through to the global CSV path */
    }
  }
  // Path B: global CSV — same-origin proxy first, direct URL fallback
  for (const window of ['24h', '48h'] as const) {
    try {
      const res = await fetchFirstReachable(firmsCandidates(window), 14000);
      const items = parseFirmsCsv(await res.text(), territory, window);
      if (items.length > 0) {
        return { items: items.slice(0, displayCap), source: 'LIVE:NASA-FIRMS' };
      }
    } catch {
      // try next detection window; if all fail the feed is genuinely unavailable
    }
  }
  // Distinguish "fetched, zero detections" from "could not fetch" with one probe.
  try {
    const res = await fetchFirstReachable(firmsCandidates('24h'), 8000);
    if (res.ok) return { items: [], source: 'LIVE:NASA-FIRMS' };
  } catch {
    /* fall through */
  }
  return { items: [], source: 'UNAVAILABLE' };
}

/**
 * CANOPY — 4-layer soil moisture (0–1, 1–3, 3–9, 9–27 cm) from the
 * Open-Meteo ERA5/CMAAS land model, in m³/m³ × 100 for readability. Real
 * model data, not measurements of a physical probe — labelled as model.
 */
export async function fetchSoilMoisture(territory: Territory): Promise<{ items: SoilPoint[]; source: FeedSource }> {
  const { forest } = territory.analysisPoints;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${forest[0]}&longitude=${forest[1]}` +
    `&hourly=soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm` +
    `&past_days=1&forecast_days=1&timezone=UTC`;
  try {
    const res = await fetchWithTimeout(url);
    const json = await res.json();
    const h = json?.hourly;
    if (!h?.time) throw new Error('empty hourly block');
    const total = h.time.length;
    const start = Math.max(0, total - 24);
    const items: SoilPoint[] = [];
    for (let i = start; i < total; i++) {
      items.push({
        time: h.time[i].slice(11, 16),
        l0_1: Math.round(num(h.soil_moisture_0_to_1cm?.[i], Number.NaN) * 1000) / 10,
        l1_3: Math.round(num(h.soil_moisture_1_to_3cm?.[i], Number.NaN) * 1000) / 10,
        l3_9: Math.round(num(h.soil_moisture_3_to_9cm?.[i], Number.NaN) * 1000) / 10,
        l9_27: Math.round(num(h.soil_moisture_9_to_27cm?.[i], Number.NaN) * 1000) / 10,
      });
    }
    if (items.length === 0) throw new Error('no soil rows');
    return { items, source: 'LIVE:OPEN-METEO' };
  } catch {
    return { items: [], source: 'UNAVAILABLE' };
  }
}

/**
 * CANOPY — current air quality at the forest analysis point. CAMS global
 * model (real model output), European + US AQI included. Global, no key.
 */
export async function fetchAirQuality(territory: Territory): Promise<{ air: AirQuality | null; source: FeedSource }> {
  const { forest } = territory.analysisPoints;
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${forest[0]}&longitude=${forest[1]}` +
    `&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi`;
  try {
    const res = await fetchWithTimeout(url);
    const json = await res.json();
    const c = json?.current ?? {};
    const air: AirQuality = {
      europeanAqi: Math.round(num(c.european_aqi, Number.NaN)),
      pm25: num(c.pm2_5, Number.NaN),
      pm10: num(c.pm10, Number.NaN),
      ozone: num(c.ozone, Number.NaN),
      no2: num(c.nitrogen_dioxide, Number.NaN),
      so2: num(c.sulphur_dioxide, Number.NaN),
      co: num(c.carbon_monoxide, Number.NaN),
    };
    if (!Number.isFinite(air.europeanAqi)) throw new Error('no AQ block');
    return { air, source: 'LIVE:OPEN-METEO' };
  } catch {
    return { air: null, source: 'UNAVAILABLE' };
  }
}
