import type { Territory } from '@/types/environmental';

/**
 * ORBITA — NASA GIBS EPSG:3857 WMTS helpers.
 * MODIS Terra corrected-reflectance true color, refreshed daily ~03:00 UTC.
 * This is real satellite imagery streamed as tiles.
 */
export const gibsDate = (offsetDays = 1): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
};

export const gibsTrueColorUrl = (date = gibsDate()): string =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;

/**
 * Satellite air quality — VIIRS SNPP Deep Blue aerosol optical depth (AOD).
 * Real retrievals of smoke / dust / haze column loading, daily, global,
 * CORS-open, no key. Verified live October 2026 (L0-L6 tiles).
 */
export const gibsAodUrl = (date = gibsDate()): string =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_AOD_Deep_Blue_Land_Ocean/default/${date}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`;

/**
 * NDVI visual filter. The false-color composite is a CLIENT-SIDE HUE REMAP of
 * the GIBS true-color tiles — a visualization aid, not a spectral vegetation
 * index. It must never be presented as measured NDVI; the UI labels it
 * "VISUAL FILTER — NOT SPECTRAL DATA". Production tiers would compute real
 * NDVI from Sentinel-2 L2A via the Copernicus Data Space.
 */
export const NDVI_FILTER_CLASS = 'gibs-ndvi';
