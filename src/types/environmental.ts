/**
 * VERDANT — TypeScript schemas for every environmental data model.
 *
 * DATA POLICY: every value rendered in the UI originates from a real public
 * API (NASA FIRMS, Open-Meteo, Copernicus GloFAS, USGS, WSV Pegelonline,
 * UK Environment Agency, GBIF, iNaturalist) or is a transparent derivation
 * from such data (labelled DERIVED:*). When a feed is unreachable the UI
 * shows an explicit UNAVAILABLE state — nothing is simulated.
 */

export type LangCode = 'sr' | 'sl' | 'en' | 'de' | 'ar' | 'zh';

export type FeedSource =
  | 'LIVE:OPEN-METEO'
  | 'LIVE:GLOFAS'
  | 'LIVE:GBIF'
  | 'LIVE:INATURALIST'
  | 'LIVE:NASA-FIRMS'
  | 'LIVE:USGS'
  | 'LIVE:USGS-EQ'
  | 'LIVE:WSV-PEGELONLINE'
  | 'LIVE:UK-EA'
  | 'LIVE:EONET'
  | 'LIVE:METEOALARM'
  | 'LIVE:NWS-ALERTS'
  | 'LIVE:RAINVIEWER'
  | 'LIVE:NVE-NORWAY'
  | 'LIVE:HUBEAU'
  | 'LIVE:IMGW-POLAND'
  | 'LIVE:CHMI-CZECH'
  | 'LIVE:JMA-JAPAN'
  | 'LIVE:JMA-AMEDAS'
  | 'LIVE:CAMS-AQ-GRID'
  | 'LIVE:US-FIRE-INCIDENTS'
  | 'LIVE:US-FIRE-PERIMETERS'
  | 'LIVE:US-DROUGHT-MONITOR'
  | 'LIVE:EPA-AQI'
  | 'LIVE:GDACS'
  | 'DERIVED:OPEN-METEO'
  | 'NOT-APPLICABLE'
  | 'UNAVAILABLE';

export type FwiCategory = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
export type ThreatLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'CRITICAL';
export type StationStatus = 'NOMINAL' | 'ELEVATED' | 'ALERT';

/* ------------------------------------------------------------------ */
/* Territory                                                           */
/* ------------------------------------------------------------------ */

/**
 * A sovereign territory preset. Contains only factual, verifiable
 * configuration: real coordinates of real rivers/places, real protected
 * areas, real species. All measured values arrive from live feeds.
 */
export interface Territory {
  code: string;           // ISO-2, or 'GL' for the global earth view
  name: string;
  flag: string;
  capital: string;
  coords: { lat: number; lon: number };
  mapCenter: [number, number];
  zoom: number;
  bbox: [number, number, number, number]; // [west, south, east, north]
  focusLabel: string;
  focusSites: { name: string; lat: number; lon: number }[];
  analysisPoints: { fire: [number, number]; water: [number, number]; forest: [number, number] };
  basin: string;          // river-basin focus, informational
  protectedAreas: string[];
  species: string[];      // "Common Name (Latin name)"
  hydroPoints: HydroPoint[]; // real river locations queried against GloFAS
  gbifCountry: string;
  global?: boolean;       // true → worldwide feeds, no territory filters
}

/** Real river location used as a GloFAS forecast query point. */
export interface HydroPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/* ------------------------------------------------------------------ */
/* IGNIS                                                           */
/* ------------------------------------------------------------------ */

export interface FireHotspot {
  id: string;
  lat: number;
  lon: number;
  frp: number; // Fire Radiative Power, MW
  confidence: 'l' | 'n' | 'h';
  acqDate: string;
  acqTime: string;
  satellite: string;
  dayNight: 'D' | 'N';
  vegetation: string;
}

export interface WindData {
  speed: number;  // km/h
  dir: number;    // degrees
  gust: number;   // km/h
}

export interface FireWeather {
  temp: number;      // °C
  humidity: number;  // %
  wind: WindData;
  weatherCode?: number; // WMO code (95/96/99 = thunderstorm; rain codes ≥ 51)
  precipitation?: number; // mm — current precipitation
  lightningMax?: number | null; // J/kg — max lightning_potential over next ~8 h (Open-Meteo CAMS slot)
  source: FeedSource;
}

export interface FireIndex {
  fwi: number; // Fire Weather Index 0–100 (derived from live weather)
  category: FwiCategory;
  droughtCode: number;
  source: FeedSource;
}

/* ------------------------------------------------------------------ */
/* FLUVIA                                                          */
/* ------------------------------------------------------------------ */

/** GloFAS (Copernicus) modelled daily river discharge. */
export interface HydrographPoint {
  date: string;
  label: string;
  discharge: number; // m³/s — GloFAS ensemble forecast
  mean: number;      // m³/s — GloFAS climatological mean (real, from API)
  max: number;       // m³/s — ensemble max
  min: number;       // m³/s — ensemble min
}

export interface FloodAlert {
  date: string;
  discharge: number;
  mean: number;
  ratio: number; // discharge / climatological mean
  alert: 'NONE' | 'WATCH' | 'WARNING' | 'SEVERE';
}

/* ------------------------------------------------------------------ */
/* FAUNA                                                         */
/* ------------------------------------------------------------------ */

/** One real, geo-referenced species observation. */
export interface Occurrence {
  species: string;   // latin name
  lat: number;
  lon: number;
  date: string;
  source: string;    // dataset label, e.g. 'GBIF:HUMAN_OBSERVATION' or 'INAT:needs_id'
}

/** A real natural-hazard event (earthquake, EONET event, official warning). */
export interface EnvironmentalEvent {
  id: string;
  kind: 'SEISMIC' | 'NATURAL' | 'MET-WARNING';
  title: string;
  lat?: number;
  lon?: number;
  detail: string;    // magnitude+depth / event category / severity+area
  time: string;      // ISO or date string
  source: FeedSource;
}

/** Real precipitation radar mosaic tile base (RainViewer — free, global). */
export interface RainRadar {
  framePath: string | null;   // tilecache path of the latest radar frame
  frameTime: number | null;   // unix seconds of the frame
  source: FeedSource;
}

/** Current air quality at the forest analysis point (CAMS model, Open-Meteo). */
export interface AirQuality {
  europeanAqi: number;
  pm25: number;      // µg/m³
  pm10: number;
  ozone: number;
  no2: number;
  so2: number;
  co: number;
}

/** Species occurrence bundle from one dataset (GBIF or iNaturalist). */
export interface SpeciesObservations {
  species: string;      // latin name
  commonName: string;
  dataset: 'LIVE:GBIF' | 'LIVE:INATURALIST';
  items: Occurrence[];
  source: FeedSource;
}

/* ------------------------------------------------------------------ */
/* CANOPY / SATELLITE                                             */
/* ------------------------------------------------------------------ */

export interface SoilPoint {
  time: string;
  l0_1: number;  // m³/m³ × 100 for readability
  l1_3: number;
  l3_9: number;
  l9_27: number;
}

/* ------------------------------------------------------------------ */
/* FLUVIA — real official gauges                                   */
/* ------------------------------------------------------------------ */

export interface RealGauge {
  id: string;        // agency station identifier (shortname / site no. / notation)
  name: string;
  river: string;
  lat?: number;
  lon?: number;
  level: number;     // stage in the agency's native unit
  unit: 'm' | 'cm';  // normalized for display
  state?: string;    // agency classification (low / normal / high …)
  timestamp: string; // measurement timestamp (ISO)
  agency: string;    // e.g. 'USGS NWIS', 'WSV PEGELONLINE', 'UK ENVIRONMENT AGENCY'
  source: FeedSource;
  status: StationStatus;
  trend: 'RISING' | 'STEADY' | 'FALLING';
  trendSpan?: number; // absolute change across the analysis window (native unit)
}

/* ------------------------------------------------------------------ */
/* FLUVIA — USGS daily observed flow (waterdata.dev)                   */
/* ------------------------------------------------------------------ */

export interface UsgsDailyValue {
  date: string;
  cfs: number;         // ft³/s as published
  cms: number;         // m³/s (× 0.0283168)
  provisional: boolean;
  estimated: boolean;
  ice: boolean;
}

export interface UsgsDailyGage {
  siteId: string;          // usgs-<site number> (waterdata.dev key)
  siteNumber: string;      // 8-15 digit USGS number
  name: string;
  lat: number;
  lon: number;
  drainageAreaMi2: number;
  state?: string;
  dailyEnd: string;        // latest day of the record
  series: UsgsDailyValue[]; // last 30 days, daily mean
}

/* ------------------------------------------------------------------ */
/* IGNIS — US fire incidents & perimeters (wildfiredata.dev)           */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* CANOPY — US drought & AQI county indices                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* SENTRY — incidents & SITREP                                   */
/* ------------------------------------------------------------------ */

export interface Incident {
  id: string;
  code: string;
  title: string;
  location: string;
  severity: ThreatLevel;
  cascade: {
    layer: 'SATELLITE' | 'FIRE' | 'BASIN' | 'SPECIES' | 'CIVIL';
    status: 'ACTIVE' | 'TRIGGERED' | 'MONITOR' | 'STANDBY';
    detail: string;
  }[];
}

export interface CascadeStep {
  layer: Incident['cascade'][number]['layer'];
  status: Incident['cascade'][number]['status'];
  detail: string;
}

export interface DispatchAction {
  agency: 'FORESTRY' | 'WATER AUTHORITY' | 'CIVIL DEFENSE' | 'WILDLIFE SERVICE' | 'STATE COMMAND';
  action: string;
  priority: 'P1' | 'P2' | 'P3';
  eta: string;
}

export interface SITREP {
  id: string;
  incidentCode: string;
  timestamp: string;
  threatLevel: ThreatLevel;
  confidencePct: number;
  summary: string;
  cascade: CascadeStep[];
  actions: DispatchAction[];
  dataSources: string[];
}
