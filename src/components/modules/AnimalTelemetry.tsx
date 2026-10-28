import { useMemo, useState } from 'react';
import { Bird, Binoculars, Globe2, MapPin, PawPrint, Camera } from 'lucide-react';
import { useLive } from '@/hooks/useLiveFeeds';
import { useAppStore } from '@/store/useAppStore';
import { getTerritory, parseSpecies } from '@/data/territoriesData';
import { StatusBadge, SourceChip } from '@/components/ui/bits';
import type { SpeciesObservations } from '@/types/environmental';

type Tab = 'sightings' | 'country' | 'habitat';

const TABS: { key: Tab; label: string }[] = [
  { key: 'sightings', label: 'FLAGSHIP SPECIES' },
  { key: 'country', label: 'COUNTRY WINDOW' },
  { key: 'habitat', label: 'PROTECTED AREAS' },
];

export function AnimalTelemetry() {
  const territoryCode = useAppStore((s) => s.territoryCode);
  const territory = getTerritory(territoryCode);
  const live = useLive();
  const [speciesIdx, setSpeciesIdx] = useState(0);
  const [tab, setTab] = useState<Tab>('sightings');

  const speciesList = useMemo(() => territory.species.map(parseSpecies), [territory]);
  const selected = speciesList[Math.min(speciesIdx, speciesList.length - 1)];
  const gbif = live.speciesObs.find((s) => s.species === selected.latin && s.dataset === 'LIVE:GBIF');
  const inat = live.speciesObs.find((s) => s.species === selected.latin && s.dataset === 'LIVE:INATURALIST');
  const anyLive = live.speciesObs.some((s) => s.source.startsWith('LIVE'));

  const totalReal = live.speciesObs.reduce((a, s) => a + s.items.length, 0);

  return (
    <div id="console-animal" className="scroll-mt-24 glass rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] text-lime-400 uppercase">Console 04 · FAUNA</p>
          <h3 className="mt-1 font-display text-2xl font-bold text-white">Real Wildlife Observations & Biodiversity</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={anyLive ? 'ok' : 'warn'}>{totalReal} REAL RECORDS</StatusBadge>
          <SourceChip source={anyLive ? 'LIVE:GBIF' : 'UNAVAILABLE'} />
        </div>
      </div>

      {/* Species selector */}
      <div className="mt-6 flex flex-wrap gap-2">
        {speciesList.map((sp, i) => (
          <button
            key={sp.latin}
            onClick={() => setSpeciesIdx(i)}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-left transition-all ${
              i === speciesIdx ? 'border-lime-400/50 bg-lime-400/10' : 'border-white/10 bg-white/[0.02] hover:border-lime-400/30'
            }`}
          >
            <PawPrint size={14} className={i === speciesIdx ? 'text-lime-300' : 'text-slate-500'} />
            <span>
              <span className="block font-mono text-[11px] font-bold text-white">{sp.commonName}</span>
              <span className="block font-mono text-[9px] italic text-slate-500">{sp.latin}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-1 rounded-xl border border-grid bg-forest-950/70 p-1">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-mono text-[9.5px] font-bold tracking-wider transition-all ${
              tab === tb.key ? 'bg-lime-400/15 text-lime-300 shadow-[inset_0_0_0_1px_rgba(163,230,53,0.4)]' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div className="mt-5 min-h-[160px]">
        {tab === 'sightings' && selected && (
          <div className="grid gap-4 lg:grid-cols-2">
            <DatasetPanel obs={gbif} selected={selected} icon={<Globe2 size={13} />} />
            <DatasetPanel obs={inat} selected={selected} icon={<Camera size={13} />} />
          </div>
        )}
        {tab === 'sightings' && !selected && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center">
            <p className="font-mono text-[10px] tracking-widest text-slate-400">
              NO FLAGSHIP SPECIES SET FOR THIS VIEW — SEE THE LIVE COUNTRY/GLOBAL WINDOW TAB
            </p>
          </div>
        )}
        {tab === 'country' && (
          <div className="rounded-2xl border border-grid bg-forest-950/60 p-4">
            <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
              <Bird size={12} className="text-lime-400" />
              {territory.global ? 'Global Recent Records — GBIF (last 30 days)' : `Country Biodiversity Window — GBIF (${territory.gbifCountry})`}
            </p>
            {live.occurrences.length > 0 ? (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {live.occurrences.slice(0, 12).map((o, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 font-mono text-[10px] text-slate-400">
                    <span className="h-1 w-1 rounded-full bg-lime-400" />
                    <span className="flex-1 truncate text-slate-300">{o.species}</span>
                    <span className="text-slate-600">{o.date}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center font-mono text-[10px] tracking-widest text-red-300">
                {live.booted ? 'GBIF WINDOW UNAVAILABLE — NO DATA SHOWN' : 'RESOLVING GBIF…'}
              </p>
            )}
          </div>
        )}
        {tab === 'habitat' && (
          <div className="rounded-2xl border border-grid bg-forest-950/60 p-5">
            <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
              <Binoculars size={12} className="text-lime-400" /> Protected areas in {territory.name} — real designations
            </p>
            {territory.protectedAreas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {territory.protectedAreas.map((a) => (
                  <span key={a} className="flex items-center gap-1.5 rounded-lg border border-lime-400/25 bg-lime-400/[0.06] px-3 py-2 text-[12px] text-lime-200">
                    <MapPin size={11} className="text-lime-400" /> {a}
                  </span>
                ))}
              </div>
            ) : (
              <p className="font-mono text-[10px] tracking-widest text-slate-500">
                TERRITORY-SCOPED PANEL — NOT APPLICABLE IN THE GLOBAL VIEW
              </p>
            )}
            <p className="mt-4 font-mono text-[9px] leading-relaxed text-slate-600">
              NAMED PROTECTED AREAS ARE FACTUAL DESIGNATIONS · OCCURRENCE DOTS ON THE MAP ARE REAL GBIF/INATURALIST RECORDS ·
              NO COLLAR TELEMETRY IS SIMULATED (MOVEBANK EVENT STREAMS REQUIRE INSTITUTIONAL ACCESS AND ARE NOT USED)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------- one real dataset (GBIF / iNat) -------------------- */

function DatasetPanel({
  obs,
  selected,
  icon,
}: {
  obs?: SpeciesObservations;
  selected: { commonName: string; latin: string };
  icon: React.ReactNode;
}) {
  const live = obs && obs.source.startsWith('LIVE');
  const title = obs?.dataset === 'LIVE:INATURALIST' ? 'INATURALIST' : 'GBIF';
  return (
    <div className="rounded-2xl border border-grid bg-forest-950/60 p-4">
      <p className="flex items-center justify-between font-mono text-[9px] font-bold tracking-widest text-slate-500">
        <span className="flex items-center gap-2">
          {icon} {title} · {selected.commonName.toUpperCase()}
        </span>
        <SourceChip source={obs ? obs.source : 'UNAVAILABLE'} />
      </p>
      {live && obs ? (
        <div className="mt-3 space-y-1">
          {obs.items.slice(0, 5).map((o, i) => (
            <p key={i} className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
              <span className="h-1 w-1 rounded-full bg-lime-400" />
              <span className="text-slate-300">{o.lat.toFixed(3)}°, {o.lon.toFixed(3)}°</span>
              <span className="text-slate-600">{o.date}</span>
              <span className="ml-auto text-slate-600">{o.source}</span>
            </p>
          ))}
          <p className="mt-2 text-[9px] leading-relaxed text-slate-600">
            GENUINE GEO-REFERENCED RECORDS FROM THE {title} NETWORK — REAL FIELD/CITIZEN GROUND TRUTH FOR THIS SPECIES.
          </p>
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-4 font-mono text-[9.5px] text-slate-600">
          {obs ? 'NO GEO-REFERENCED RECORDS RESOLVED FOR THIS SPECIES IN THIS DATASET.' : 'DATASET UNAVAILABLE — NO DATA SHOWN.'}
        </p>
      )}
    </div>
  );
}
