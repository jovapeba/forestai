import { useMemo, useState } from 'react';
import { Building2, Database, Compass, Crosshair, Leaf, MountainSnow, Search, Waves } from 'lucide-react';
import { TERRITORIES } from '@/data/territoriesData';
import { useAppStore, useT } from '@/store/useAppStore';
import { SectionHeading, StatusBadge, SourceChip } from '@/components/ui/bits';
import { useLive } from '@/hooks/useLiveFeeds';
import type { FwiCategory } from '@/types/environmental';

const FWI_COLOR: Record<FwiCategory, string> = {
  LOW: '#4ade80',
  MODERATE: '#f59e0b',
  HIGH: '#f97316',
  EXTREME: '#ef4444',
};

export function TerritoryScanner() {
  const t = useT();
  const territoryCode = useAppStore((s) => s.territoryCode);
  const setTerritory = useAppStore((s) => s.setTerritory);
  const live = useLive();
  const [query, setQuery] = useState('');

  const active = TERRITORIES.find((tr) => tr.code === territoryCode) ?? TERRITORIES[0];
  const filtered = useMemo(
    () => TERRITORIES.filter((tr) => tr.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  const liveDischarge = live.hydro[0]?.discharge;
  const liveDischargeSource = live.hydroSource === 'LIVE:GLOFAS' ? 'GloFAS modelled' : '—';
  const fwi = live.index;
  const fwiColor = fwi ? FWI_COLOR[fwi.category] : '#64748b';
  const isGlobal = live.viewMode === 'global';

  return (
    <section id="global" className="relative scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          kicker="01 · GLOBAL"
          title={t('scanner.title')}
          sub={t('scanner.sub')}
        />

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Search & presets */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-3 rounded-xl border border-grid bg-forest-950/70 px-4 py-3">
              <Search size={16} className="text-moss-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('scanner.search')}
                className="w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
              />
              <Crosshair size={15} className="animate-glow text-moss-400" />
            </div>
            <div className="mt-4 grid gap-2">
              {filtered.map((tr) => (
                <button
                  key={tr.code}
                  onClick={() => setTerritory(tr.code)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                    tr.code === territoryCode
                      ? 'border-moss-400/50 bg-moss-400/10 shadow-[inset_0_0_24px_rgba(74,222,128,0.08)]'
                      : 'border-white/8 bg-white/[0.02] hover:border-moss-400/30 hover:bg-moss-400/5'
                  }`}
                >
                  <span className="text-xl">{tr.flag}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-white">{tr.name}</span>
                    <span className="block font-mono text-[10px] text-slate-500">{tr.focusLabel}</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-600">{tr.code}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-2 py-4 text-center font-mono text-[11px] text-slate-600">NO TERRITORY SIGNAL MATCH</p>
              )}
            </div>
          </div>

          {/* Dynamic territory card */}
          <div key={active.code} className="glass relative overflow-hidden rounded-2xl p-6 sm:p-8">
            <div className="absolute inset-0 bg-tech-grid opacity-40 pointer-events-none" />
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-moss-400/10 blur-3xl" />

            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{active.flag}</span>
                  <div>
                    <h3 className="font-display text-2xl font-bold text-white">{active.name}</h3>
                    <p className="font-mono text-[11px] tracking-widest text-moss-400 uppercase">{active.focusLabel}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone={live.booted ? 'ok' : 'info'}>{live.booted ? 'REAL FEEDS LIVE' : 'RESOLVING FEEDS…'}</StatusBadge>
                <SourceChip source={live.weather ? 'LIVE:OPEN-METEO' : 'UNAVAILABLE'} />
              </div>
            </div>

            <div className="relative mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <Row icon={<Building2 size={15} />} label={t('scanner.capital')}>
                <span className="font-mono text-sm text-slate-200">
                  {active.capital} · {active.coords.lat.toFixed(4)}°, {active.coords.lon.toFixed(4)}°
                </span>
              </Row>

              <Row icon={<Database size={15} />} label="Live data sources">
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                    <span className="h-1 w-1 rounded-full bg-amber-400" /> NASA FIRMS hotspots
                    <SourceChip source={live.hotspotsSource} />
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                    <span className="h-1 w-1 rounded-full bg-teal-400" /> Copernicus GloFAS discharge
                    <SourceChip source={live.hydroSource} />
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                    <span className="h-1 w-1 rounded-full bg-lime-400" /> GBIF occurrences
                    <SourceChip source={live.occurrencesSource} />
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                    <span className="h-1 w-1 rounded-full bg-cyan-400" /> Official gauges
                    <SourceChip source={live.realGaugesSource} />
                  </span>
                </div>
              </Row>

              <Row icon={<Compass size={15} />} label={t('scanner.fwi')}>
                <div className="flex items-center gap-3">
                  {fwi ? (
                    <>
                      <span className="font-mono text-sm font-bold text-white tabular-nums">{fwi.fwi}</span>
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${fwi.fwi}%`, background: fwiColor }}
                        />
                      </div>
                      <span
                        className="rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider"
                        style={{ color: fwiColor, borderColor: `${fwiColor}55`, background: `${fwiColor}14` }}
                      >
                        {fwi.category} · DERIVED
                      </span>
                    </>
                  ) : (
                    <span className="font-mono text-[11px] text-slate-400">
                      {isGlobal ? 'N/A — POINT-SCOPED FEED IN GLOBAL VIEW' : 'UNAVAILABLE — live weather feed not reached'}
                    </span>
                  )}
                </div>
              </Row>

              <Row icon={<Waves size={15} />} label={t('scanner.basin')}>
                <span className="font-mono text-sm text-slate-200">
                  {active.basin}
                  {liveDischarge !== undefined && (
                    <span className="ml-2 text-cyan-300">
                      {liveDischarge.toLocaleString()} m³/s
                      <span className="ml-1 text-[9px] text-slate-500">({liveDischargeSource})</span>
                    </span>
                  )}
                </span>
              </Row>

              {active.protectedAreas.length > 0 && (
                <Row icon={<MountainSnow size={15} />} label={t('scanner.areas')}>
                  <div className="flex flex-wrap gap-1.5">
                    {active.protectedAreas.map((a) => (
                      <span key={a} className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300">
                        {a}
                      </span>
                    ))}
                  </div>
                </Row>
              )}

              {active.species.length > 0 && (
                <Row icon={<Leaf size={15} />} label={t('scanner.species')}>
                  <div className="flex flex-wrap gap-1.5">
                    {active.species.map((s) => (
                      <span key={s} className="rounded border border-moss-400/20 bg-moss-400/8 px-2 py-1 text-[11px] text-moss-200">
                        {s}
                      </span>
                    ))}
                  </div>
                </Row>
              )}
            </div>

            <div className="relative mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-grid pt-5">
              <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
                0 physical devices · real public APIs only · no simulated data
              </p>
              <a
                href="#virtual-grid"
                className="inline-flex items-center gap-2 rounded-lg border border-moss-400/40 bg-moss-400/10 px-4 py-2 text-[13px] font-semibold text-moss-300 transition-colors hover:bg-moss-400/20"
              >
                {t('scanner.deploy')} {active.name} ↓
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        <span className="text-moss-400">{icon}</span>
        {label}
      </p>
      {children}
    </div>
  );
}
