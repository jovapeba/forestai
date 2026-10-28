import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // FIRMS emits no CORS headers for browser fetches — proxy it in dev so
      // the live NASA feed actually reaches the virtual grid. In production
      // static hosting a server-side proxy is required (see README).
      '/firms-csv': {
        target: 'https://firms.modaps.eosdis.nasa.gov',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/firms-csv/, ''),
      },
      // MeteoAlarm national CAP warning feeds also emit no CORS headers.
      '/meteoalarm': {
        target: 'https://feeds.meteoalarm.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/meteoalarm/, ''),
      },
      // Hub'Eau (French hydrometry) also emits no CORS headers.
      '/hubeau': {
        target: 'https://hubeau.eaufrance.fr',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/hubeau/, ''),
      },
    },
  },
});
