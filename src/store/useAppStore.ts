import { create } from 'zustand';
import { translate } from '@/data/translations';
import type { LangCode } from '@/types/environmental';

export interface MapLayers {
  satellite: boolean;
  ndvi: boolean;
  fire: boolean;
  water: boolean;
  official: boolean;
  animal: boolean;
  forest: boolean;
  events: boolean;
  rain: boolean;
  incidents: boolean;
  perimeters: boolean;
  drought: boolean;
  aqi: boolean;
  amedas: boolean;
  aqgrid: boolean;
  cmemsSst: boolean;
  cmemsCur: boolean;
  aod: boolean;
  esri: boolean;
  s2: boolean;
  terrain: boolean;
}

interface AppState {
  territoryCode: string;
  lang: LangCode;
  pilotOpen: boolean;
  satelliteOpacity: number;
  layers: MapLayers;
  setTerritory: (code: string) => void;
  setLang: (lang: LangCode) => void;
  setPilotOpen: (open: boolean) => void;
  setSatelliteOpacity: (v: number) => void;
  toggleLayer: (key: keyof MapLayers, value?: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  territoryCode: 'SI',
  lang: 'en',
  pilotOpen: false,
  satelliteOpacity: 0.85,
  layers: {
    // Default layers ON: real points/data. Heavy raster imagery (GIBS true
    // color, VIIRS aerosols) and the rain radar start OFF — the map loads
    // fast and clean; users opt into imagery per view.
    satellite: false, ndvi: false, fire: true, water: true, official: true, animal: true,
    forest: true, events: true, rain: false, incidents: true, perimeters: true,
    drought: true, aqi: true, amedas: true, aqgrid: true, cmemsSst: false, cmemsCur: false,
    aod: false, esri: true, s2: false, terrain: false,
  },
  setTerritory: (code) => set({ territoryCode: code }),
  setLang: (lang) => set({ lang }),
  setPilotOpen: (pilotOpen) => set({ pilotOpen }),
  setSatelliteOpacity: (satelliteOpacity) => set({ satelliteOpacity }),
  toggleLayer: (key, value) =>
    set((s) => ({ layers: { ...s.layers, [key]: value ?? !s.layers[key] } })),
}));

/** Translation hook bound to the active language (EN fallback). */
export const useT = () => {
  const lang = useAppStore((s) => s.lang);
  return (key: string) => translate(lang, key);
};
