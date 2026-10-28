import { fetchFirstReachable, fetchWithTimeout, num } from './http';
import { getTerritory } from '@/data/territoriesData';
import type { RealGauge, Territory, FeedSource, StationStatus } from '@/types/environmental';

/**
 * FLUVIA — REAL river water levels (stage) from official open feeds.
 *
 * There is NO single global water-level (stage) station API. The only global
 * river feed is Copernicus GloFAS *modelled discharge* (see floodService).
 * Genuine stage readings come from national hydrometric networks — of the
 * sovereign presets, three publish anonymous open CORS JSON (all verified):
 *
 *   🇺🇸 USGS NWIS IV        — Access-Control-Allow-Origin: *
 *   🇩🇪 WSV Pegelonline v2   — Access-Control-Allow-Origin: *
 *   🇬🇧 UK EA Flood-Monitoring — Access-Control-Allow-Origin: *
 *   🇵🇱 IMGW hydro           — Access-Control-Allow-Origin: *
 *
 * 🇸🇮 ARSO, 🇧🇷 ANA Hidroweb and 🇦🇺 BoM Water Data Online publish stage data
 * but are not anonymously accessible, so those territories receive an
 * explicit UNAVAILABLE state — no readings are invented for them.
 */

/* ------------------------------ helpers -------------------------------- */

const statusFromState = (state?: string): StationStatus => {
  const s = (state ?? '').toLowerCase();
  if (s.includes('high') || s.includes('flood')) return 'ALERT';
  if (s.includes('low')) return 'NOMINAL';
  return 'NOMINAL';
};

function trendOf(series: number[], epsilon = 0.5): { trend: RealGauge['trend']; span: number } {
  if (series.length < 2) return { trend: 'STEADY', span: 0 };
  const span = series[series.length - 1] - series[0];
  if (span > epsilon) return { trend: 'RISING', span };
  if (span < -epsilon) return { trend: 'FALLING', span };
  return { trend: 'STEADY', span };
}

/* ------------------------------ 🇺🇸 USGS -------------------------------- */

const USGS_SITES: Record<string, string[]> = {
  US: ['09380000', '09402500', '09404200', '09520900'], // Lees Ferry → Grand Canyon → Diamond Creek → Yuma
  ALL: ['09380000', '09402500', '09404200', '09520900'],
};

async function fetchUsgsGauges(territory: Territory): Promise<RealGauge[]> {
  const sites = USGS_SITES[territory.code];
  if (!sites) return [];
  const url =
    `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${sites.join(',')}` +
    `&parameterCd=00065&period=PT6H`;
  const res = await fetchWithTimeout(url, 9000);
  const json = await res.json();
  const series = json?.value?.timeSeries ?? [];
  const bySite = new Map<string, { name: string; lat?: number; lon?: number; vals: number[]; lastTs: string }>();
  for (const ts of series) {
    const code = String(ts?.sourceInfo?.siteCode?.[0]?.value ?? '');
    if (!code) continue;
    const vals = (ts?.values?.[0]?.value ?? [])
      .map((v: Record<string, unknown>) => num(v.value, Number.NaN))
      .filter((v: number) => Number.isFinite(v) && v > -99999);
    if (vals.length === 0) continue;
    const geo = ts?.sourceInfo?.geoLocation?.geogLocation;
    const entry = bySite.get(code) ?? {
      name: String(ts?.sourceInfo?.siteName ?? code),
      lat: geo?.latitude as number | undefined,
      lon: geo?.longitude as number | undefined,
      vals: [] as number[],
      lastTs: '',
    };
    entry.vals.push(...vals);
    const raw = ts?.values?.[0]?.value ?? [];
    entry.lastTs = String(raw[raw.length - 1]?.dateTime ?? new Date().toISOString());
    bySite.set(code, entry);
  }
  const gauges: RealGauge[] = [];
  for (const [code, e] of bySite) {
    const ft = e.vals[e.vals.length - 1];
    if (!Number.isFinite(ft)) continue;
    const meters = Number((ft * 0.3048).toFixed(2));
    const { trend, span } = trendOf(e.vals, 0.02);
    gauges.push({
      id: code,
      name: e.name,
      river: 'Colorado River Basin',
      lat: e.lat,
      lon: e.lon,
      level: meters,
      unit: 'm',
      state: meters > 8 ? 'high' : meters > 3 ? 'normal' : 'low',
      timestamp: e.lastTs,
      agency: 'USGS NWIS',
      source: 'LIVE:USGS',
      status: meters > 8 ? 'ALERT' : meters > 5 ? 'ELEVATED' : 'NOMINAL',
      trend,
      trendSpan: Number((span * 0.3048 * 100).toFixed(1)),
    });
  }
  return gauges;
}

/* --------------------------- 🇩🇪 WSV Pegelonline ------------------------- */

const WSV_TARGETS: Record<string, string[]> = {
  DE: ['MAXAU', 'MANNHEIM', 'MAINZ', 'KÖLN'],
  ALL: ['MAXAU', 'MANNHEIM', 'MAINZ', 'KÖLN'],
};

async function fetchWsvGauges(territory: Territory): Promise<RealGauge[]> {
  const targets = WSV_TARGETS[territory.code];
  if (!targets) return [];
  const base = 'https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations';
  const gauges = await Promise.all(
    targets.map(async (short): Promise<RealGauge | null> => {
      try {
        // Station detail carries the real coordinates + water body name
        // (the current-measurement endpoint does not include lat/lon).
        const det = await fetchWithTimeout(`${base}/${encodeURIComponent(short)}.json`, 7000);
        const d = await det.json();
        const lat = num(d?.latitude, Number.NaN);
        const lon = num(d?.longitude, Number.NaN);
        const water = String(d?.water?.longname ?? '').trim();
        const cur = await fetchWithTimeout(`${base}/${encodeURIComponent(short)}/W/currentmeasurement.json`, 7000);
        const c = await cur.json();
        let series: number[] = [];
        try {
          const ser = await fetchWithTimeout(`${base}/${encodeURIComponent(short)}/W/measurements.json?start=P1D`, 7000);
          const arr = await ser.json();
          series = (arr ?? []).map((m: Record<string, unknown>) => num(m.value, Number.NaN)).filter((v: number) => Number.isFinite(v));
        } catch {
          /* trend falls back to STEADY */
        }
        const { trend, span } = trendOf(series, 1);
        return {
          id: short,
          name: short.charAt(0) + short.slice(1).toLowerCase(),
          river: water ? `River ${water}` : 'WSV Bundeswasserstrassen',
          lat: Number.isFinite(lat) ? lat : undefined,
          lon: Number.isFinite(lon) ? lon : undefined,
          level: num(c.value, Number.NaN),
          unit: 'cm' as const,
          state: c.stateMnwMhw ?? c.stateNswHsw ?? 'normal',
          timestamp: String(c.timestamp ?? new Date().toISOString()),
          agency: 'WSV PEGELONLINE',
          source: 'LIVE:WSV-PEGELONLINE' as FeedSource,
          status: statusFromState(c.stateMnwMhw ?? c.stateNswHsw),
          trend,
          trendSpan: Number(span.toFixed(1)),
        };
      } catch {
        return null;
      }
    }),
  );
  return gauges.filter((g): g is RealGauge => g !== null && Number.isFinite(g.level));
}

/* --------------------- 🇬🇧 UK Environment Agency ------------------------ */

interface EaStation {
  id: string;       // EA notation
  name: string;
  river: string;
  lat: number;
  lon: number;
  measure: string;  // stage measure id
}

const UK_EA_STATIONS: Record<string, EaStation[]> = {
  GB: [
    { id: '3400TH', name: 'Kingston', river: 'River Thames', lat: 51.415005, lon: -0.308869, measure: '3400TH-level-stage-i-15_min-mAOD' },
    { id: '2642', name: 'Worcester (Barbourne)', river: 'River Severn', lat: 52.206967, lon: -2.235272, measure: '2642-level-stage-i-15_min-mASD' },
    { id: '4009', name: 'Colwick', river: 'River Trent', lat: 52.952707, lon: -1.07772, measure: '4009-level-stage-i-15_min-mASD' },
    { id: '2250TH', name: 'Newbury', river: 'River Kennet', lat: 51.401605, lon: -1.323874, measure: '2250TH-level-stage-i-15_min-mASD' },
  ],
  ALL: [],
};

async function fetchEaGauges(territory: Territory): Promise<RealGauge[]> {
  const stations = UK_EA_STATIONS[territory.code] ?? (territory.code === 'ALL' ? UK_EA_STATIONS.GB : undefined);
  if (!stations) return [];
  const base = 'https://environment.data.gov.uk/flood-monitoring/id/measures';
  const gauges = await Promise.all(
    stations.map(async (st): Promise<RealGauge | null> => {
      try {
        const res = await fetchWithTimeout(`${base}/${st.measure}/readings?_sorted&_limit=30`, 8000);
        const json = await res.json();
        const items = (json?.items ?? []) as Record<string, unknown>[];
        const vals = items
          .map((r) => ({ v: num(r.value, Number.NaN), t: String(r.dateTime ?? '') }))
          .filter((r) => Number.isFinite(r.v));
        if (vals.length === 0) return null;
        const last = vals[vals.length - 1];
        const { trend, span } = trendOf(
          vals.filter((_, i) => i % Math.ceil(vals.length / 24) === 0).map((r) => r.v),
          0.02,
        );
        return {
          id: st.id,
          name: st.name,
          river: st.river,
          lat: st.lat,
          lon: st.lon,
          level: last.v,
          unit: 'm' as const,
          timestamp: last.t,
          agency: 'UK ENVIRONMENT AGENCY',
          source: 'LIVE:UK-EA' as FeedSource,
          status: 'NOMINAL' as StationStatus,
          trend,
          trendSpan: Number(span.toFixed(2)),
        };
      } catch {
        return null;
      }
    }),
  );
  return gauges.filter((g): g is RealGauge => g !== null);
}

/* --------------------- 🇳🇴 NVE (Norway, free key) ------------------------ */

/**
 * NVE HydAPI — Norwegian Water Resources and Energy Directorate.
 * Free API key via registration (https://hydapi.nve.no — "Request key").
 * Set VITE_NVE_API_KEY in .env.local; without a key this network contributes
 * nothing (honest UNAVAILABLE for Norway).
 */
async function fetchNveGauges(territory: Territory): Promise<RealGauge[]> {
  const ENV: Record<string, string | undefined> =
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const key = ENV.VITE_NVE_API_KEY ?? '';
  if (!(territory.code === 'NO' || territory.code === 'ALL') || !key) return [];
  const base = 'https://hydapi.nve.no/api/v1';
  const headers = { 'api-key': key };
  const res = await fetchWithTimeout(`${base}/Stations`, 9000);
  const stations = await res.json();
  const [w, s, e, n] = territory.bbox;
  const picked = (stations?.data ?? stations ?? [])
    .filter((st: Record<string, unknown>) => {
      const lat = num(st.lat, Number.NaN);
      const lon = num(st.lon, Number.NaN);
      return Number.isFinite(lat) && Number.isFinite(lon) && lat >= s && lat <= n && lon >= w && lon <= e;
    })
    .slice(0, 4);
  if (picked.length === 0) return [];
  // Parameter 1000 = water level (vannstand). Window: last 6 hours.
  const ids = picked.map((st: Record<string, unknown>) => String(st.scode ?? st.id)).filter(Boolean);
  const obsRes = await fetchWithTimeout(
    `${base}/Observations?stationid=${ids.join(',')}&parameter=1000&period=PT6H`,
    10000,
  );
  const obs = await obsRes.json();
  const rows: Record<string, unknown>[] = obs?.data ?? obs ?? [];
  const byStation = new Map<string, { vals: number[]; lastTs: string }>();
  for (const r of rows) {
    const sid = String(r.stationid ?? r.stationId ?? '');
    const v = num(r.value, Number.NaN);
    if (!sid || !Number.isFinite(v)) continue;
    const e = byStation.get(sid) ?? { vals: [], lastTs: '' };
    e.vals.push(v);
    e.lastTs = String(r.time ?? r.regtime ?? e.lastTs);
    byStation.set(sid, e);
  }
  const gauges: RealGauge[] = [];
  for (const st of picked as Record<string, unknown>[]) {
    const sid = String(st.scode ?? st.id ?? '');
    const entry = byStation.get(sid);
    if (!entry || entry.vals.length === 0) continue;
    const { trend, span } = trendOf(entry.vals, 0.01);
    gauges.push({
      id: sid,
      name: String(st.sname ?? st.name ?? sid),
      river: String(st.vassdragnr ?? 'NVE network'),
      lat: num(st.lat, Number.NaN) || undefined,
      lon: num(st.lon, Number.NaN) || undefined,
      level: Number(entry.vals[entry.vals.length - 1].toFixed(2)),
      unit: 'm',
      timestamp: entry.lastTs || new Date().toISOString(),
      agency: 'NVE HYDAPI',
      source: 'LIVE:NVE-NORWAY',
      status: 'NOMINAL',
      trend,
      trendSpan: Number(span.toFixed(2)),
    });
  }
  return gauges;
}

/* ------------------- 🇫🇷 Hub'Eau hydrometrie (France) -------------------- */

/**
 * Hub'Eau (eaufrance.fr) — French national hydrometry, anonymous + CORS-open
 * per its documentation. Note: from some datacenter networks it answers 403;
 * browsers typically reach it fine. If unreachable it contributes nothing.
 */
/* Circuit breaker: when Hub'Eau's edge blocks the network (403), stop
   retrying for 10 minutes so repeated territory visits stay quiet. */
let hubeauCooldownUntil = 0;

async function fetchHubeauGauges(territory: Territory): Promise<RealGauge[]> {
  if (!(territory.code === 'FR' || territory.code === 'ALL')) return [];
  // Global view reuses the FR focus points (Hub'Eau is a French network).
  const points = territory.hydroPoints.length > 0
    ? territory.hydroPoints.slice(0, 4)
    : getTerritory('FR').hydroPoints;
  if (Date.now() < hubeauCooldownUntil) return [];
  // Hub'Eau emits no CORS headers — try the same-origin proxy path first
  // (Vite dev server / bundled nginx image), then the direct URL.
  const hubeauCandidates = (path: string): string[] => [
    `/hubeau/api/v1/hydrometrie/${path}`,
    `https://hubeau.eaufrance.fr/api/v1/hydrometrie/${path}`,
  ];
  // 1) find real active stations near each territory focus point
  const searchBoxes = points.map((p) => `${p.lon - 0.4},${p.lat - 0.4},${p.lon + 0.4},${p.lat + 0.4}`);
  const stationLists = await Promise.all(
    searchBoxes.map(async (bbox) => {
      try {
        const res = await fetchFirstReachable(
          hubeauCandidates(`referentiel/stations?bbox=${bbox}&status=4&size=3&fields=code_station,libelle_station,latitude,longitude`),
          8000,
        );
        const json = await res.json();
        return (json?.data ?? []) as Record<string, unknown>[];
      } catch {
        return [] as Record<string, unknown>[];
      }
    }),
  );
  const stations = stationLists.flat().slice(0, 4);
  if (stations.length === 0) {
    // All boxes rejected (likely edge block) — enter cooldown.
    hubeauCooldownUntil = Date.now() + 10 * 60_000;
    return [];
  }
  if (stations.length === 0) return [];
  // 2) latest observation per station (one batched call)
  const codes = stations.map((st) => String(st.code_station)).join(',');
  const obsRes = await fetchFirstReachable(
    hubeauCandidates(`observations?code_station=${codes}&size=20&sort=desc&fields=code_station,observation_date,observation_resultat,grandeur_hydro`),
    10000,
  );
  const obs = await obsRes.json();
  const rows: Record<string, unknown>[] = obs?.data ?? [];
  const latest = new Map<string, { v: number; t: string }>();
  for (const r of rows) {
    const code = String(r.code_station ?? '');
    const v = num(r.observation_resultat, Number.NaN);
    if (!code || !Number.isFinite(v) || latest.has(code)) continue;
    latest.set(code, { v, t: String(r.observation_date ?? '') });
  }
  return stations
    .map((st): RealGauge | null => {
      const code = String(st.code_station ?? '');
      const hit = latest.get(code);
      if (!hit) return null;
      return {
        id: code,
        name: String(st.libelle_station ?? code),
        river: 'HubEau hydrometrie network',
        lat: num(st.latitude, Number.NaN) || undefined,
        lon: num(st.longitude, Number.NaN) || undefined,
        level: Number(hit.v.toFixed(3)),
        unit: 'm',
        timestamp: hit.t,
        agency: "HUBEAU (FR HYDROMETRIE)",
        source: 'LIVE:HUBEAU',
        status: 'NOMINAL',
        trend: 'STEADY',
      };
    })
    .filter((g): g is RealGauge => g !== null);
}

/* ------------------------ 🇵🇱 IMGW hydrometrie --------------------------- */

/**
 * IMGW (Instytut Meteorologii i Gospodarki Wodnej) — Polish national hydro
 * network. Anonymous open JSON, CORS-open, ~913 stations refreshed every
 * ~10 min. The feed carries per-station official alarm (stan_alarmowy) and
 * warning (stan_ostrzegawczy) levels, so gauge status is derived from the
 * real thresholds — never invented.
 */
const IMGW_STATIONS: Record<string, { id: string; name: string; river: string; lat: number; lon: number }[]> = {
  PL: [
    { id: '150190340', name: 'Kraków-Bielany', river: 'Wisła', lat: 50.0403, lon: 19.8433 },
    { id: '150210170', name: 'Sandomierz', river: 'Wisła', lat: 50.6725, lon: 21.7461 },
    { id: '152210170', name: 'Warszawa-Bulwary', river: 'Wisła', lat: 52.2472, lon: 21.0208 },
    { id: '152190030', name: 'Włocławek', river: 'Wisła', lat: 52.6631, lon: 19.0692 },
    { id: '154180150', name: 'Tczew', river: 'Wisła', lat: 54.0872, lon: 18.8056 },
    { id: '152160140', name: 'Poznań Most Rocha', river: 'Warta', lat: 52.4022, lon: 16.9453 },
    { id: '151170030', name: 'Trestno (Wrocław)', river: 'Odra', lat: 51.0822, lon: 17.1469 },
    { id: '153140050', name: 'Szczecin', river: 'Odra', lat: 53.4225, lon: 14.5597 },
  ],
  ALL: [],
};

/* Session cache — the full hydro catalogue is ~550 KB and identical for ~10 min. */
let imgwCache: { rows: Map<string, Record<string, unknown>>; fetchedAt: number } | null = null;

async function imgwRows(): Promise<Map<string, Record<string, unknown>>> {
  if (imgwCache && Date.now() - imgwCache.fetchedAt < 10 * 60_000) return imgwCache.rows;
  const res = await fetchWithTimeout('https://danepubliczne.imgw.pl/api/data/hydro', 15000);
  const arr = (await res.json()) as Record<string, unknown>[];
  const rows = new Map<string, Record<string, unknown>>();
  for (const r of arr ?? []) rows.set(String(r.id_stacji ?? ''), r);
  imgwCache = { rows, fetchedAt: Date.now() };
  return rows;
}

async function fetchImgwGauges(territory: Territory): Promise<RealGauge[]> {
  const stations = IMGW_STATIONS[territory.code];
  if (!stations) return [];
  let rows: Map<string, Record<string, unknown>>;
  try {
    rows = await imgwRows();
  } catch {
    return [];
  }
  const gauges: RealGauge[] = [];
  for (const st of stations) {
    const r = rows.get(st.id);
    if (!r) continue;
    const level = num(r.stan_wody, Number.NaN);          // water stage, cm
    if (!Number.isFinite(level)) continue;
    const alarm = num(r.stan_alarmowy, Number.NaN);       // official alarm stage, cm
    const warning = num(r.stan_ostrzegawczy, Number.NaN); // official warning stage, cm
    const status: StationStatus = Number.isFinite(alarm) && level >= alarm
      ? 'ALERT'
      : Number.isFinite(warning) && level >= warning
        ? 'ELEVATED'
        : 'NOMINAL';
    gauges.push({
      id: st.id,
      name: st.name,
      river: String(r.rzeka ?? st.river),
      lat: st.lat,
      lon: st.lon,
      level: Number(level.toFixed(0)),
      unit: 'cm' as const,
      state: status === 'ALERT' ? 'high' : status === 'ELEVATED' ? 'elevated' : 'normal',
      timestamp: String(r.stan_wody_data_pomiaru ?? '').replace(' ', 'T') + 'Z',
      agency: 'IMGW-PIB POLAND',
      source: 'LIVE:IMGW-POLAND' as FeedSource,
      status,
      trend: 'STEADY',
    });
  }
  return gauges;
}

/* ------------------------ 🇨🇿 CHMI (Czechia) ---------------------------- */

/**
 * CHMI (Czech Hydrometeorological Institute) Open Data — 563 hydrometric
 * stations, anonymous JSON directory, no key. Per-station files carry a
 * 10-minute water-stage series (tsConID H, cm) and the metadata carries the
 * official four danger stages (SPA1H–SPA4H) per station.
 */
const CHMI_STATIONS: Record<
  string,
  { id: string; name: string; river: string; lat: number; lon: number; stages: (number | null)[] }[]
> = {
  CZ: [
    { id: '0-203-1-200900', name: 'Praha - Na Františku', river: 'Vltava', lat: 50.0932, lon: 14.4234, stages: [null, null, null, 606] },
    { id: '0-203-1-221000', name: 'Ústí nad Labem', river: 'Labe', lat: 50.6539, lon: 14.0425, stages: [450, 530, 600, 1062] },
    { id: '0-203-1-104400', name: 'Kostelec nad Labem', river: 'Labe', lat: 50.2378, lon: 14.5926, stages: [520, 620, 680, 788] },
    { id: '0-203-1-294000', name: 'Bohumín', river: 'Odra', lat: 49.9212, lon: 18.3281, stages: [400, 500, 600, 686] },
    { id: '0-203-1-257000', name: 'Svinov (Ostrava)', river: 'Odra', lat: 49.8198, lon: 18.217, stages: [310, 460, 520, 669] },
    { id: '0-203-1-367000', name: 'Olomouc-Nové Sady', river: 'Morava', lat: 49.5773, lon: 17.2609, stages: [360, 390, 430, 534] },
    { id: '0-203-1-198000', name: 'Beroun', river: 'Berounka', lat: 49.9587, lon: 14.0877, stages: [260, 320, 400, 650] },
    { id: '0-203-1-115100', name: 'České Budějovice', river: 'Vltava', lat: 48.9814, lon: 14.4624, stages: [300, 370, 430, 530] },
  ],
  ALL: [],
};

async function fetchChmiGauges(territory: Territory): Promise<RealGauge[]> {
  const stations = CHMI_STATIONS[territory.code];
  if (!stations) return [];
  const gauges = await Promise.all(
    stations.map(async (st): Promise<RealGauge | null> => {
      try {
        const res = await fetchFirstReachable(
          [
            `/chmi/hydrology/now/data/${st.id}.json`,
            `https://opendata.chmi.cz/hydrology/now/data/${st.id}.json`,
          ],
          8000,
        );
        const j = await res.json();
        const ts = (j?.objList?.[0]?.tsList ?? []).find(
          (t: Record<string, unknown>) => t.tsConID === 'H',
        );
        const rows = (ts?.tsData ?? []) as { dt?: string; value?: number }[];
        const series = rows.map((r) => num(r.value, Number.NaN)).filter((v: number) => Number.isFinite(v));
        if (series.length === 0) return null;
        const last = series[series.length - 1];
        const [s1, , s3] = st.stages;
        const status: StationStatus =
          s3 != null && last >= s3 ? 'ALERT' : s1 != null && last >= s1 ? 'ELEVATED' : 'NOMINAL';
        const { trend, span } = trendOf(series, 1);
        return {
          id: st.id,
          name: st.name,
          river: `River ${st.river}`,
          lat: st.lat,
          lon: st.lon,
          level: Number(last.toFixed(0)),
          unit: 'cm' as const,
          state: status === 'ALERT' ? 'high' : status === 'ELEVATED' ? 'elevated' : 'normal',
          timestamp: String(rows[rows.length - 1]?.dt ?? new Date().toISOString()),
          agency: 'CHMI CZECH HYDROMETEOROLOGY',
          source: 'LIVE:CHMI-CZECH' as FeedSource,
          status,
          trend,
          trendSpan: Number(span.toFixed(0)),
        };
      } catch {
        return null;
      }
    }),
  );
  return gauges.filter((g): g is RealGauge => g !== null);
}

/* ----------------------------- aggregator ------------------------------ */

export async function fetchRealGauges(
  territory: Territory,
): Promise<{ items: RealGauge[]; source: FeedSource }> {
  // In the global view, plot every configured official-gauge network.
  const pseudo: Territory = territory.global
    ? { ...territory, code: 'ALL' }
    : territory;
  const settled = await Promise.allSettled([
    fetchUsgsGauges(pseudo),
    fetchWsvGauges(pseudo),
    fetchEaGauges(pseudo),
    fetchNveGauges(pseudo),
    fetchHubeauGauges(pseudo),
    fetchImgwGauges(pseudo),
    fetchChmiGauges(pseudo),
  ]);
  const items = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
  if (items.length > 0) {
    return { items, source: items[0].source };
  }
  // Honest state: no anonymous open gauge feed reached for this territory.
  return { items: [], source: 'UNAVAILABLE' };
}
