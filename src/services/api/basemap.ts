/**
 * Basemap URL builders.
 *
 * CARTO serves its raster basemaps from basemaps.cartocdn.com. Since
 * 25 September 2026 the raster endpoint requires an API key — requests
 * without a usable `key` parameter receive a watermark tile reading
 * "API KEY REQUIRED" (docs: docs.carto.com/faqs/carto-basemaps).
 *
 * The key is a free CARTO Basemaps key (carto.com/basemaps/apikey) supplied
 * through the VITE_CARTO_API_KEY environment variable (.env.local). It is
 * designed to be embedded in client tile URLs; restrict it by host in the
 * CARTO basemaps dashboard for production use.
 */

const CARTO_KEY = import.meta.env.VITE_CARTO_API_KEY ?? '';

const withKey = (url: string): string => (CARTO_KEY ? `${url}?key=${encodeURIComponent(CARTO_KEY)}` : url);

/** Dark-Matter raster style (Light/Dark canvas for the operational map). */
export const cartoDarkBasemapUrl = withKey('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
