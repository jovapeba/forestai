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
  aod: boolean;
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
    satellite: true, ndvi: false, fire: true, water: true, official: true, animal: true,
    forest: true, events: true, rain: true, incidents: true, perimeters: true,
    drought: true, aqi: true, amedas: true, aqgrid: true, aod: true, s2: false, terrain: false,
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
