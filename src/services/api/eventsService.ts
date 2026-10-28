import { fetchFirstReachable, fetchWithTimeout, num } from './http';
import type { Territory, EnvironmentalEvent, FeedSource } from '@/types/environmental';

/**
 * Real natural-hazard events for the SENTRY command layer. Three sources,
 * all free, all verified live (Oct 2026):
 *
 *   🌐 USGS earthquake FDSN feed  — global, no key, CORS-open
 *   🌐 NASA EONET open events     — global (cyclones, wildfires, volcanoes,
 *                                    floods, drought…), no key, CORS-open
 *   🌐 MeteoAlarm CAP feeds       — official European met warnings for ~37
 *                                    countries, no key, NO CORS (dev-proxy
 *                                    via /meteoalarm, see vite.config.ts)
 *
 * Every fetch resolves honestly: a failed source contributes no items and
 * is reported as 'UNAVAILABLE'. Nothing is synthesized.
 */

export interface EventBundle {
  items: EnvironmentalEvent[];
  sources: FeedSource[]; // one per dataset that resolved live
}

/* ------------------------------ 🌐 earthquakes -------------------------- */

async function fetchEarthquakes(territory: Territory): Promise<EnvironmentalEvent[]> {
  const [lat, lon] = territory.mapCenter;
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const url = territory.global
    ? // Worldwide: significant events only (M4.5+) over the same 7-day window
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${since}&minmagnitude=4.5&orderby=time&limit=40`
    : `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` +
      `&latitude=${lat}&longitude=${lon}&maxradiuskm=700` +
      `&starttime=${since}&minmagnitude=2.5&orderby=time&limit=20`;
  const res = await fetchWithTimeout(url, 10000);
  const json = (await res.json()) as { features?: Record<string, unknown>[] } | null;
  return (json?.features ?? [])
    .map((f: Record<string, unknown>): EnvironmentalEvent | null => {
      const coords = (f.geometry as { coordinates?: number[] } | undefined)?.coordinates; // [lon, lat, depth]
      if (!coords) return null;
      const p = f.properties as Record<string, unknown>;
      return {
        id: `EQ-${String(p.eventID ?? coords.join('-'))}`,
        kind: 'SEISMIC' as const,
        title: String(p.place ?? 'Earthquake'),
        lat: coords[1],
        lon: coords[0],
        detail: `M${num(p.mag, 0)} · depth ${coords[2]} km`,
        time: String(p.time ? new Date(Number(p.time)).toISOString() : '').slice(0, 10),
        source: 'LIVE:USGS-EQ' as FeedSource,
      } satisfies EnvironmentalEvent;
    })
    .filter((e): e is EnvironmentalEvent => e !== null);
}

/* ------------------------------ 🌐 EONET -------------------------------- */

async function fetchEonetEvents(territory: Territory): Promise<EnvironmentalEvent[]> {
  const res = await fetchWithTimeout('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60&days=20', 12000);
  const json = (await res.json()) as { events?: Record<string, unknown>[] } | null;
  const [w, s, e, n] = territory.bbox;
  const global = Boolean(territory.global);
  return (json?.events ?? [])
    .map((ev: Record<string, unknown>): EnvironmentalEvent | null => {
      const geoms = ev.geometry as { coordinates?: unknown; date?: string }[] | undefined;
      const last = geoms?.[geoms.length - 1];
      let coord = last?.coordinates;
      // EONET emits point [lon,lat] or polygon rings — take the first point
      if (Array.isArray(coord) && typeof coord[0] === 'number') {
        /* [lon, lat] */
      } else if (Array.isArray(coord) && Array.isArray(coord[0])) {
        coord = (coord as unknown[][]).flat().find((c) => Array.isArray(c) && typeof c[0] === 'number');
      } else {
        coord = null;
      }
      if (!Array.isArray(coord) || typeof coord[0] !== 'number' || typeof coord[1] !== 'number') return null;
      const lon = coord[0];
      const lat = coord[1];
      if (!global && (lat < s || lat > n || lon < w || lon > e)) return null; // inside the focused territory only
      const cats = ev.categories as { title?: string }[] | undefined;
      return {
        id: `EONET-${String(ev.id ?? 'x')}`,
        kind: 'NATURAL' as const,
        title: String(ev.title ?? 'Natural event'),
        lat,
        lon,
        detail: String(cats?.[0]?.title ?? 'event'),
        time: String(last?.date ?? '').slice(0, 10),
        source: 'LIVE:EONET' as FeedSource,
      } satisfies EnvironmentalEvent;
    })
    .filter((ev): ev is EnvironmentalEvent => ev !== null)
    .slice(0, territory.global ? 15 : 12);
}

/* --------------------------- 🌐 MeteoAlarm CAP -------------------------- */

/** ISO-2 → MeteoAlarm feed slug (European countries only). */
const METEOALARM_SLUGS: Record<string, string> = {
  SI: 'slovenia', DE: 'germany', GB: 'united-kingdom', FR: 'france',
  PL: 'poland', NL: 'netherlands', NO: 'norway', IT: 'italy',
  ES: 'spain', SE: 'sweden', FI: 'finland', AT: 'austria',
  CZ: 'czechia',
};

async function fetchMeteoAlarm(territory: Territory): Promise<EnvironmentalEvent[]> {
  const slug = METEOALARM_SLUGS[territory.code];
  if (!slug) return []; // non-European territory — service not applicable
  // MeteoAlarm emits no CORS headers: same-origin proxy (Vite dev server or
  // the bundled nginx image) first, direct URL as fallback.
  const res = await fetchFirstReachable([
    `/meteoalarm/api/v1/warnings/feeds-${slug}`,
    `https://feeds.meteoalarm.org/api/v1/warnings/feeds-${slug}`,
  ], 15000);
  const json = await res.json();
  const warnings = (json?.warnings ?? []) as { alert?: Record<string, unknown>; uuid?: string }[];
  const items: EnvironmentalEvent[] = [];
  for (const w of warnings) {
    const alert = w.alert as Record<string, unknown> | undefined;
    const infos = (alert?.info ?? []) as Record<string, unknown>[];
    for (const info of infos.slice(0, 1)) {
      const areas = (info.area ?? []) as Record<string, unknown>[];
      const withPolygon = areas.find((a) => Array.isArray(a.polygon) && (a.polygon as string[]).length > 0);
      let lat: number | undefined;
      let lon: number | undefined;
      if (withPolygon) {
        const first = String((withPolygon.polygon as string[])[0]).trim().split(/\s+/)[0]; // "lat,lon"
        const [la, lo] = first.split(',');
        lat = num(la, Number.NaN);
        lon = num(lo, Number.NaN);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) { lat = undefined; lon = undefined; }
      }
      const areaDesc = areas.map((a) => String(a.areaDesc ?? '')).filter(Boolean).slice(0, 2).join(' / ');
      items.push({
        id: `CAP-${String(alert?.identifier ?? w.uuid ?? items.length)}`.slice(0, 60),
        kind: 'MET-WARNING',
        title: String(info.event ?? 'Weather warning'),
        lat,
        lon,
        detail: `${String(info.severity ?? 'unknown').toUpperCase()} · ${areaDesc || territory.name}`,
        time: String(info.onset ?? '').slice(0, 10),
        source: 'LIVE:METEOALARM',
      });
      if (items.length >= 12) break;
    }
    if (items.length >= 12) break;
  }
  return items;
}

/* --------------------------- 🇺🇸 NWS active alerts ---------------------- */

/**
 * US National Weather Service active severe alerts — real official warnings
 * (severe thunderstorm, tornado, flash flood…). Free, no key, CORS-open.
 * Used for the US territory (its coverage area) and the global view.
 */
async function fetchNwsAlerts(territory: Territory): Promise<EnvironmentalEvent[]> {
  if (!(territory.code === 'US' || territory.global)) return [];
  const res = await fetchWithTimeout(
    'https://api.weather.gov/alerts/active?severity=Severe,Extreme&status=actual',
    12000,
  );
  const json = (await res.json()) as { features?: Record<string, unknown>[] } | null;
  const events: EnvironmentalEvent[] = [];
  for (const f of (json?.features ?? []) as Record<string, unknown>[]) {
    const p = f.properties as Record<string, unknown> | undefined;
    if (!p) continue;
    const event = String(p.event ?? 'Weather alert');
    const areaDesc = String(p.areaDesc ?? '').slice(0, 70);
    // representative point: first ring vertex of the alert polygon (real geometry)
    let lat: number | undefined;
    let lon: number | undefined;
    const geom = f.geometry as { coordinates?: unknown } | undefined;
    let ring = geom?.coordinates;
    if (Array.isArray(ring)) {
      if (Array.isArray(ring[0]) && Array.isArray(ring[0][0])) ring = (ring as unknown[][])[0];
      if (Array.isArray(ring) && Array.isArray(ring[0]) && typeof (ring[0] as unknown[])[0] === 'number') {
        const [lo, la] = ring[0] as number[];
        lat = la;
        lon = lo;
      }
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { lat = undefined; lon = undefined; }
    events.push({
      id: `NWS-${String(p.id ?? events.length)}`.slice(0, 50),
      kind: 'MET-WARNING',
      title: event,
      lat,
      lon,
      detail: `${String(p.severity ?? '').toUpperCase()} · ${areaDesc}`,
      time: String(p.sent ?? '').slice(0, 10),
      source: 'LIVE:NWS-ALERTS',
    });
    if (events.length >= 12) break;
  }
  return events;
}

/* ----------------------------- 🌐 GDACS -------------------------------- */

/**
 * GDACS — Global Disaster Alert and Coordination System (EC/JRC + UN).
 * Free, no key; one event type per request. Official alert levels
 * (Green/Orange/Red) cover Europe, Asia and Africa for cyclones, floods,
 * wildfires, earthquakes and volcanoes. Session-cached (responses are large).
 */
let gdacsCache: { items: EnvironmentalEvent[]; fetchedAt: number } | null = null;

async function fetchGdacs(): Promise<EnvironmentalEvent[]> {
  if (gdacsCache && Date.now() - gdacsCache.fetchedAt < 30 * 60_000) return gdacsCache.items;
  const types = ['TC', 'EQ', 'WF', 'VO'] as const;
  const settled = await Promise.allSettled(
    types.map((t) =>
      fetchFirstReachable(
        [
          `/gdacs/gdacsapi/api/events/geteventlist/MAP?eventtype=${t}`,
          `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=${t}`,
        ],
        15000,
      ).then((r) => r.json() as Promise<{ features?: Record<string, unknown>[] }>),
    ),
  );
  const events: EnvironmentalEvent[] = [];
  for (let i = 0; i < settled.length && events.length < 40; i++) {
    const s = settled[i];
    if (s.status !== 'fulfilled') continue;
    for (const f of s.value.features ?? []) {
      if (events.length >= 40) break;
      const p = f.properties as Record<string, unknown> | undefined;
      const geo = f.geometry as { coordinates?: number[] } | undefined;
      if (!p || !geo?.coordinates) continue;
      const kind: EnvironmentalEvent['kind'] = types[i] === 'EQ' ? 'SEISMIC' : 'NATURAL';
      const alert = String(p.alertlevel ?? 'Green');
      events.push({
        id: `GDACS-${p.eventtype}-${p.eventid}-${p.episodeid ?? 0}`,
        kind,
        title: String(p.name ?? p.eventname ?? `${p.eventtype} event`),
        lat: geo.coordinates[1],
        lon: geo.coordinates[0],
        detail: `${alert.toUpperCase()} ALERT · ${String(p.eventtype ?? '')}`,
        time: String(p.fromdate ?? p.todate ?? '').slice(0, 10),
        source: 'LIVE:GDACS',
      });
    }
  }
  gdacsCache = { items: events, fetchedAt: Date.now() };
  return events;
}

/* ----------------------------- 🇯🇵 JMA warnings -------------------------- */

/**
 * JMA (Japan Meteorological Agency) bosai feed — official Japanese met
 * warnings per prefecture group, anonymous JSON, CORS-open. The feed is
 * text-only (no geometry): warnings therefore never appear on the map —
 * they surface in the SENTRY list with the real Japanese headline text.
 */
const JMA_REGIONS: { code: string; name: string }[] = [
  { code: '130000', name: 'Tokyo / Kanto-Koshin' },
  { code: '270000', name: 'Osaka / Kinki' },
  { code: '230000', name: 'Aichi (Nagoya)' },
  { code: '400000', name: 'Fukuoka / Kyushu-N' },
  { code: '340000', name: 'Hiroshima / Chugoku' },
  { code: '016000', name: 'Hokkaido (Sapporo)' },
  { code: '471000', name: 'Okinawa' },
];

/** JMA emits the same report for 30 min; cache per territory query. */
let jmaCache: { items: EnvironmentalEvent[]; fetchedAt: number } | null = null;

async function fetchJmaWarnings(territory: Territory): Promise<EnvironmentalEvent[]> {
  if (!(territory.code === 'JP' || territory.global)) return [];
  if (jmaCache && Date.now() - jmaCache.fetchedAt < 10 * 60_000) return jmaCache.items;
  const settled = await Promise.allSettled(
    JMA_REGIONS.map((r) =>
      fetchWithTimeout(`https://www.jma.go.jp/bosai/warning/data/warning/${r.code}.json`, 8000).then(
        (res) => res.json() as Promise<Record<string, unknown>>,
      ),
    ),
  );
  const items: EnvironmentalEvent[] = [];
  settled.forEach((s, i) => {
    if (s.status !== 'fulfilled') return;
    const j = s.value as {
      reportDatetime?: string;
      publishingOffice?: string;
      headlineText?: string;
      areaTypes?: { areas?: { code?: string; warnings?: { status?: string }[] }[] }[];
    };
    const headline = String(j.headlineText ?? '').trim();
    const areaTypes = j.areaTypes ?? [];
    // Collect distinct non-empty warning statuses across sub-areas
    const active = new Set<string>();
    for (const at of areaTypes) {
      for (const a of at.areas ?? []) {
        for (const w of a.warnings ?? []) {
          const status = String(w.status ?? '');
          // "発表警報・注意報はなし" = none published; skip those
          if (status && !status.includes('なし')) active.add(status);
        }
      }
    }
    if (active.size === 0 || !headline) return;
    items.push({
      id: `JMA-${JMA_REGIONS[i].code}`,
      kind: 'MET-WARNING',
      title: headline.slice(0, 120),
      detail: `${[...active].slice(0, 3).join(' · ')} · ${JMA_REGIONS[i].name} (official, text-only)`,
      time: String(j.reportDatetime ?? '').slice(0, 10),
      source: 'LIVE:JMA-JAPAN',
    });
  });
  jmaCache = { items, fetchedAt: Date.now() };
  return items;
}

/* ----------------------------- aggregator ------------------------------ */

export async function fetchTerritoryEvents(territory: Territory): Promise<EventBundle> {
  const settled = await Promise.allSettled([
    fetchEarthquakes(territory),
    fetchEonetEvents(territory),
    fetchMeteoAlarm(territory),
    fetchNwsAlerts(territory),
    fetchGdacs(),
    fetchJmaWarnings(territory),
  ]);
  const byId = new Map<string, EnvironmentalEvent>();
  const sources: FeedSource[] = [];
  const sourceByIndex: FeedSource[] = ['LIVE:USGS-EQ', 'LIVE:EONET', 'LIVE:METEOALARM', 'LIVE:NWS-ALERTS', 'LIVE:GDACS', 'LIVE:JMA-JAPAN'];
  settled.forEach((s, i) => {
    if (s.status !== 'fulfilled') return;
    let bundle = s.value;
    if (sourceByIndex[i] === 'LIVE:GDACS' && !territory.global) {
      const [w0, s0, e0, n0] = territory.bbox;
      bundle = bundle.filter((e) => e.lat != null && e.lon != null && e.lat >= s0 && e.lat <= n0 && e.lon >= w0 && e.lon <= e0);
    }
    // Dedupe by id so every rendered row/marker has a unique React key.
    // Geometry-free events (JMA text warnings) stay in the bundle for the
    // SENTRY list — the MAP layer alone filters them out (never plotted).
    const placed = bundle.filter((e) => e.lat == null || (e.lat != null && Number.isFinite(e.lat)));
    if (placed.length === 0) return;
    for (const e of placed) if (!byId.has(e.id)) byId.set(e.id, e);
    sources.push(sourceByIndex[i]);
  });
  return { items: [...byId.values()], sources };
}
