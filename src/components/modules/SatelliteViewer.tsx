import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Flame, Globe2, MapPin } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getTerritory } from '@/data/territoriesData';
import { gibsDate, gibsTrueColorUrl, NDVI_FILTER_CLASS } from '@/services/api/satelliteService';
import { useLive } from '@/hooks/useLiveFeeds';
import { StatusBadge, SourceChip } from '@/components/ui/bits';

function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export function SatelliteViewer() {
  const territoryCode = useAppStore((s) => s.territoryCode);
  const territory = getTerritory(territoryCode);
  const live = useLive();
  const date = gibsDate();

  return (
    <div id="console-satellite" className="scroll-mt-24 glass rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] text-sky-400 uppercase">Console 05 · ORBITA</p>
          <h3 className="mt-1 font-display text-2xl font-bold text-white">Earth Observation & Canopy Explorer</h3>
          <p className="mt-1 font-mono text-[11px] text-slate-500">
            NASA GIBS · MODIS_Terra_CorrectedReflectance_TrueColor · composite {date}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="info">GIBS COMPOSITE: {date}</StatusBadge>
          <SourceChip source="LIVE:NASA-GIBS" />
        </div>
      </div>

      {/* Compare viewer */}
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <ComparePane
          title="TRUE COLOR"
          subtitle="RGB · MODIS TERRA 250 M"
          className=""
          center={territory.mapCenter}
          zoom={territory.zoom > 6.5 ? 6 : territory.zoom}
          date={date}
        />
        <ComparePane
          title="FALSE COLOR · VISUAL FILTER"
          subtitle="CLIENT-SIDE HUE REMAP — VISUALIZATION ONLY, NOT SPECTRAL NDVI"
          className={NDVI_FILTER_CLASS}
          center={territory.mapCenter}
          zoom={territory.zoom > 6.5 ? 6 : territory.zoom}
          date={date}
        />
      </div>

      {/* Live context from real feeds */}
      <div className="mt-6 rounded-2xl border border-grid bg-forest-950/60 p-4">
        <p className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
          <Globe2 size={12} className="text-sky-400" /> Live overlays ingested into the territory view — {territory.name}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <LiveCount
            label="FIRMS hotspots (real)"
            value={live.hotspotsSource === 'LIVE:NASA-FIRMS' ? String(live.hotspots.length) : '—'}
            note={live.hotspotsSource}
            icon={<Flame size={12} className="text-amber-400" />}
          />
          <LiveCount
            label="Official gauges (real)"
            value={live.realGaugesSource.startsWith('LIVE') ? String(live.realGauges.length) : '—'}
            note={live.realGaugesSource}
            icon={<MapPin size={12} className="text-cyan-400" />}
          />
          <LiveCount
            label="Species occurrence records (real)"
            value={String(live.speciesObs.reduce((a, s) => a + s.items.length, 0))}
            note="GBIF + iNaturalist"
            icon={<Globe2 size={12} className="text-lime-400" />}
          />
        </div>
        <p className="mt-5 border-t border-white/5 pt-3 font-mono text-[9px] leading-relaxed text-slate-600">
          THE FALSE-COLOR PANE IS A CLIENT-SIDE HUE REMAP OF REAL GIBS TILES — A VISUAL AID, NOT A SPECTRAL VEGETATION INDEX.
          PRODUCTION TIERS WOULD INGEST REAL SENTINEL-2 NDVI RASTERS FROM THE COPERNICUS DATA SPACE. GIBS REFRESH DAILY ~03:00 UTC.
        </p>
      </div>
    </div>
  );
}

function LiveCount({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
      <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500">{icon}{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold text-sky-300">{value}</p>
      <p className="font-mono text-[8.5px] text-slate-600">{note}</p>
    </div>
  );
}

function ComparePane({
  title,
  subtitle,
  className,
  center,
  zoom,
  date,
}: {
  title: string;
  subtitle: string;
  className: string;
  center: [number, number];
  zoom: number;
  date: string;
}) {
  const ndvi = className.includes(NDVI_FILTER_CLASS);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-grid">
      <div className="h-64">
        <MapContainer center={center} zoom={zoom} minZoom={3} maxZoom={11} scrollWheelZoom={false} className="h-full w-full" attributionControl={false}>
          <TileLayer
            url={gibsTrueColorUrl(date)}
            maxNativeZoom={9}
            maxZoom={11}
            className={className}
          />
          <FlyTo center={center} zoom={zoom} />
        </MapContainer>
      </div>
      {/* scanline */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-scanline h-10 w-full bg-gradient-to-b from-transparent via-sky-400/10 to-transparent" />
      </div>
      <div className="absolute left-3 top-3 rounded border border-white/10 bg-forest-950/85 px-2.5 py-1 font-mono text-[9px] font-bold tracking-widest text-sky-300 backdrop-blur">
        {title}
      </div>
      <div className="absolute bottom-3 left-3 rounded border border-white/10 bg-forest-950/85 px-2.5 py-1 font-mono text-[8px] tracking-wider text-slate-500 backdrop-blur">
        {subtitle}
      </div>
      {ndvi && (
        <div className="absolute bottom-3 right-3 rounded border border-lime-400/30 bg-forest-950/85 px-2.5 py-1 font-mono text-[8px] tracking-wider text-lime-300 backdrop-blur">
          HIGH BIOMASS ● MEDIUM ● SPARSE
        </div>
      )}
    </div>
  );
}
