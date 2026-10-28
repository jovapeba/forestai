import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts';
import { Flame, Navigation, Thermometer, Wind } from 'lucide-react';
import { useLive } from '@/hooks/useLiveFeeds';
import { useAppStore } from '@/store/useAppStore';
import { getTerritory } from '@/data/territoriesData';
import { StatusBadge, SourceChip } from '@/components/ui/bits';
import type { FwiCategory } from '@/types/environmental';

const CAT_COLOR: Record<FwiCategory, string> = {
  LOW: '#4ade80',
  MODERATE: '#f59e0b',
  HIGH: '#f97316',
  EXTREME: '#ef4444',
};

export function FireSentinel() {
  const territoryCode = useAppStore((s) => s.territoryCode);
  const territory = getTerritory(territoryCode);
  const live = useLive();
  const { weather, index } = live;

  const cat: FwiCategory | null = index ? index.category : null;
  const color = cat ? CAT_COLOR[cat] : '#64748b';
  const hotspots = live.hotspots.slice(0, 6);
  const maxFrp = Math.max(...hotspots.map((h) => h.frp), 1);
  const isGlobal = live.viewMode === 'global';

  // Fire propagation corridor: downwind arc from the strongest real hotspot
  const propagation =
    hotspots[0] && weather
      ? `CORRIDOR ${Math.round((weather.wind.dir + 180) % 360)}° · ${(weather.wind.speed / 3.6 * 6).toFixed(1)} km/h spread`
      : 'NO ACTIVE CORRIDOR';

  return (
    <div id="console-fire" className="scroll-mt-24 glass rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] text-amber-400 uppercase">Console 02 · IGNIS</p>
          <h3 className="mt-1 font-display text-2xl font-bold text-white">NASA FIRMS & Fire Weather Sentinel</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={cat === 'EXTREME' ? 'danger' : cat === 'HIGH' ? 'warn' : 'ok'}>
            {index ? `FWI ${index.fwi} · ${index.category} (DERIVED)` : isGlobal ? 'FWI N/A — GLOBAL VIEW' : 'FWI UNAVAILABLE'}
          </StatusBadge>
          {(weather?.weatherCode ?? 0) >= 95 && (
            <StatusBadge tone="danger">⚡ THUNDERSTORM (LIVE WMO CODE {weather!.weatherCode})</StatusBadge>
          )}
          {weather?.lightningMax != null && weather.lightningMax > 0 && (weather?.weatherCode ?? 0) < 95 && (
            <StatusBadge tone={weather.lightningMax >= 200 ? 'warn' : 'info'}>
              ⚡ LIGHTNING POTENTIAL {weather.lightningMax} J/KG · NEXT 8 H (CAMS MODEL)
            </StatusBadge>
          )}
          {(weather?.precipitation ?? 0) > 0 && (weather?.weatherCode ?? 0) < 95 && (
            <StatusBadge tone="info">🌧 RAIN {weather!.precipitation} MM (LIVE)</StatusBadge>
          )}
          <SourceChip source={weather ? weather.source : isGlobal ? 'NOT-APPLICABLE' : 'UNAVAILABLE'} />
        </div>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_280px_260px]">
        {/* Hotspot list */}
        <div className="rounded-2xl border border-grid bg-forest-950/60 p-4">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
            <Flame size={12} className="text-amber-400" /> Active Thermal Hotspots — FRP (MW)
          </p>
          <div className="mt-3 space-y-2.5">
            {hotspots.map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-amber-400" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                </span>
                <span className="font-mono text-[11px] text-slate-300">
                  {h.lat.toFixed(2)}°, {h.lon.toFixed(2)}°
                </span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-500"
                    style={{ width: `${Math.round((h.frp / maxFrp) * 100)}%` }}
                  />
                </div>
                <span className="w-16 text-right font-mono text-[11px] font-bold text-amber-300">{h.frp} MW</span>
                <span className="hidden w-10 text-right font-mono text-[9px] uppercase text-slate-600 sm:block">
                  {h.confidence === 'h' ? 'HIGH' : h.confidence === 'l' ? 'LOW' : 'NOM'}
                </span>
              </div>
            ))}
            {hotspots.length === 0 && (
              <p className="py-6 text-center font-mono text-[11px] text-slate-600">
                {live.hotspotsSource === 'LIVE:NASA-FIRMS'
                  ? 'NO FIRMS DETECTIONS IN TERRITORY BBOX — REAL ZERO'
                  : 'FIRMS FEED UNAVAILABLE — NO DATA SHOWN'}
              </p>
            )}
          </div>
          <p className="mt-3 font-mono text-[9px] leading-relaxed text-slate-600">
            SOURCE: {live.hotspotsSource} · SUOMI-NPP VIIRS C2 · 375 M RESOLUTION · 24H→48H WINDOW
          </p>
        </div>

        {/* FWI gauge */}
        <div className="rounded-2xl border border-grid bg-forest-950/60 p-4 text-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Fire Weather Index</p>
          {index && weather ? (
            <>
              <div className="relative mx-auto h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="72%"
                    outerRadius="100%"
                    data={[{ name: 'FWI', value: index.fwi, fill: color }]}
                    startAngle={225}
                    endAngle={-45}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
                    <RadialBar background={{ fill: 'rgba(255,255,255,0.06)' }} dataKey="value" cornerRadius={8} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 grid place-items-center">
                  <div>
                    <p className="font-display text-3xl font-extrabold tabular-nums" style={{ color }}>{index.fwi}</p>
                    <p className="font-mono text-[9px] tracking-widest" style={{ color }}>{index.category}</p>
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                <Metric icon={<Thermometer size={11} />} value={`${weather.temp}°`} label="TEMP" />
                <Metric icon={<Wind size={11} />} value={`${weather.humidity}%`} label="RH" />
                <Metric icon={<Navigation size={11} />} value={`${weather.wind.speed}`} label="KM/H" />
              </div>
              <p className="mt-2 font-mono text-[9px] text-slate-600">DROUGHT CODE: {index.droughtCode} · {index.source}</p>
            </>
          ) : (
            <div className="grid h-44 place-items-center">
              <p className="font-mono text-[10px] tracking-widest text-red-300">
                {isGlobal ? 'POINT-SCOPED FEED — NOT APPLICABLE IN GLOBAL VIEW' : 'OPEN-METEO FEED UNAVAILABLE'}
                {!isGlobal && (
                  <>
                    <br />
                    <span className="text-slate-600">NO FWI DERIVATION POSSIBLE — NOTHING SIMULATED</span>
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Wind needle + propagation */}
        <div className="rounded-2xl border border-grid bg-forest-950/60 p-4">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
            <Navigation size={12} className="text-cyan-400" /> Wind Vector
          </p>
          {weather ? (
            <>
              <div className="relative mx-auto mt-3 grid h-40 w-40 place-items-center">
                <div className="absolute inset-0 rounded-full border border-grid" />
                <div className="absolute inset-4 rounded-full border border-grid/60" />
                {['N', 'E', 'S', 'W'].map((d, i) => (
                  <span
                    key={d}
                    className="absolute font-mono text-[9px] text-slate-500"
                    style={{
                      top: i === 0 ? '6%' : i === 2 ? 'auto' : '50%',
                      bottom: i === 2 ? '6%' : 'auto',
                      left: i === 3 ? '8%' : i === 1 ? 'auto' : '50%',
                      right: i === 1 ? '8%' : 'auto',
                      transform: i % 2 === 0 ? 'translateX(-50%)' : 'translateY(-50%)',
                    }}
                  >
                    {d}
                  </span>
                ))}
                {/* needle */}
                <div
                  className="absolute h-16 w-0.5 origin-bottom rounded-full bg-gradient-to-t from-cyan-400 to-moss-300 shadow-[0_0_12px_rgba(74,222,128,0.7)]"
                  style={{ bottom: '50%', transform: `rotate(${weather.wind.dir}deg)`, transformOrigin: 'bottom center' }}
                />
                <span className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
              </div>
              <div className="mt-3 space-y-1.5 font-mono text-[10px] text-slate-400">
                <p className="flex justify-between"><span>DIR</span><span className="text-cyan-300">{weather.wind.dir}°</span></p>
                <p className="flex justify-between"><span>GUST</span><span className="text-cyan-300">{weather.wind.gust} km/h</span></p>
                <p className="flex justify-between"><span>PROPAGATION</span><span className="text-amber-300">{propagation}</span></p>
              </div>
            </>
          ) : (
            <p className="mt-6 text-center font-mono text-[10px] tracking-widest text-red-300">
              {isGlobal ? 'WIND FEED N/A — GLOBAL VIEW' : 'WIND FEED UNAVAILABLE'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5">
      <p className="flex items-center justify-center gap-1 font-mono text-[8px] text-slate-500">{icon}{label}</p>
      <p className="font-mono text-[12px] font-bold text-slate-200">{value}</p>
    </div>
  );
}
