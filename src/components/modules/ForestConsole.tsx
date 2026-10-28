import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Droplets, TreeDeciduous, Wind } from 'lucide-react';
import { useLive } from '@/hooks/useLiveFeeds';
import { getTerritory } from '@/data/territoriesData';
import { useAppStore } from '@/store/useAppStore';
import { SourceChip, StatusBadge } from '@/components/ui/bits';

const LAYERS = [
  { key: 'l0_1' as const, name: '0–1 cm', color: '#bef264' },
  { key: 'l1_3' as const, name: '1–3 cm', color: '#4ade80' },
  { key: 'l3_9' as const, name: '3–9 cm', color: '#14b8a6' },
  { key: 'l9_27' as const, name: '9–27 cm', color: '#0891b2' },
];

export function ForestConsole() {
  // CANOPY console — real soil model + live CAMS air quality
  const territoryCode = useAppStore((s) => s.territoryCode);
  const territory = getTerritory(territoryCode);
  const live = useLive();
  const soil = live.soil;
  const latest = soil[soil.length - 1];
  const air = live.air;
  const isGlobal = live.viewMode === 'global';

  const avg = (key: 'l0_1' | 'l1_3' | 'l3_9' | 'l9_27') =>
    Math.round((soil.reduce((a, p) => a + (p[key] as number), 0) / Math.max(soil.length, 1)) * 10) / 10;

  // Drought-stress index derived from the LIVE weather feed (real inputs):
  // dryness ≈ (temp − 5)·(100 − RH)/100. Pure derivation, no simulation.
  const stressPct = live.weather
    ? Math.max(0, Math.min(100, Math.round(((live.weather.temp - 5) * (100 - live.weather.humidity)) / 100 * 2.2)))
    : null;
  // Moisture anomaly: real 9–27 cm latest value vs its own 24 h mean (derived)
  const deepMean = soil.length > 0 ? soil.reduce((a, p) => a + p.l9_27, 0) / soil.length : 0;
  const moistureAnomaly = latest ? Math.round(((latest.l9_27 - deepMean) / Math.max(deepMean, 0.1)) * 100) : null;
  const rating =
    stressPct == null ? 'UNAVAILABLE' : stressPct > 45 ? 'STRESSED' : stressPct > 25 ? 'WATCH' : 'HEALTHY';
  const risk = live.index ? (live.index.fwi > 65 ? 'HIGH' : live.index.fwi > 35 ? 'MODERATE' : 'LOW') : null;

  return (
    <div id="console-forest" className="scroll-mt-24 glass rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] text-emerald-400 uppercase">Console 01 · CANOPY</p>
          <h3 className="mt-1 font-display text-2xl font-bold text-white">Soil Moisture & Drought Stress</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={risk === 'HIGH' ? 'danger' : risk === 'MODERATE' ? 'warn' : risk ? 'ok' : 'warn'}>
            {risk ? `DEFORESTATION RISK (DERIVED): ${risk}` : 'FWI UNAVAILABLE'}
          </StatusBadge>
          <SourceChip source={live.soilSource} />
        </div>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Derived indicators */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-grid bg-forest-950/60 p-4">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
              <TreeDeciduous size={12} className="text-emerald-400" /> Drought Stress Rating
            </p>
            <p className={`mt-2 font-display text-3xl font-extrabold ${stressPct == null ? (isGlobal ? 'text-slate-400' : 'text-red-300') : 'text-emerald-300'}`}>
              {stressPct == null ? (isGlobal ? 'N/A — GLOBAL' : 'UNAVAILABLE') : rating}
            </p>
            <div className="mt-3 space-y-2.5">
              {stressPct != null && (
                <Bar label="Drought stress (derived from live weather)" pct={stressPct} color={stressPct > 45 ? '#ef4444' : '#f59e0b'} />
              )}
              {moistureAnomaly != null && (
                <Bar
                  label="Deep-soil moisture vs 24 h mean (derived, real)"
                  pct={Math.min(100, Math.abs(moistureAnomaly))}
                  color={moistureAnomaly >= 0 ? '#14b8a6' : '#f59e0b'}
                  display={`${moistureAnomaly > 0 ? '+' : ''}${moistureAnomaly}%`}
                />
              )}
              {latest && (
                <Bar label="Soil saturation 9–27 cm (real model)" pct={latest.l9_27} color="#0891b2" display={`${latest.l9_27}`} />
              )}
            </div>
            <p className="mt-3 font-mono text-[9px] leading-relaxed text-slate-600">
              ALL INDICATORS DERIVED FROM LIVE OPEN-METEO DATA · NO VIRTUAL PROBE HARDWARE · NO SEEDED VALUES
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {LAYERS.map((l) => (
              <div key={l.key} className="rounded-xl border border-grid bg-forest-950/60 px-3 py-2.5">
                <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{l.name} avg</p>
                <p className="font-mono text-sm font-bold" style={{ color: l.color }}>
                  {soil.length > 0 ? avg(l.key) : '—'} <span className="text-[9px] text-slate-500">m³/m³·10²</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Soil moisture chart */}
        <div className="rounded-2xl border border-grid bg-forest-950/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
              <Droplets size={12} className="text-cyan-400" /> 4-Layer Soil Moisture Profile — last 24 h
            </p>
            <p className="font-mono text-[10px] text-slate-500">site: {territory.focusSites[0]?.name ?? '—'}</p>
          </div>
          {soil.length > 0 ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={soil} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                    <defs>
                      {LAYERS.map((l) => (
                        <linearGradient key={l.key} id={`soil-${l.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={l.color} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={l.color} stopOpacity={0.02} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid stroke="#193d30" strokeDasharray="3 6" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#193d30' }} interval={5} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip
                      contentStyle={{ background: '#0f241a', border: '1px solid #193d30', borderRadius: 10, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                    {LAYERS.map((l) => (
                      <Area key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} fill={`url(#soil-${l.key})`} strokeWidth={1.6} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 font-mono text-[9px] leading-relaxed text-slate-600">
                ERA5/CMAAS LAND MODEL (REAL MODEL OUTPUT, NOT A PHYSICAL PROBE) · DEPTHS 0–1 / 1–3 / 3–9 / 9–27 CM · SOURCE: {live.soilSource}
              </p>
            </>
          ) : (
            <div className="grid h-64 place-items-center">
              <p className="text-center font-mono text-[10px] tracking-widest text-red-300">
                {isGlobal
                  ? 'POINT-SCOPED FEED — NOT APPLICABLE IN GLOBAL VIEW'
                  : live.booted
                    ? 'OPEN-METEO SOIL FEED UNAVAILABLE — NO DATA SHOWN'
                    : 'RESOLVING SOIL FEED…'}
              </p>
            </div>
          )}

          {/* Real CAMS air quality — global, no key */}
          <div className="mt-4 rounded-xl border border-grid bg-forest-950/50 p-3.5">
            <p className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-slate-500">
              <span className="flex items-center gap-2"><Wind size={11} className="text-sky-400" /> Air quality — CAMS model (real)</span>
              <SourceChip source={air ? 'LIVE:OPEN-METEO' : live.airSource} />
            </p>
            {air ? (
              <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-7">
                <AqStat label="EU AQI" value={String(air.europeanAqi)} accent />
                <AqStat label="PM2.5" value={air.pm25.toFixed(1)} />
                <AqStat label="PM10" value={air.pm10.toFixed(1)} />
                <AqStat label="O₃" value={air.ozone.toFixed(0)} />
                <AqStat label="NO₂" value={air.no2.toFixed(1)} />
                <AqStat label="SO₂" value={air.so2.toFixed(1)} />
                <AqStat label="CO" value={air.co.toFixed(0)} />
              </div>
            ) : (
              <p className="font-mono text-[9.5px] text-red-300">
                {isGlobal ? 'POINT-SCOPED FEED — NOT APPLICABLE IN GLOBAL VIEW' : 'AIR QUALITY FEED UNAVAILABLE — NO DATA SHOWN'}
              </p>
            )}
            {air && (
              <p className="mt-2 font-mono text-[8.5px] text-slate-600">µG/M³ · COPERNICUS ATMOSPHERE MONITORING SERVICE VIA OPEN-METEO</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AqStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5 text-center">
      <p className="font-mono text-[7.5px] tracking-widest text-slate-500">{label}</p>
      <p className={`font-mono text-[12.5px] font-bold ${accent ? 'text-sky-300' : 'text-slate-200'}`}>{value}</p>
    </div>
  );
}

function Bar({ label, pct, color, display }: { label: string; pct: number; color: string; display?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-500">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{display ?? `${Math.round(pct)}%`}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
    </div>
  );
}
