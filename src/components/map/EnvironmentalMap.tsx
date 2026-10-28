import { useMemo } from 'react';
import { MapContainer, Marker, Polyline, Polygon, Popup, TileLayer, Tooltip, Circle, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getTerritory } from '@/data/territoriesData';
import { useAppStore, useT } from '@/store/useAppStore';
import { useLive } from '@/hooks/useLiveFeeds';
import { gibsDate, gibsTrueColorUrl, gibsAodUrl, NDVI_FILTER_CLASS } from '@/services/api/satelliteService';
import { euAqiColor } from '@/services/api/cityAqService';
import { cartoDarkBasemapUrl } from '@/services/api/basemap';
import type { EnvironmentalEvent } from '@/types/environmental';
import type { RainRadar } from '@/types/environmental';

const EVENT_ICON_COLOR: Record<EnvironmentalEvent['kind'], string> = {
  SEISMIC: '#ef4444',
  NATURAL: '#60a5fa',
  'MET-WARNING': '#fb923c',
};

const EVENT_LEGEND: Record<EnvironmentalEvent['kind'], string> = {
  SEISMIC: 'Earthquake (USGS, real)',
  NATURAL: 'NASA EONET event (real)',
  'MET-WARNING': 'MeteoAlarm CAP warning (real)',
};

/** GeoJSON MultiPolygon → Leaflet polygon rings ([[lat,lon],...]) */
function extractRings(geometry: unknown): [number, number][][] {
  const out: [number, number][][] = [];
  const walk = (coords: unknown) => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      out.push([[coords[1] as number, coords[0] as number]]); // single point → degenerate ring
      return;
    }
    const nestedFirst = (coords[0] as unknown[] | undefined)?.[0];
    if (typeof nestedFirst === 'number') {
      out.push((coords as [number, number][]).map(([lon, lat]) => [lat, lon]));
      return;
    }
    for (const c of coords) walk(c);
  };
  if (geometry && typeof geometry === 'object') {
    const g = geometry as { type?: string; coordinates?: unknown };
    if (g.type === 'MultiPolygon') (g.coordinates as unknown[][][]).forEach((poly) => walk((poly[0] as unknown) ?? poly));
    else if (g.type === 'Polygon') walk((g.coordinates as unknown[] | undefined)?.[0]);
  }
  return out.filter((r) => r.length > 2);
}

/** A position is plottable only if BOTH coordinates are real finite numbers. */
const plottable = (lat?: number, lon?: number): boolean =>
  lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon);

const DROUGHT_COLOR: Record<string, string> = {
  NONE: '#4ade80',
  D0: '#fde047',
  D1: '#fbbf24',
  D2: '#f97316',
  D3: '#ef4444',
  D4: '#7f1d1d',
};

const aqiColor = (aqi?: number): string => {
  if (aqi == null || !Number.isFinite(aqi)) return '#64748b';
  if (aqi <= 50) return '#4ade80';
  if (aqi <= 100) return '#fde047';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  if (aqi <= 300) return '#a855f7';
  return '#7f1d1d';
};
import { liveFeedHealth } from '@/services/aiSynthesisService';
import { Recenter } from './Recenter';
import { LayerControl } from './LayerControl';
import { SectionHeading, StatusBadge } from '@/components/ui/bits';

/* ------------------------- pulsing marker factory ---------------------- */

const pulseIcon = (color: string, size = 14, label?: string) =>
  L.divIcon({
    className: 'pulse-marker',
    html: `
      <span class="relative flex" style="width:${size}px;height:${size}px">
        <span class="pulse-ring" style="background:${color}"></span>
        <span class="relative inline-flex h-full w-full rounded-full" style="background:${color};box-shadow:0 0 10px 2px ${color}88"></span>
      </span>
      ${
        label
          ? `<span style="position:absolute;left:${size + 5}px;top:0;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;letter-spacing:.08em;color:${color};white-space:nowrap;text-shadow:0 1px 4px #000">${label}</span>`
          : ''
      }
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

/** Diamond marker for REAL official gauges (visually distinct). */
const officialIcon = (color: string, size = 14, label?: string) =>
  L.divIcon({
    className: 'official-marker',
    html: `
      <span style="display:inline-flex;width:${size}px;height:${size}px;transform:rotate(45deg);border:2.5px solid ${color};background:rgba(6,182,212,0.25);box-shadow:0 0 10px 2px ${color}66"></span>
      ${
        label
          ? `<span style="position:absolute;left:${size + 7}px;top:-1px;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;letter-spacing:.06em;color:${color};white-space:nowrap;text-shadow:0 1px 4px #000">${label}</span>`
          : ''
      }
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

/* ------------------------------ section -------------------------------- */

export function MapSection() {
  const t = useT();
  return (
    <section id="virtual-grid" className="relative scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading kicker="02 · VIRTUAL GRID" title={t('map.title')} sub={t('map.sub')} align="left" />
        </div>
        <EnvironmentalMap />
      </div>
    </section>
  );
}

/* ------------------------------- the map -------------------------------- */

export function EnvironmentalMap() {
  const t = useT();
  const territoryCode = useAppStore((s) => s.territoryCode);
  const territory = getTerritory(territoryCode);
  const layers = useAppStore((s) => s.layers);
  const opacity = useAppStore((s) => s.satelliteOpacity);
  const live = useLive();

  const points = territory.hydroPoints;
  const riverLine = useMemo<[number, number][]>(
    () => points.map((p) => [p.lat, p.lon]),
    [points],
  );
  const health = liveFeedHealth({
    hotspots: live.hotspots,
    hotspotsSource: live.hotspotsSource,
    hydro: live.hydro,
    hydroSource: live.hydroSource,
    index: live.index,
    weather: live.weather,
    realGauges: live.realGauges,
    realGaugesSource: live.realGaugesSource,
    occurrences: live.occurrences,
    occurrencesSource: live.occurrencesSource,
    events: live.events.items,
    eventsSources: live.events.sources,
  });
  const occurrenceDots = live.speciesObs.reduce((a, s) => a + s.items.length, 0) + live.occurrences.length;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-grid shadow-[0_30px_80px_rgba(0,0,0,0.5)] ${
        layers.ndvi ? 'ndvi-on' : ''
      }`}
    >
      <div className="h-[520px] md:h-[600px]">
        <MapContainer
          center={territory.mapCenter}
          zoom={territory.zoom}
          minZoom={3}
          maxZoom={12}
          scrollWheelZoom={false}
          className="h-full w-full"
          worldCopyJump
        >
          {/* Dark-Matter base (CARTO raster basemap, keyed) */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attribution/">CARTO</a>'
            url={cartoDarkBasemapUrl}
            subdomains={['a', 'b', 'c', 'd']}
          />

          {/* NASA GIBS daily true-color composite (real imagery) */}
          {layers.satellite && (
            <TileLayer
              key={`gibs-${layers.ndvi}-${opacity}`}
              url={gibsTrueColorUrl(gibsDate())}
              attribution='Imagery © <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a>'
              opacity={opacity}
              maxNativeZoom={9}
              maxZoom={12}
              className={layers.ndvi ? NDVI_FILTER_CLASS : ''}
            />
          )}

          {/* NASA GIBS VIIRS Deep Blue AOD — satellite smoke/dust/haze (real AQ column) */}
          {layers.aod && (
            <TileLayer
              key="gibs-aod"
              url={gibsAodUrl(gibsDate())}
              attribution='Aerosol optical depth &copy; <a href="https://earthdata.nasa.gov/gibs">NASA GIBS · VIIRS SNPP Deep Blue</a>'
              opacity={0.7}
              maxNativeZoom={6}
              maxZoom={12}
            />
          )}

          {/* Sentinel-2 cloudless 10 m mosaic (EOX — real imagery, free tier) */}
          {layers.s2 && (
            <TileLayer
              url="https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg"
              attribution='Imagery © <a href="https://s2maps.eu/">Sentinel-2 cloudless (EOX IT Services)</a>'
              maxNativeZoom={14}
              maxZoom={12}
            />
          )}

          {/* OpenTopoMap terrain contours (free with attribution) */}
          {layers.terrain && (
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              subdomains={['a', 'b', 'c']}
              attribution='&copy; <a href="https://www.opentopomap.org/">OpenTopoMap</a> (CC-BY-SA)'
              opacity={0.35}
              maxZoom={12}
            />
          )}

          <Recenter center={territory.mapCenter} zoom={territory.zoom} />

          {/* RainViewer precipitation radar — real radar reflectivity (rain + thunderstorm cells) */}
          {layers.rain && live.rainRadar.framePath && (
            <TileLayer
              key={`rain-${live.rainRadar.frameTime}`}
              url={`${live.rainRadar.framePath}/256/{z}/{x}/{y}/2/1_1.png`}
              attribution='Radar &copy; <a href="https://www.rainviewer.com/">RainViewer</a>'
              opacity={0.55}
              maxZoom={12}
            />
          )}

          {/* GloFAS forecast points along the main river (indicative path) */}
          {layers.water && (
            <>
              <Polyline
                positions={riverLine}
                pathOptions={{ color: '#14b8a6', weight: 3, opacity: 0.55, dashArray: '2 8' }}
              />
              {points
                .filter((p) => plottable(p.lat, p.lon))
                .map((p, i) => (
                <CircleMarker
                  key={p.id}
                  center={[p.lat, p.lon]}
                  radius={7}
                  pathOptions={{
                    color: '#14b8a6',
                    weight: 2,
                    fill: true,
                    fillColor: '#134e4a',
                    fillOpacity: 0.7,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -8]}>
                    <b>GLOFAS FORECAST POINT {p.id}</b> · {p.name}
                    <br />
                    {territory.basin}
                    {i === 0 && live.hydroSource === 'LIVE:GLOFAS' && live.hydro[0] && (
                      <>
                        <br />
                        Today (modelled): <b>{live.hydro[0].discharge.toLocaleString()} m³/s</b>
                      </>
                    )}
                    <br />
                    <span style={{ color: '#5eead4' }}>Discharge hydrograph in FLUVIA console</span>
                  </Tooltip>
                </CircleMarker>
              ))}
            </>
          )}

          {/* Thermal hotspots — REAL NASA FIRMS detections; top-3 carry FRP labels */}
          {layers.fire &&
            live.hotspots
              .filter((h) => plottable(h.lat, h.lon))
              .map((h, i) => (
              <Marker key={h.id} position={[h.lat, h.lon]} icon={pulseIcon('#f59e0b', i < 3 ? 16 : 13)}>
                {i < 3 ? (
                  <>
                    <Tooltip permanent direction="right" offset={[9, 0]} className="fire-frp-label">
                      {`🔥 ${h.frp} MW`}
                    </Tooltip>
                    <Popup>
                      <b>THERMAL ANOMALY {h.id}</b>
                      <br />
                      FRP: <b>{h.frp} MW</b> · conf: {h.confidence.toUpperCase()}
                      <br />
                      {h.acqDate} {h.acqTime}Z · {h.satellite}
                      <br />
                      {h.dayNight === 'D' ? 'Daytime' : 'Nighttime'} · {h.vegetation}
                      <br />
                      Feed: {live.hotspotsSource}
                    </Popup>
                  </>
                ) : (
                  <Tooltip direction="top" offset={[0, -10]}>
                    <b>THERMAL ANOMALY {h.id}</b>
                    <br />
                    FRP: <b>{h.frp} MW</b> · conf: {h.confidence.toUpperCase()}
                    <br />
                    {h.acqDate} {h.acqTime}Z · {h.satellite}
                    <br />
                    {h.dayNight === 'D' ? 'Daytime' : 'Nighttime'} · {h.vegetation}
                    <br />
                    Feed: {live.hotspotsSource}
                  </Tooltip>
                )}
              </Marker>
            ))}
          {layers.fire &&
            live.hotspots
              .filter((h) => plottable(h.lat, h.lon))
              .slice(0, 6)
              .map((h) => (
              <Circle
                key={`ring-${h.id}`}
                center={[h.lat, h.lon]}
                radius={Math.max(4500, h.frp * 320)}
                pathOptions={{ color: '#f59e0b', weight: 1.5, opacity: 0.85, fillOpacity: 0.13 }}
              />
            ))}

          {/* REAL species occurrences (GBIF flagship datasets + country/global window) */}
          {layers.animal &&
            live.speciesObs
              .map((so) => ({ ...so, items: so.items.filter((o) => plottable(o.lat, o.lon)) }))
              .flatMap((so) =>
              so.items.map((o, i) => (
                <CircleMarker
                  key={`${so.dataset}-${so.species}-${o.lat}-${o.lon}`}
                  center={[o.lat, o.lon]}
                  radius={4}
                  pathOptions={
                    so.dataset === 'LIVE:GBIF'
                      ? { color: '#a3e635', weight: 1.4, fill: true, fillColor: '#1a2e05', fillOpacity: 0.55 }
                      : { color: '#f472b6', weight: 1.4, fill: true, fillColor: '#500724', fillOpacity: 0.55 }
                  }
                >
                  <Tooltip direction="top" offset={[0, -6]}>
                    <b>REAL {so.dataset === 'LIVE:GBIF' ? 'GBIF' : 'INATURALIST'} RECORD</b> · {o.species}
                    <br />
                    {o.lat.toFixed(3)}°, {o.lon.toFixed(3)}° · {o.date}
                    <br />
                    {o.source}
                  </Tooltip>
                </CircleMarker>
              )),
            )}
          {layers.animal &&
            live.occurrences
              .filter((o) => plottable(o.lat, o.lon))
              .map((o, i) => (
              <CircleMarker
                key={`occwin-${i}`}
                center={[o.lat, o.lon]}
                radius={3}
                pathOptions={{ color: '#65a30d', weight: 1, fill: true, fillColor: '#1a2e05', fillOpacity: 0.4 }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <b>REAL GBIF RECORD</b> · {o.species}
                  <br />
                  {o.lat.toFixed(3)}°, {o.lon.toFixed(3)}° · {o.date}
                  <br />
                  {o.source}
                </Tooltip>
              </CircleMarker>
            ))}

          {/* USGS daily-discharge gages (waterdata.dev — real observed flow) */}
          {layers.official &&
            live.usgsGages
              .filter((g) => plottable(g.lat, g.lon))
              .map((g) => (
              <Marker
                key={`wd-${g.siteId}`}
                position={[g.lat, g.lon]}
                icon={officialIcon('#22d3ee', 11, `⬥ ${g.siteNumber}`)}
                zIndexOffset={350}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <b>⬥ USGS DAILY GAGE · {g.name}</b>
                  <br />
                  Latest daily mean: <b>{g.series[g.series.length - 1].cms} m³/s</b> ({g.series[g.series.length - 1].cfs} ft³/s)
                  <br />
                  {g.dailyEnd}{g.series[g.series.length - 1].provisional ? ' · PROVISIONAL' : ''}
                  <br />
                  Drainage area: {g.drainageAreaMi2.toLocaleString()} mi²
                  <br />
                  Feed: LIVE:USGS (waterdata.dev)
                </Tooltip>
              </Marker>
            ))}

          {/* REAL official stage gauges — only plottable stations */}
          {layers.official &&
            live.realGauges
              .filter((g) => plottable(g.lat, g.lon))
              .map((g) => (
              <Marker
                key={`official-${g.id}`}
                position={[g.lat as number, g.lon as number]}
                icon={officialIcon('#06b6d4', 13, `⬥ ${g.id}`)}
                zIndexOffset={400}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <b>⬥ OFFICIAL GAUGE · {g.agency}</b>
                  <br />
                  Level: <b>{g.level} {g.unit === 'cm' ? 'cm' : 'm'}</b>
                  {g.state ? ` (${g.state})` : ''}
                  <br />
                  {g.trend} · {new Date(g.timestamp).toLocaleTimeString('en-GB')} local
                  <br />
                  {g.river}
                  <br />
                  Feed: {g.source}
                </Tooltip>
              </Marker>
            ))}

          {/* US fire incidents (NIFC/WFIGS via wildfiredata.dev — real, hourly) */}
          {layers.incidents &&
            live.fireIncidents
              .filter((fi) => plottable(fi.lat, fi.lon))
              .map((fi) => (
              <Marker
                key={`inc-${fi.id}`}
                position={[fi.lat, fi.lon]}
                icon={pulseIcon(fi.type === 'WF' ? '#f87171' : '#94a3b8', 10, undefined)}
                zIndexOffset={200}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <b>{fi.type === 'WF' ? '🔥 WILDFIRE' : fi.type === 'RX' ? '▮ PRESCRIBED' : '· INCIDENT'}</b> · {fi.name}
                  <br />
                  {fi.acres.toLocaleString()} acres{fi.percentContained != null ? ` · ${fi.percentContained}% contained` : ''}
                  <br />
                  {fi.county ?? fi.state} · discovered {fi.discovered}
                  {fi.cause ? ` · cause: ${fi.cause}` : ''}
                  <br />
                  Feed: {fi.source}
                </Tooltip>
              </Marker>
            ))}

          {/* US fire perimeters — real GeoJSON polygons (largest current fires) */}
          {layers.perimeters &&
            live.firePerimeters.map((p) => {
              const rings = extractRings(p.geometry);
              return rings.map((ring, ri) => (
                <Polygon
                  key={`per-${p.id}-${ri}`}
                  positions={ring}
                  pathOptions={{ color: '#fb923c', weight: 1.6, opacity: 0.9, fillOpacity: 0.18, dashArray: '4 4' }}
                >
                  <Tooltip sticky>
                    <b>🔥 FIRE PERIMETER · {p.name}</b>
                    <br />
                    {p.acres.toLocaleString()} acres{p.percentContained != null ? ` · ${p.percentContained}% contained` : ''}
                    <br />
                    {p.source}
                  </Tooltip>
                </Polygon>
              ));
            })}

          {/* US Drought Monitor — real weekly county categories */}
          {layers.drought &&
            live.usDrought
              .filter((d) => plottable(d.lat, d.lon))
              .map((d) => (
              <CircleMarker
                key={`drt-${d.countyFips}`}
                center={[d.lat, d.lon]}
                radius={9}
                pathOptions={{
                  color: DROUGHT_COLOR[d.droughtClass ?? 'NONE'],
                  weight: 2,
                  fill: true,
                  fillColor: DROUGHT_COLOR[d.droughtClass ?? 'NONE'],
                  fillOpacity: 0.35,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <b>🏜 DROUGHT · {d.countyName}</b>
                  <br />
                  {d.droughtDate ?? '—'} (US Drought Monitor, weekly)
                  <br />
                  D0 {Math.round(d.d0 ?? 0)}% · D1 {Math.round(d.d1 ?? 0)}% · D2 {Math.round(d.d2 ?? 0)}% · D3 {Math.round(d.d3 ?? 0)}% · D4 {Math.round(d.d4 ?? 0)}%
                  <br />
                  Worst: <b>{d.droughtClass}</b> · {live.usDroughtSource}
                </Tooltip>
              </CircleMarker>
            ))}

          {/* EPA daily AQI — real county readings */}
          {layers.aqi &&
            live.countyAqi
              .filter((d) => plottable(d.lat, d.lon))
              .map((d) => (
              <CircleMarker
                key={`aqi-${d.countyFips}`}
                center={[d.lat, d.lon]}
                radius={6}
                pathOptions={{
                  color: aqiColor(d.aqi),
                  weight: 2,
                  fill: true,
                  fillColor: aqiColor(d.aqi),
                  fillOpacity: 0.5,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <b>AQI {d.aqi ?? '—'} · {d.aqiCategory ?? '—'}</b>
                  <br />
                  {d.countyName} · {d.aqiDate ?? '—'} (US EPA, daily)
                  <br />
                  Defining pollutant: {d.aqiPollutant ?? '—'}
                  <br />
                  Feed: {live.countyAqiSource}
                </Tooltip>
              </CircleMarker>
            ))}

          {/* Global CAMS air-quality city grid — real PM2.5/EU-AQI per city */}
          {layers.aqgrid &&
            live.cityAq
              .filter((c) => plottable(c.lat, c.lon))
              .map((c) => (
              <CircleMarker
                key={`aqgrid-${c.city}`}
                center={[c.lat, c.lon]}
                radius={c.euAqi != null && c.euAqi > 100 ? 9 : c.euAqi != null && c.euAqi > 60 ? 7.5 : 5.5}
                pathOptions={{
                  color: euAqiColor(c.euAqi),
                  weight: 2,
                  fill: true,
                  fillColor: euAqiColor(c.euAqi),
                  fillOpacity: 0.55,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <b>AIR QUALITY · {c.city} ({c.region})</b>
                  <br />
                  EU AQI: <b>{c.euAqi ?? '—'}</b> · PM2.5 {c.pm25 ?? '—'} µg/m³
                  <br />
                  PM10 {c.pm10 ?? '—'} · NO₂ {c.no2 ?? '—'} · O₃ {c.o3 ?? '—'}
                  <br />
                  {c.time} (latest CAMS slot)
                  <br />
                  Feed: LIVE:CAMS-AQ-GRID (model-assimilated, city centre)
                </Tooltip>
              </CircleMarker>
            ))}

          {/* JMA AMeDAS — real nationwide observation frame (Japan view) */}
          {layers.amedas &&
            live.amedas
              .filter((s) => plottable(s.lat, s.lon))
              .map((s) => (
              <CircleMarker
                key={`amedas-${s.id}`}
                center={[s.lat, s.lon]}
                radius={s.rain24hMm != null && s.rain24hMm >= 30 ? 7 : s.rain24hMm != null && s.rain24hMm >= 10 ? 6 : s.rain24hMm != null && s.rain24hMm > 0 ? 4.5 : 2.5}
                pathOptions={{
                  color: '#38bdf8',
                  weight: 1,
                  fill: true,
                  fillColor:
                    s.rain24hMm != null && s.rain24hMm >= 30 ? '#4f46e5'
                    : s.rain24hMm != null && s.rain24hMm >= 10 ? '#2563eb'
                    : s.rain24hMm != null && s.rain24hMm > 0 ? '#38bdf8'
                    : '#94a3b8',
                  fillOpacity: s.rain24hMm != null && s.rain24hMm > 0 ? 0.8 : 0.35,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <b>JMA AMEDAS · {s.name}</b>
                  <br />
                  Rain 24h: <b>{s.rain24hMm != null ? `${s.rain24hMm} mm` : '—'}</b> · 1h: {s.rain1hMm != null ? `${s.rain1hMm} mm` : '—'}
                  <br />
                  Temp: {s.tempC != null ? `${s.tempC} °C` : '—'} · wind {s.windMs != null ? `${s.windMs} m/s` : '—'} · RH {s.humidity != null ? `${s.humidity}%` : '—'}
                  <br />
                  {s.time} (JST frame)
                  <br />
                  Feed: LIVE:JMA-AMEDAS (official observation)
                </Tooltip>
              </CircleMarker>
            ))}

          {/* REAL hazard events — only geometry-true events are plotted */}
          {layers.events &&
            live.events.items
              .filter((e) => plottable(e.lat, e.lon))
              .map((e) => (
              <Marker
                key={`event-${e.id}`}
                position={[e.lat as number, e.lon as number]}
                icon={pulseIcon(EVENT_ICON_COLOR[e.kind], 11, e.kind === 'SEISMIC' ? e.detail.split(' ·')[0] : undefined)}
                zIndexOffset={300}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <b>{EVENT_LEGEND[e.kind]}</b> · {e.title}
                  <br />
                  {e.detail} · {e.time}
                  <br />
                  Feed: {e.source}
                </Tooltip>
              </Marker>
            ))}

          {/* Protected sites */}
          {layers.forest &&
            territory.focusSites
              .filter((site) => plottable(site.lat, site.lon))
              .map((site, i) => (
              <Marker key={`site-${i}-${site.name}`} position={[site.lat, site.lon]} icon={pulseIcon('#22c55e', 11, undefined)}>
                <Tooltip direction="top" offset={[0, -6]}>
                  <b>{site.name}</b>
                </Tooltip>
              </Marker>
            ))}
        </MapContainer>
      </div>

      {/* Layer control panel */}
      <div className="absolute right-3 top-3 z-[500] hidden md:block">
        <LayerControl />
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[500] hidden items-center gap-4 rounded-lg border border-grid bg-forest-950/90 px-3.5 py-2 font-mono text-[9px] uppercase tracking-wider text-slate-400 backdrop-blur md:flex">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> FIRMS hotspot (real)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-400" /> GloFAS point</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rotate-45 border-2 border-cyan-400 bg-cyan-400/20" style={{ width: 7, height: 7 }} /> Official gauge (real)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-lime-400 bg-lime-400/30" /> GBIF record (real)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-pink-400 bg-pink-400/30" /> iNaturalist record (real)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" /> Protected site</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" /> Earthquake / warning (real)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-400" /> EONET event (real)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-sky-300/70" /> Rain radar (RainViewer)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-300" /> US fire incidents (real)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 border border-orange-300 bg-orange-300/20" /> Fire perimeters (real)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400/60" /> Drought / AQI (US EPA)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" /> JMA AMeDAS stations (real)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-lime-400" /> CAMS air grid (real)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-300/70" /> VIIRS aerosols (real)</span>
      </div>

      {/* HUD corner ticks */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl border border-moss-400/20" />
      <div className="pointer-events-none absolute left-4 top-4 z-[500] font-mono text-[9px] tracking-widest text-moss-400/80">
        LIVE FEEDS {health.live}/{health.total} · HOTSPOTS {live.hotspots.length} · GAUGES {live.realGauges.length} · RECORDS {occurrenceDots} · EVENTS {live.events.items.length}
      </div>
      <div className="pointer-events-none absolute bottom-12 right-4 z-[500] hidden font-mono text-[9px] tracking-widest text-slate-500 md:block">
        {t('scanner.fwi').toUpperCase()}: {live.index ? `${live.index.fwi} · ${live.index.category}` : 'UNAVAILABLE'}
      </div>
    </div>
  );
}
