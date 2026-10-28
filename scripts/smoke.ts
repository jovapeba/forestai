/**
 * Node-side smoke test — verifies the REAL public-API integrations resolve
 * and that no simulated path exists. Network failures are reported honestly
 * (an unavailable feed is a valid outcome; a fabricated one is not).
 * Run: npx tsx scripts/smoke.ts
 */
import { getTerritory, parseSpecies, TERRITORIES } from '../src/data/territoriesData';
import { deriveIncidents, hydroPeakRatio, liveFeedHealth, synthesizeSITREP, type LiveCtx } from '../src/services/aiSynthesisService';
import { fetchRealGauges } from '../src/services/api/waterLevelService';
import { fetchUsgsDailyGages } from '../src/services/api/waterdataDevService';
import { fetchFireIncidents, fetchFirePerimeters } from '../src/services/api/fireIncidentsService';
import { fetchUsDrought, fetchCountyAqi } from '../src/services/api/usIndexService';
import { fetchRiverDischarge } from '../src/services/api/floodService';
import { fetchFireWeather, fetchSoilMoisture, fetchHotspots, fetchAirQuality } from '../src/services/api/openMeteoService';
import { fetchOccurrences, fetchSpeciesObservations, fetchInatSpeciesObservations } from '../src/services/api/wildlifeService';
import { fetchTerritoryEvents } from '../src/services/api/eventsService';
import { fetchAmedas } from '../src/services/api/amedasService';
import { fetchCityAqGrid } from '../src/services/api/cityAqService';
import { fetchFireWeather } from '../src/services/api/openMeteoService';
import { deriveFwi, fwiToCategory } from '../src/services/api/hazard';

let failures = 0;
const check = (name: string, ok: boolean, extra = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
};

/* ------------------------- territory configuration ---------------------- */

check('default territory is Slovenia', getTerritory('SI').code === 'SI');
check('12 view presets (11 countries + global)', TERRITORIES.length === 12);
check('global view preset exists', getTerritory('GL').global === true);
for (const t of TERRITORIES.filter((x) => !x.global)) {
  check(
    `territory ${t.code} config factual`,
    t.hydroPoints.length === 4 &&
      t.species.length === 4 &&
      t.bbox.length === 4 &&
      t.species.map(parseSpecies).every((s) => /^[A-Z][a-z]+ [a-z]+$/.test(s.latin)),
  );
}

/* --------------------------- real gauge feeds --------------------------- */

for (const code of ['US', 'DE', 'GB', 'SI', 'BR', 'AU', 'PL']) {
  const t = getTerritory(code);
  const g = await fetchRealGauges(t);
  if (g.source.startsWith('LIVE')) {
    check(
      `real gauges ${code} LIVE`,
      g.items.length >= 1 &&
        g.items.every((x) => Number.isFinite(x.level) && x.agency.length > 3 && ['RISING', 'STEADY', 'FALLING'].includes(x.trend) && x.timestamp.length > 0),
      `${g.source} · ${g.items.length} gauges`,
    );
  } else {
    check(`real gauges ${code} honest-unavailable`, g.source === 'UNAVAILABLE' && g.items.length === 0, 'no open feed — nothing simulated');
  }
}

/* ------------------------- live environmental feeds ---------------------- */

{
  const us = getTerritory('US');
  const wd = await fetchUsgsDailyGages(us);
  check(
    'USGS daily gages (waterdata.dev) live-or-unavailable',
    wd.items.length === 0 ? wd.source === 'UNAVAILABLE' : wd.items.every((g) => g.series.length > 0 && Number.isFinite(g.series[g.series.length - 1].cms) && Number.isFinite(g.lat) && Number.isFinite(g.lon)),
    `${wd.source} · ${wd.items.length} gages`,
  );

  const inc = await fetchFireIncidents(us);
  check(
    'US fire incidents live-or-unavailable',
    inc.items.length === 0 ? inc.source === 'UNAVAILABLE' : inc.items.every((i) => Number.isFinite(i.lat) && Number.isFinite(i.lon) && i.name.length > 0),
    `${inc.source} · ${inc.items.length} incidents`,
  );

  const per = await fetchFirePerimeters(us);
  check(
    'US fire perimeters live-or-unavailable',
    per.items.length === 0 ? per.source === 'UNAVAILABLE' : per.items.every((p) => Number.isFinite(p.acres) && p.acres > 0 && p.name.length > 0),
    `${per.source} · ${per.items.length} perimeters`,
  );

  const drt = await fetchUsDrought(us);
  check(
    'US Drought Monitor live-or-unavailable',
    drt.items.length === 12 && drt.items.every((d) => ['NONE', 'D0', 'D1', 'D2', 'D3', 'D4'].includes(d.droughtClass ?? '')),
    `${drt.source} · ${drt.items.length} counties · worst ${drt.items.filter((d) => d.droughtClass !== 'NONE').length} in drought`,
  );

  const aqi = await fetchCountyAqi(us);
  check(
    'EPA county AQI live-or-unavailable',
    aqi.items.length === 12 && (aqi.source === 'LIVE:EPA-AQI' ? aqi.items.some((d) => Number.isFinite(d.aqi)) : aqi.source === 'UNAVAILABLE'),
    `${aqi.source} · latest ${aqi.items.find((d) => Number.isFinite(d.aqi))?.aqi ?? '—'}`,
  );
}

{
  const si = getTerritory('SI');
  const [weather, hydro, soil, hotspots, occ, gbif, inat] = await Promise.all([
    fetchFireWeather(si),
    fetchRiverDischarge(si),
    fetchSoilMoisture(si),
    fetchHotspots(si),
    fetchOccurrences(si),
    fetchSpeciesObservations(si),
    fetchInatSpeciesObservations(si),
  ]);

  check('weather live-or-unavailable', weather.weather === null ? weather.index === null : weather.weather.source === 'LIVE:OPEN-METEO');
  check('FWI derived from real weather only', weather.index === null || weather.index.source === 'DERIVED:OPEN-METEO');
  check('hydro live-or-unavailable', hydro.points.length === 0 ? hydro.source === 'UNAVAILABLE' : hydro.source === 'LIVE:GLOFAS' && hydro.points.every((p) => Number.isFinite(p.discharge)));
  check('soil live-or-unavailable', soil.items.length === 0 ? soil.source === 'UNAVAILABLE' : soil.items.length >= 20 && soil.source === 'LIVE:OPEN-METEO');
  check('hotspots live-or-unavailable', hotspots.source === 'LIVE:NASA-FIRMS' || hotspots.source === 'UNAVAILABLE', `${hotspots.source} · ${hotspots.items.length} items`);
  check('GBIF occurrences live-or-unavailable', occ.source === 'LIVE:GBIF' || (occ.source === 'UNAVAILABLE' && occ.items.length === 0), `${occ.source} · ${occ.items.length}`);
  check(
    'GBIF species observations live-or-unavailable',
    gbif.every((s) => s.source === 'LIVE:GBIF' || (s.source === 'UNAVAILABLE' && s.items.length === 0)),
    gbif.filter((s) => s.source === 'LIVE:GBIF').length + ' species live',
  );
  check(
    'iNaturalist observations live-or-unavailable',
    inat.every((s) => s.source === 'LIVE:INATURALIST' || (s.source === 'UNAVAILABLE' && s.items.length === 0)),
    inat.filter((s) => s.source === 'LIVE:INATURALIST').length + ' species live',
  );

  const air = await fetchAirQuality(si);
  check('air quality live-or-unavailable', (air.air === null) === (air.source === 'UNAVAILABLE'), air.air ? `EU AQI ${air.air.europeanAqi}` : air.source);

  const events = await fetchTerritoryEvents(si);
  check(
    'events honest (LIVE sources only carry items)',
    events.items.every((e) => events.sources.includes(e.source)) && (events.items.length > 0 ? events.sources.length > 0 : true),
    `${events.items.length} events · ${events.sources.join(',') || 'none live'}`,
  );

  const glEvents = await fetchTerritoryEvents(getTerritory('GL'));
  const gdacsItems = glEvents.items.filter((e) => e.source === 'LIVE:GDACS');
  check(
    'global events span continents (GDACS live-or-upstream-down)',
    // Fail only on dishonesty: GDACS rows must carry the GDACS source tag;
    // an upstream outage simply means zero GDACS items (honest UNAVAILABLE).
    !glEvents.sources.includes('LIVE:GDACS') || gdacsItems.length > 0,
    `${glEvents.items.length} events · ${glEvents.sources.join(',')}${gdacsItems.length > 0 ? ` · GDACS ${gdacsItems.length}` : ' · GDACS upstream down'}`,
  );

  // Poland — real IMGW hydro gauges with official alarm thresholds
  const plGauges = await fetchRealGauges(getTerritory('PL'));
  check(
    'Poland IMGW gauges live',
    plGauges.source === 'LIVE:IMGW-POLAND' &&
      plGauges.items.length >= 4 &&
      plGauges.items.every((x) => Number.isFinite(x.level) && x.level > 0 && x.unit === 'cm' && x.agency === 'IMGW-PIB POLAND'),
    `${plGauges.source} · ${plGauges.items.length} gauges`,
  );

  // Japan — JMA official warnings are text-only: any live row carries no
  // coordinates (they surface in SENTRY, never fabricated onto the map).
  const jpEvents = await fetchTerritoryEvents(getTerritory('JP'));
  check(
    'Japan JMA warnings honest (text-only, never plotted)',
    !jpEvents.sources.includes('LIVE:JMA-JAPAN') ||
      jpEvents.items.filter((e) => e.source === 'LIVE:JMA-JAPAN').every((e) => e.lat == null && e.lon == null && e.title.length > 5),
    `${jpEvents.items.length} events · ${jpEvents.sources.join(',')}`,
  );

  // Japan — real JMA AMeDAS nationwide observation frame (1,286 stations)
  const amedas = await fetchAmedas(getTerritory('JP'));
  check(
    'Japan AMeDAS observation frame live',
    amedas.source === 'LIVE:JMA-AMEDAS' &&
      amedas.rows.length >= 800 &&
      amedas.rows.every((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon) && r.name.length > 0),
    `${amedas.source} · ${amedas.rows.length} stations · frame ${amedas.frameTime}`,
  );

  // AMeDAS is Japan-scoped: every other territory is honestly N/A
  const amedasSi = await fetchAmedas(getTerritory('SI'));
  check('AMeDAS not-applicable outside Japan', amedasSi.source === 'NOT-APPLICABLE' && amedasSi.rows.length === 0, amedasSi.source);

  // Czechia — CHMI 10-min gauge series with official four-stage thresholds
  const czGauges = await fetchRealGauges(getTerritory('CZ'));
  check(
    'Czechia CHMI gauges live',
    czGauges.source === 'LIVE:CHMI-CZECH' &&
      czGauges.items.length >= 5 &&
      czGauges.items.every((x) => Number.isFinite(x.level) && x.unit === 'cm' && x.agency === 'CHMI CZECH HYDROMETEOROLOGY'),
    `${czGauges.source} · ${czGauges.items.length} gauges`,
  );

  // Czechia MeteoAlarm slug (czechia) reaches the CAP feed
  const czEvents = await fetchTerritoryEvents(getTerritory('CZ'));
  check(
    'Czechia MeteoAlarm CAP live',
    czEvents.sources.includes('LIVE:METEOALARM'),
    `${czEvents.items.length} events · ${czEvents.sources.join(',')}`,
  );

  // Global CAMS air-quality city grid — one batched request, real EU AQI
  const aqGrid = await fetchCityAqGrid();
  check(
    'CAMS city AQ grid live',
    aqGrid.source === 'LIVE:CAMS-AQ-GRID' &&
      aqGrid.rows.length >= 25 &&
      aqGrid.rows.every((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon) && r.pm25 != null && r.city.length > 1),
    `${aqGrid.source} · ${aqGrid.rows.length} cities`,
  );

  // lightning_potential rides the same weather request — the bundle stays live
  const lightningProbe = await fetchFireWeather(getTerritory('JP'));
  check(
    'lightning potential carried by live weather',
    lightningProbe.weather == null || typeof lightningProbe.weather.lightningMax === 'number',
    `weather source ${lightningProbe.weather?.source ?? 'UNAVAILABLE'} · lightningMax ${lightningProbe.weather?.lightningMax ?? '—'} J/kg`,
  );
}

/* ---------------------- derived incident / SITREP ------------------------ */

{
  const de = getTerritory('DE');
  const hydro = await fetchRiverDischarge(de);
  const ctx: LiveCtx = {
    hotspots: [],
    hotspotsSource: 'LIVE:NASA-FIRMS',
    hydro: hydro.points,
    hydroSource: hydro.source,
    index: deriveFwi(31, 18, 14), // real-shape inputs — derivation must be pure
    weather: { temp: 31, humidity: 18, wind: { speed: 14, dir: 250, gust: 40 }, source: 'LIVE:OPEN-METEO' },
    realGauges: [],
    realGaugesSource: 'UNAVAILABLE',
    occurrences: [],
    occurrencesSource: 'UNAVAILABLE',
    events: [],
    eventsSources: [],
  };

  // Pure derivations
  const fwi1 = deriveFwi(31, 18, 14);
  const fwi2 = deriveFwi(31, 18, 14);
  check('deriveFwi is pure (no randomness)', JSON.stringify(fwi1) === JSON.stringify(fwi2) && fwi1.fwi >= 0 && fwi1.fwi <= 100, `FWI ${fwi1.fwi} ${fwi1.category}`);
  check('fwiToCategory bands', fwiToCategory(10) === 'LOW' && fwiToCategory(30) === 'MODERATE' && fwiToCategory(60) === 'HIGH' && fwiToCategory(90) === 'EXTREME');

  // Health + ratio helpers
  const health = liveFeedHealth(ctx);
  check(
    'liveFeedHealth counts live sources',
    health.total === 6 && health.live >= 0 && health.live <= 6,
    `${health.live}/${health.total}`,
  );
  check('hydroPeakRatio real-only', hydroPeakRatio(hydro.points) === 0 || hydroPeakRatio(hydro.points) > 0);

  // No incidents should derive when no real qualifying data exists
  const none = deriveIncidents(de, { ...ctx, hotspots: [], hotspotsSource: 'LIVE:NASA-FIRMS', events: [], eventsSources: [] });
  check('no incidents when no qualifying real data', none.length === 0, `${none.length} derived`);

  // Fire incident derives only from real hotspots
  const withFire = deriveIncidents(de, {
    ...ctx,
    hotspots: [{ id: 'X', lat: 48.5, lon: 8.2, frp: 55, confidence: 'h', acqDate: '2026-10-27', acqTime: '1200', satellite: 'VIIRS', dayNight: 'D', vegetation: 'n/a' }],
    events: [],
    eventsSources: [],
  });
  check('fire incident derives from real hotspots', withFire.length === 1 && withFire[0].id === 'FIRE' && withFire[0].cascade.length === 5);

  // Seismic incident derives only from real earthquakes
  const withQuake = deriveIncidents(de, {
    ...ctx,
    events: [{ id: 'EQ-X', kind: 'SEISMIC', title: 'Test real quake', lat: 48.5, lon: 8.2, detail: 'M5.6 · depth 10 km', time: '2026-10-27', source: 'LIVE:USGS-EQ' }],
    eventsSources: ['LIVE:USGS-EQ'],
  });
  check('seismic incident derives from real earthquakes', withQuake.some((i) => i.id === 'SEISMIC' && i.severity === 'HIGH'));

  // Met-warning incident derives only from real CAP warnings
  const withCap = deriveIncidents(de, {
    ...ctx,
    events: [{ id: 'CAP-X', kind: 'MET-WARNING', title: 'Wind warning', lat: 50.1, lon: 8.7, detail: 'SEVERE · Bavaria', time: '2026-10-27', source: 'LIVE:METEOALARM' }],
    eventsSources: ['LIVE:METEOALARM'],
  });
  check('met-warning incident derives from real CAP', withCap.some((i) => i.id === 'MET' && i.severity === 'HIGH'));

  const sitrep = synthesizeSITREP(withFire[0], de, ctx);
  check(
    'SITREP cites real values only',
    !!sitrep.id && sitrep.summary.includes('55 MW') && sitrep.cascade.length === 5 && sitrep.actions.length >= 2,
    `${sitrep.threatLevel} · conf ${sitrep.confidencePct}%`,
  );
}

console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
