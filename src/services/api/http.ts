/**
 * Hardened fetch helper: every public-API call races a timeout and
 * degrades gracefully so the platform never shows a broken state.
 *
 * An explicit User-Agent is sent where the environment allows it: browsers
 * ignore it (protected header) but Node/undici sends it — several CDN edges
 * (e.g. air-quality-api.open-meteo.com, hubeau.eaufrance.fr) reject or drop
 * headerless requests while accepting any named agent.
 */
export async function fetchWithTimeout(url: string, timeoutMs = 9000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'verdant/1.0 (open environmental data viewer)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * No-CORS hosts (FIRMS CSV, MeteoAlarm CAP, Hub'Eau) are unreachable from a
 * plain browser. When the app is served by the bundled nginx image (or the
 * Vite dev server) a same-origin proxy path exists; a plain static host has
 * none. This helper tries the proxy path first, then falls back to the
 * direct URL — so deployments with the proxy get live no-CORS feeds while
 * bare static hosting degrades honestly to UNAVAILABLE.
 *
 * A same-origin path on a proxy-less static server answers with the SPA
 * fallback (200 + text/html); such responses are rejected as "proxy absent"
 * so the direct URL still gets its chance.
 */
export async function fetchFirstReachable(
  candidates: string[],
  timeoutMs = 12000,
): Promise<Response> {
  let lastErr: unknown = null;
  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, timeoutMs);
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('text/html')) {
        lastErr = new Error(`proxy absent (SPA fallback) for ${url}`);
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('all fetch candidates failed');
}

export const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
