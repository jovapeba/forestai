import { fetchWithTimeout } from './http';

/**
 * FLUVIA/SENTRY support — Copernicus Marine Service (CMEMS) ocean layers.
 *
 * The CMEMS WMTS endpoint (https://wmts.marine.copernicus.eu/teroWmts) is
 * ANONYMOUS — map tiles, JSON legends and GetFeatureInfo point values need
 * no account (verified October 2026, CORS `access-control-allow-origin: *`).
 * A Copernicus Marine account is only required for bulk download via the
 * Toolbox/MOTU, which this platform does not do.
 *
 * Layer path format: <PRODUCT_ID>/<DATASET_ID>/<VARIABLE>
 * Tile URL: GetTile with EPSG:3857 WebMercatorQuad — drop-in {z}/{y}/{x}.
 * Point values: GetFeatureInfo (JSON) — lat/lon converted to tile + pixel.
 */

export interface CmemsLayerDef {
  id: string;
  label: string;
  /** WMTS layer path: PRODUCT/DATASET/VARIABLE */
  layer: string;
  /** depth slice (WMTS `elevation`), omit for surface */
  elevation?: string;
  /** WMTS STYLE string (cmap/range/vectorStyle…) */
  style?: string;
  opacity: number;
  unitLabel: string;
}

// Global forecast physics + NRT altimetry — daily-refreshed datasets.
export const CMEMS_SST: CmemsLayerDef = {
  id: 'sst',
  label: 'Sea surface temperature',
  layer: 'GLOBAL_ANALYSISFORECAST_PHY_001_024/cmems_mod_glo_phy-thetao_anfc_0.083deg_PT6H-i_202406/thetao',
  elevation: '0',
  style: undefined,
  opacity: 0.72,
  unitLabel: '°C',
};

export const CMEMS_CURRENTS: CmemsLayerDef = {
  id: 'currents',
  label: 'Sea surface currents',
  layer: 'GLOBAL_ANALYSISFORECAST_PHY_001_024/cmems_mod_glo_phy-cur_anfc_0.083deg_PT6H-i_202406/sea_water_velocity',
  style: 'vectorStyle:solidAndVector,cmap:speed',
  opacity: 0.8,
  unitLabel: 'm/s',
};

export const CMEMS_SEA_LEVEL: CmemsLayerDef = {
  id: 'seaLevel',
  label: 'Sea surface height (ADT)',
  layer: 'SEALEVEL_GLO_PHY_L4_NRT_008_046/cmems_obs-sl_glo_phy-ssh_nrt_allsat-l4-duacs-0.25deg_P1D_202311/adt',
  style: 'cmap:plasma',
  opacity: 0.72,
  unitLabel: 'm',
};

const HOST = 'https://wmts.marine.copernicus.eu/teroWmts';

/** Today's UTC date — CMEMS forecast datacubes are refreshed daily. */
const todayIso = (): string => `${new Date().toISOString().slice(0, 10)}T00:00:00.000000000Z`;

/**
 * WMTS GetTile as a Leaflet-compatible {z}/{y}/{x} template. The EPSG:3857
 * tilematrixset is WebMercatorQuad (256 px tiles) — identical numbering to
 * the standard XYZ pyramid.
 */
export function cmemsTileUrl(def: CmemsLayerDef): string {
  const params = new URLSearchParams({
    service: 'WMTS',
    request: 'GetTile',
    version: '1.0.0',
    layer: def.layer,
    tilematrixset: 'EPSG:3857',
    tilematrix: '{z}',
    tilerow: '{y}',
    tilecol: '{x}',
    time: todayIso(),
  });
  if (def.elevation != null) params.set('elevation', def.elevation);
  if (def.style) params.set('STYLE', def.style);
  return `${HOST}/?${params.toString()}`;
}

/** Lat/lon → WebMercator tile + in-tile pixel (for GetFeatureInfo i/j). */
function latLonToTile(lat: number, lon: number, z: number): { col: number; row: number; i: number; j: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85.05) return null;
  const n = 2 ** z;
  const xt = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yt = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const col = Math.floor(xt);
  const row = Math.floor(yt);
  const i = Math.floor((xt - col) * 256);
  const j = Math.floor((yt - row) * 256);
  return { col, row, i, j };
}

export interface CmemsValue {
  value: number;
  units: string;
  variableId: string;
  lat: number;
  lon: number;
}

/**
 * Real ocean value at a point via WMTS GetFeatureInfo (JSON). z=10 gives
 * ~38 m/px granularity — well below the 0.083° dataset resolution.
 */
export async function fetchCmemsValue(
  lat: number,
  lon: number,
  def: CmemsLayerDef,
  zoom = 10,
): Promise<CmemsValue | null> {
  const tile = latLonToTile(lat, lon, zoom);
  if (!tile) return null;
  const params = new URLSearchParams({
    service: 'WMTS',
    request: 'GetFeatureInfo',
    layer: def.layer,
    tilematrixset: 'EPSG:3857',
    tilematrix: String(zoom),
    tilerow: String(tile.row),
    tilecol: String(tile.col),
    i: String(tile.i),
    j: String(tile.j),
    INFOFORMAT: 'application/json',
    time: todayIso(),
  });
  if (def.elevation != null) params.set('elevation', def.elevation);
  if (def.style) params.set('STYLE', def.style);
  try {
    const res = await fetchWithTimeout(`${HOST}/?${params.toString()}`, 12000);
    const json = (await res.json()) as {
      features?: { properties?: { value?: number; units?: string; variableId?: string; lat?: number; lon?: number } }[];
    };
    const p = json?.features?.[0]?.properties;
    if (!p || typeof p.value !== 'number' || !Number.isFinite(p.value)) return null;
    return {
      value: Number(p.value.toFixed(3)),
      units: String(p.units ?? def.unitLabel),
      variableId: String(p.variableId ?? def.id),
      lat: Number(p.lat ?? lat),
      lon: Number(p.lon ?? lon),
    };
  } catch {
    return null;
  }
}
