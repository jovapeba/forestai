import { Droplets, Flame, Layers, MapPin, Mountain, Radar, Sparkles, Waves, Wind } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { gibsDate } from '@/services/api/satelliteService';
import type { MapLayers } from '@/store/useAppStore';

const LAYER_META: { key: keyof MapLayers; label: string; color: string; icon: React.ReactNode }[] = [
  { key: 'satellite', label: 'NASA GIBS TRUE-COLOR', color: '#38bdf8', icon: <Sparkles size={13} /> },
  { key: 'ndvi', label: 'FALSE-COLOR VISUAL FILTER', color: '#a3e635', icon: <Layers size={13} /> },
  { key: 'fire', label: 'FIRMS HOTSPOTS (REAL)', color: '#f59e0b', icon: <Radar size={13} /> },
  { key: 'water', label: 'GLOFAS FORECAST POINTS', color: '#14b8a6', icon: <Waves size={13} /> },
  { key: 'official', label: 'OFFICIAL GAUGES (REAL)', color: '#06b6d4', icon: <MapPin size={13} /> },
  { key: 'animal', label: 'GBIF / INATURALIST RECORDS', color: '#4ade80', icon: <MapPin size={13} /> },
  { key: 'forest', label: 'PROTECTED SITES', color: '#22c55e', icon: <MapPin size={13} /> },
  { key: 'events', label: 'REAL EVENTS · EQ · CAP', color: '#ef4444', icon: <Radar size={13} /> },
  { key: 'rain', label: 'RAIN RADAR (REAL)', color: '#38bdf8', icon: <Waves size={13} /> },
  { key: 'incidents', label: 'US FIRE INCIDENTS (REAL)', color: '#f87171', icon: <Flame size={13} /> },
  { key: 'perimeters', label: 'FIRE PERIMETERS (REAL)', color: '#fb923c', icon: <Layers size={13} /> },
  { key: 'drought', label: 'US DROUGHT MONITOR (REAL)', color: '#fbbf24', icon: <Droplets size={13} /> },
  { key: 'aqi', label: 'EPA COUNTY AQI (REAL)', color: '#a78bfa', icon: <Wind size={13} /> },
  { key: 'amedas', label: 'JMA AMEDAS STATIONS (REAL)', color: '#7dd3fc', icon: <Droplets size={13} /> },
  { key: 'aqgrid', label: 'GLOBAL AIR GRID · CAMS (REAL)', color: '#a3e635', icon: <Wind size={13} /> },
  { key: 'aod', label: 'SATELLITE AEROSOLS · VIIRS AOD', color: '#c4b5fd', icon: <Sparkles size={13} /> },
  { key: 'esri', label: 'WORLD IMAGERY · HIGH-RES', color: '#e2e8f0', icon: <Mountain size={13} /> },
  { key: 's2', label: 'SENTINEL-2 CLOUDLESS IMAGERY', color: '#e2e8f0', icon: <Sparkles size={13} /> },
  { key: 'terrain', label: 'TERRAIN CONTOURS (OPENTOPOMAP)', color: '#94a3b8', icon: <Mountain size={13} /> },
];

export function LayerControl() {
  const layers = useAppStore((s) => s.layers);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const opacity = useAppStore((s) => s.satelliteOpacity);
  const setOpacity = useAppStore((s) => s.setSatelliteOpacity);

  return (
    <div className="w-60 max-h-[520px] overflow-y-auto thin-scroll rounded-xl border border-grid bg-forest-950/90 p-3.5 shadow-2xl backdrop-blur-md">
      <p className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
        <Layers size={12} className="text-moss-400" /> Layer Control
      </p>
      <div className="space-y-1">
        {LAYER_META.map((l) => {
          const disabled = l.key === 'ndvi' && !layers.satellite;
          const on = layers[l.key];
          return (
            <button
              key={l.key}
              disabled={disabled}
              onClick={() => toggleLayer(l.key)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                disabled ? 'opacity-35' : 'hover:bg-white/5'
              }`}
            >
              <span
                className={`relative h-3.5 w-6 shrink-0 rounded-full transition-colors ${
                  on ? 'bg-moss-400/80' : 'bg-white/15'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${
                    on ? 'left-3' : 'left-0.5'
                  }`}
                />
              </span>
              <span className="flex-1 font-mono text-[9.5px] font-semibold tracking-wider text-slate-300">
                {l.label}
              </span>
              <span style={{ color: on ? l.color : '#475569' }}>{l.icon}</span>
            </button>
          );
        })}
      </div>

      {layers.satellite && (
        <div className="mt-3 border-t border-grid pt-3">
          <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-slate-500">
            <span>GIBS OPACITY</span>
            <span className="text-moss-400">{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.15}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="mt-2 w-full"
          />
          <p className="mt-1.5 font-mono text-[9px] tracking-wider text-slate-600">
            ORBIT DATE: <span className="text-cyan-300">{gibsDate()}</span> · 03:00 UTC COMPOSITE
          </p>
        </div>
      )}
    </div>
  );
}
