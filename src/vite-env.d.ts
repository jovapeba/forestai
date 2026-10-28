/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** CARTO Basemaps API key (free key from carto.com/basemaps/apikey). */
  readonly VITE_CARTO_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
