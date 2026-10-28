import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingDown, TrendingUp, Waves, Gauge as GaugeIcon, MapPin } from 'lucide-react';
import { useLive } from '@/hooks/useLiveFeeds';
import { useAppStore } from '@/store/useAppStore';
import { getTerritory } from '@/data/territoriesData';
import { StatusBadge, SourceChip } from '@/components/ui/bits';
import type { FloodAlert, HydroPoint, RealGauge, UsgsDailyGage } from '@/types/environmental';

type Tab = 'hydro' | 'forecast' | 'official' | 'observed' | 'points';

const TABS: { key: Tab; label: string }[] = [
  { key: 'hydro', label: 'GLOFAS HYDROGRAPH' },
  { key: 'observed', label: 'USGS OBSERVED FLOW' },
  { key: 'forecast', label: 'FLOOD FORECAST' },
  { key: 'official', label: 'REAL GAUGES · OFFICIAL' },
  { key: 'points', label: 'FORECAST POINTS' },
];

export function WaterHydrograph() {
  const territoryCode = useAppStore((s) => s.territoryCode);
  const territory = getTerritory(territoryCode);
  const live = useLive();
  const [tab, setTab] = useState<Tab>('hydro');
  const [pointIdx, setPointIdx] = useState(0);

  const points = territory.hydroPoints;
  const hydro = live.hydro;
  const isGlobal = live.viewMode === 'global';
  const forecast = deriveFloodForecast(hydro);
  const peak = hydro.reduce((a, b) => (b.discharge > a.discharge ? b : a), hydro[0]);
  const peakRatio = peak && peak.mean > 0 ? peak.discharge / peak.mean : 0;

  return (
    <div id="console-water" className="scroll-mt-24 glass rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] text-teal-400 uppercase">Console 03 · FLUVIA</p>
          <h3 className="mt-1 font-display text-2xl font-bold text-white">River Basins & 7-Day GloFAS Hydrograph</h3>
          <p className="mt-1 font-mono text-[11px] text-slate-500">{territory.basin} · GloFAS forecast points + official real gauges</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={peak && peak.mean > 0 && peakRatio > 1.3 ? 'warn' : 'ok'}>
            {hydro.length > 0 ? `PEAK ${Math.round(peakRatio * 100)}% OF CLIMATOLOGICAL MEAN` : 'NO HYDRO DATA'}
          </StatusBadge>
          <SourceChip source={live.hydroSource} />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-1 rounded-xl border border-grid bg-forest-950/70 p-1">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 font-mono text-[10px] font-bold tracking-wider transition-all ${
              tab === tb.key ? 'bg-teal-400/15 text-teal-300 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.4)]' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'official' && <RealGaugePanel gauges={live.realGauges} source={live.realGaugesSource} />}
        {tab === 'observed' && <UsgsObservedPanel gages={live.usgsGages} source={live.usgsGagesSource} isGlobal={live.viewMode === 'global'} />}
        {tab === 'points' && <ForecastPoints points={points} />}
        {tab === 'hydro' && (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1.5">
                {points.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setPointIdx(i)}
                    className={`rounded border px-2.5 py-1 font-mono text-[10px] transition-colors ${
                      i === pointIdx
                        ? 'border-teal-400/50 bg-teal-400/10 text-teal-300'
                        : 'border-white/10 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <p className="font-mono text-[10px] text-slate-500">
                PEAK: <span className="text-teal-300">{peak ? `${peak.discharge.toLocaleString()} m³/s` : '—'}</span>
                {peak && peak.mean > 0 && (
                  <span className={peakRatio > 1.3 ? 'text-amber-300' : 'text-slate-500'}>
                    {' '}({Math.round(peakRatio * 100)}% of GloFAS climatological mean)
                  </span>
                )}
              </p>
            </div>
            {hydro.length > 0 ? (
              <>
                <div className="h-72 rounded-2xl border border-grid bg-forest-950/60 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hydro} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dischargeFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#193d30" strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#193d30' }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={54} />
                      <Tooltip
                        contentStyle={{ background: '#0f241a', border: '1px solid #193d30', borderRadius: 10, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                        labelStyle={{ color: '#94a3b8' }}
                        formatter={(v: number | string) => `${Number(v).toLocaleString()} m³/s`}
                      />
                      <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                      <Area type="monotone" dataKey="discharge" name="GloFAS forecast discharge" stroke="#14b8a6" strokeWidth={2} fill="url(#dischargeFill)" />
                      <Line type="monotone" dataKey="mean" name="GloFAS climatological mean" stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="5 5" dot={false} />
                      <Line type="monotone" dataKey="max" name="Ensemble max" stroke="#06b6d4" strokeWidth={1} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 font-mono text-[9px] text-slate-600">
                  GLOFAS MODELLED DISCHARGE (COPERNICUS EMERGENCY MANAGEMENT SERVICE) · SOURCE: {live.hydroSource} · MODEL OUTPUT, NOT AN OBSERVED GAUGE
                </p>
              </>
            ) : (
              <NoData
                label={
                  isGlobal
                    ? 'POINT-SCOPED FEED — SELECT A TERRITORY FOR THE GLOFAS HYDROGRAPH'
                    : live.booted
                      ? 'GLOFAS FEED UNAVAILABLE — NO DATA SHOWN'
                      : 'RESOLVING GLOFAS FEED…'
                }
              />
            )}
          </div>
        )}
        {tab === 'forecast' && (
          hydro.length > 0 || !isGlobal ? (
            <FloodForecastTable forecast={forecast} hasData={hydro.length > 0} />
          ) : (
            <NoData label="POINT-SCOPED FEED — NOT APPLICABLE IN GLOBAL VIEW" />
          )
        )}
      </div>
    </div>
  );
}

/* --------------------- forecast alerts (derived, real) ------------------- */

/**
 * Flood-alert classification derived from REAL GloFAS numbers only:
 * each day's forecast discharge compared with GloFAS's own climatological
 * mean for that cell. Thresholds are transparent heuristics, labelled here.
 */
function deriveFloodForecast(hydro: { date: string; discharge: number; mean: number }[]): FloodAlert[] {
  return hydro.map((d) => {
    const ratio = d.mean > 0 ? Number((d.discharge / d.mean).toFixed(2)) : 0;
    return {
      date: d.date,
      discharge: d.discharge,
      mean: d.mean,
      ratio,
      alert: ratio >= 3 ? 'SEVERE' : ratio >= 2 ? 'WARNING' : ratio >= 1.3 ? 'WATCH' : 'NONE',
    };
  });
}

/* ---------------------------- Forecast points ---------------------------- */

function ForecastPoints({ points }: { points: HydroPoint[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {points.map((p) => (
        <div key={p.id} className="relative overflow-hidden rounded-2xl border border-grid bg-forest-950/60 p-4">
          <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-teal-400/10 blur-2xl" />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-bold tracking-widest text-teal-300">{p.id}</span>
            <span className="flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 font-mono text-[8.5px] font-bold tracking-wider text-cyan-300">
              <MapPin size={9} /> GLOFAS POINT
            </span>
          </div>
          <p className="mt-1.5 text-[13px] font-semibold text-white">{p.name}</p>
          <div className="mt-3 space-y-1.5 font-mono text-[10px] text-slate-400">
            <p className="flex justify-between"><span>LAT</span><span className="text-teal-300">{p.lat.toFixed(3)}°</span></p>
            <p className="flex justify-between"><span>LON</span><span className="text-teal-300">{p.lon.toFixed(3)}°</span></p>
          </div>
          <p className="mt-3 border-t border-white/5 pt-2.5 font-mono text-[9px] leading-relaxed text-slate-500">
            REAL RIVER LOCATION QUERIED AGAINST THE GLOBAL GLOFAS GRID · DISCHARGE IN THE HYDROGRAPH TAB
          </p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Forecast --------------------------------- */

function FloodForecastTable({ forecast, hasData }: { forecast: FloodAlert[]; hasData: boolean }) {
  const ALERT_STYLE: Record<string, string> = {
    NONE: 'border-emerald-400/30 text-emerald-300',
    WATCH: 'border-cyan-400/40 text-cyan-300',
    WARNING: 'border-amber-400/40 text-amber-300',
    SEVERE: 'border-red-400/50 text-red-300',
  };
  if (!hasData) {
    return <NoData label="GLOFAS FEED UNAVAILABLE — NO FORECAST SHOWN" />;
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-grid bg-forest-950/60">
      <table className="w-full text-left font-mono text-[11px]">
        <thead>
          <tr className="border-b border-grid text-[9px] uppercase tracking-widest text-slate-500">
            <th className="px-4 py-3">DATE</th>
            <th className="px-4 py-3">DISCHARGE</th>
            <th className="px-4 py-3 hidden sm:table-cell">% OF MEAN</th>
            <th className="px-4 py-3">RISK BAR</th>
            <th className="px-4 py-3 text-right">ALERT</th>
          </tr>
        </thead>
        <tbody>
          {forecast.map((f, i) => (
            <tr key={f.date} className={`border-b border-white/4 transition-colors hover:bg-white/[0.03] ${i % 2 ? 'bg-white/[0.015]' : ''}`}>
              <td className="px-4 py-3 text-slate-300">{f.date}</td>
              <td className="px-4 py-3 text-white">{f.discharge.toLocaleString()} <span className="text-slate-600">m³/s</span></td>
              <td className="px-4 py-3 hidden sm:table-cell text-slate-400">{Math.round(f.ratio * 100)}%</td>
              <td className="px-4 py-3">
                <div className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-white/8">
                  <div
                    className={`h-full rounded-full ${f.ratio >= 3 ? 'bg-red-500' : f.ratio >= 2 ? 'bg-amber-400' : f.ratio >= 1.3 ? 'bg-cyan-400' : 'bg-emerald-400'}`}
                    style={{ width: `${Math.min(100, f.ratio * 50)}%` }}
                  />
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <span className={`rounded border px-2 py-0.5 text-[9px] font-bold tracking-wider ${ALERT_STYLE[f.alert]}`}>{f.alert}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-grid px-4 py-2.5 font-mono text-[9px] text-slate-600">
        ALERTS DERIVED FROM REAL GLOFAS OUTPUT: DISCHARGE vs ITS CLIMATOLOGICAL MEAN (WATCH ≥130% · WARNING ≥200% · SEVERE ≥300%) · NO SIMULATED VALUES
      </p>
    </div>
  );
}

/* --------------------------- USGS observed flow ------------------------- */

function UsgsObservedPanel({
  gages,
  source,
  isGlobal,
}: {
  gages: UsgsDailyGage[];
  source: string;
  isGlobal: boolean;
}) {
  const primary = gages[0];
  const chartData = primary
    ? primary.series.map((v) => ({ date: v.date.slice(5), discharge: v.cms }))
    : [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 px-4 py-3">
        <GaugeIcon size={16} className="text-emerald-300" />
        <p className="flex-1 text-[12.5px] leading-relaxed text-slate-300">
          Real observed daily mean discharge measured by USGS gages — genuine in-river flow (m³/s), not a model.
          Updated daily by USGS; provisional values flagged until USGS finalises them.
        </p>
        <SourceChip source={source} />
      </div>

      {gages.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {gages.map((g) => {
              const last = g.series[g.series.length - 1];
              const first = g.series[0];
              const delta = Number((last.cms - first.cms).toFixed(1));
              return (
                <div key={g.siteId} className="rounded-2xl border border-grid bg-forest-950/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold tracking-widest text-cyan-300">{g.siteNumber}</span>
                    {last.provisional && (
                      <span className="rounded border border-amber-400/40 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-amber-300">
                        PROVISIONAL
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12.5px] font-semibold text-white">{g.name}</p>
                  <p className="font-mono text-[9px] text-slate-600">DA {g.drainageAreaMi2.toLocaleString()} mi²{g.state ? ` · ${g.state}` : ''}</p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-2xl font-extrabold text-cyan-300 tabular-nums">{last.cms}</span>
                    <span className="font-mono text-[9px] text-slate-500">m³/s · {last.cfs.toLocaleString()} ft³/s</span>
                  </div>
                  <p className="mt-1 font-mono text-[9px] text-slate-600">
                    {g.dailyEnd} · 30-DAY Δ {delta > 0 ? '+' : ''}{delta} m³/s {last.ice ? '· ICE-AFFECTED' : ''}{last.estimated ? ' · ESTIMATED' : ''}
                  </p>
                </div>
              );
            })}
          </div>

          {/* 30-day observed hydrograph for the largest drainage gage */}
          <div className="h-64 rounded-2xl border border-grid bg-forest-950/60 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="observedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#193d30" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#193d30' }} interval={4} />
                <YAxis tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={52} />
                <Tooltip
                  contentStyle={{ background: '#0f241a', border: '1px solid #193d30', borderRadius: 10, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(v: number | string) => `${Number(v).toLocaleString()} m³/s`}
                />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                <Area
                  type="monotone"
                  dataKey="discharge"
                  name={`USGS observed daily mean — ${primary!.siteNumber}`}
                  stroke="#22d3ee"
                  strokeWidth={2}
                  fill="url(#observedFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="font-mono text-[9px] leading-relaxed text-slate-600">
            {primary!.name.toUpperCase()} · 30-DAY DAILY MEAN · SOURCE: USGS WATER DATA VIA WATERDATA.DEV ·
            "STREAM GAGE INFORMATION COURTESY OF THE U.S. GEOLOGICAL SURVEY" · PUBLIC DOMAIN
          </p>
        </>
      ) : (
        <div className="grid h-56 place-items-center rounded-2xl border border-grid bg-forest-950/60">
          <p className="text-center font-mono text-[10px] tracking-widest text-red-300">
            {isGlobal ? 'US-NETWORK GAGES LOAD WITH THEIR REGIONS' : 'USGS DAILY FLOW UNAVAILABLE — NO DATA SHOWN'}
          </p>
        </div>
      )}
    </div>
  );
}

/* --------------------------- REAL official gauges ------------------------ */

function RealGaugePanel({ gauges, source }: { gauges: RealGauge[]; source: string }) {
  const live = source.startsWith('LIVE');
  return (
    <div className="space-y-3">
      <div className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${live ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-red-400/25 bg-red-400/5'}`}>
        <GaugeIcon size={16} className={live ? 'text-emerald-300' : 'text-red-300'} />
        <p className="flex-1 text-[12.5px] leading-relaxed text-slate-300">
          {live
            ? 'Live stage readings streamed from official open national gauge networks — genuine in-river measurements, zero hardware on our side.'
            : 'No anonymous open gauge feed is reachable for this territory (official networks exist — e.g. ARSO 🇸🇮, ANA Hidroweb 🇧🇷, BoM 🇦🇺 — but require registration/credentials or block CORS). NO readings are shown and nothing is simulated; global modelled discharge remains live in the GloFAS Hydrograph tab.'}
        </p>
        <span
          title={`Feed integrity: ${live ? 'direct public-API link' : 'no open feed — no data displayed'}`}
          className={`rounded border px-2 py-0.5 font-mono text-[9px] tracking-wider ${live ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : 'border-red-400/30 bg-red-400/5 text-red-300'}`}
        >
          {live ? '●' : '✕'} {source}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-grid bg-forest-950/60">
        <table className="w-full text-left font-mono text-[11px]">
          <thead>
            <tr className="border-b border-grid text-[9px] uppercase tracking-widest text-slate-500">
              <th className="px-4 py-3">STATION</th>
              <th className="px-4 py-3">LEVEL</th>
              <th className="px-4 py-3 hidden sm:table-cell">STATE</th>
              <th className="px-4 py-3 hidden md:table-cell">TREND</th>
              <th className="px-4 py-3 text-right">MEASURED</th>
            </tr>
          </thead>
          <tbody>
            {gauges.map((g, i) => (
              <tr key={`${g.agency}-${g.id}`} className={`border-b border-white/4 ${i % 2 ? 'bg-white/[0.015]' : ''} transition-colors hover:bg-white/[0.03]`}>
                <td className="px-4 py-3">
                  <span className="block text-white">{g.name}</span>
                  <span className="block text-[9px] text-slate-600">
                    {g.id} · {g.agency}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[15px] font-bold text-cyan-300">{g.level}</span>
                  <span className="ml-1 text-[9px] text-slate-500">{g.unit === 'cm' ? 'cm' : 'm'}</span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                      g.status === 'ALERT'
                        ? 'border-red-400/40 text-red-300'
                        : g.status === 'ELEVATED'
                          ? 'border-amber-400/40 text-amber-300'
                          : 'border-emerald-400/30 text-emerald-300'
                    }`}
                  >
                    {(g.state ?? g.status).toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`flex items-center gap-1 ${g.trend === 'RISING' ? 'text-red-400' : g.trend === 'FALLING' ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {g.trend === 'RISING' ? <TrendingUp size={11} /> : g.trend === 'FALLING' ? <TrendingDown size={11} /> : <Waves size={11} />}
                    {g.trend}
                    {g.trendSpan != null && g.trendSpan !== 0 && (
                      <span className="text-[9px] text-slate-600"> {g.trendSpan > 0 ? '+' : ''}{g.trendSpan} {g.unit === 'cm' ? 'cm' : 'm'}</span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-500">{new Date(g.timestamp).toLocaleString('en-GB', { hour12: false })}</td>
              </tr>
            ))}
            {gauges.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[10px] tracking-widest text-slate-600 uppercase">
                  {live ? 'Resolving official gauge network…' : 'NO OPEN FEED FOR THIS TERRITORY — NO READINGS SHOWN'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-[9px] leading-relaxed text-slate-600">
        OPEN OFFICIAL NETWORKS INTEGRATED: 🇺🇸 waterservices.usgs.gov (NWIS IV · 00065 GAGE HEIGHT) · 🇩🇪 pegelonline.wsv.de (REST-API v2 · W) ·
        🇬🇧 environment.data.gov.uk (FLOOD-MONITORING · STAGE) · THERE IS NO GLOBAL STATION-LEVEL STAGE API — GLOFAS PROVIDES GLOBAL MODELLED DISCHARGE
      </p>
    </div>
  );
}

/* ------------------------------- shared ---------------------------------- */

function NoData({ label }: { label: string }) {
  return (
    <div className="grid h-64 place-items-center rounded-2xl border border-grid bg-forest-950/60">
      <p className="text-center font-mono text-[10px] tracking-widest text-red-300">{label}</p>
    </div>
  );
}
