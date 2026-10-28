import { useEffect, useMemo, useState } from 'react';
import { Activity, Building2, CheckCircle2, FileText, Flame, Radio, RotateCcw, Satellite, Send, Trees, Waves } from 'lucide-react';
import { useAppStore, useT } from '@/store/useAppStore';
import { getTerritory } from '@/data/territoriesData';
import { deriveIncidents, hydroPeakRatio, liveFeedHealth, synthesizeSITREP, type LiveCtx } from '@/services/aiSynthesisService';
import { useLive } from '@/hooks/useLiveFeeds';
import { SectionHeading, StatusBadge } from '@/components/ui/bits';
import type { Incident, SITREP } from '@/types/environmental';

const LAYER_ICON: Record<string, React.ReactNode> = {
  SATELLITE: <Satellite size={14} />,
  FIRE: <Flame size={14} />,
  BASIN: <Waves size={14} />,
  SPECIES: <Trees size={14} />,
  CIVIL: <Building2 size={14} />,
};

const LAYER_COLOR: Record<string, string> = {
  SATELLITE: '#38bdf8',
  FIRE: '#f59e0b',
  BASIN: '#14b8a6',
  SPECIES: '#a3e635',
  CIVIL: '#ef4444',
};

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'text-sky-300 border-sky-400/40 bg-sky-400/10',
  TRIGGERED: 'text-red-300 border-red-400/40 bg-red-400/10',
  MONITOR: 'text-amber-300 border-amber-400/40 bg-amber-400/10',
  STANDBY: 'text-slate-400 border-white/15 bg-white/5',
};

const THREAT_STYLE: Record<string, string> = {
  LOW: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300',
  MODERATE: 'border-amber-400/50 bg-amber-400/10 text-amber-300',
  HIGH: 'border-orange-400/50 bg-orange-400/10 text-orange-300',
  SEVERE: 'border-red-400/50 bg-red-400/10 text-red-300',
  CRITICAL: 'border-red-500/60 bg-red-500/15 text-red-300',
};

export function CommandSection() {
  const t = useT();
  return (
    <section id="command" className="relative scroll-mt-20 py-24">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-red-500/6 blur-[130px]" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading kicker="04 · COMMAND" title={t('command.title')} sub={t('command.sub')} />
        <CommandCenterSimulator />
      </div>
    </section>
  );
}

export function CommandCenterSimulator() {
  const territoryCode = useAppStore((s) => s.territoryCode);
  const territory = getTerritory(territoryCode);
  const live = useLive();

  const ctx: LiveCtx = {
    hotspots: live.hotspots,
    hotspotsSource: live.hotspotsSource,
    hydro: live.hydro,
    hydroSource: live.hydroSource,
    index: live.index,
    weather: live.weather,
    realGauges: live.realGauges,
    realGaugesSource: live.realGaugesSource,
    occurrences: live.occurrences,
    occurrencesSource: live.occurrencesSource,
    events: live.events.items,
    eventsSources: live.events.sources,
  };
  const incidents = useMemo(() => deriveIncidents(territory, ctx), [territory, live]); // eslint-disable-line react-hooks/exhaustive-deps
  const health = liveFeedHealth(ctx);
  const hRatio = hydroPeakRatio(live.hydro);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);
  const [correlation, setCorrelation] = useState(0); // 0..100 analysis progress
  const [sitrep, setSitrep] = useState<SITREP | null>(null);
  const [typed, setTyped] = useState(0); // typewriter progress
  const [generating, setGenerating] = useState(false);

  const incident: Incident | undefined =
    (selectedId && incidents.find((i) => i.id === selectedId)) || incidents[0];

  const runSynthesis = (inc: Incident) => {
    setSelectedId(inc.id);
    setSitrep(null);
    setTyped(0);
    setCorrelation(0);
    setGenerating(true);
    setRunId((n) => n + 1);
  };

  // Correlation sweep → then generate (interval-based: survives hidden tabs)
  useEffect(() => {
    if (!incident) return;
    const start = performance.now();
    const dur = 2200;
    const id = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / dur);
      setCorrelation(Math.round(p * 100));
      if (p >= 1) {
        clearInterval(id);
        setSitrep(synthesizeSITREP(incident, territory, ctx));
        setGenerating(false);
      }
    }, 16);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, runId, territoryCode, incident?.id, live.booted]);

  // Typewriter for summary
  useEffect(() => {
    if (!sitrep) return;
    const total = sitrep.summary.length;
    const id = setInterval(() => {
      setTyped((n) => {
        if (n >= total) {
          clearInterval(id);
          return n;
        }
        return n + 3;
      });
    }, 12);
    return () => clearInterval(id);
  }, [sitrep]);

  return (
    <div className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-tech-grid opacity-30" />

      {/* Live-context strip — real numbers only */}
      <div className="relative flex flex-wrap items-center gap-3 rounded-2xl border border-grid bg-forest-950/60 px-4 py-3 font-mono text-[10px] text-slate-400">
        <Activity size={13} className="text-moss-400" />
        <span>LIVE FEEDS: <span className="text-moss-300">{health.live}/{health.total}</span></span>
        <span className="text-slate-700">|</span>
        <span>FIRMS HOTSPOTS: <span className="text-amber-300">{live.hotspotsSource === 'LIVE:NASA-FIRMS' ? live.hotspots.length : '—'}</span></span>
        <span className="text-slate-700">|</span>
        <span>REAL EVENTS: <span className="text-red-300">{live.events.items.length > 0 ? live.events.items.length : '0'}</span></span>
        <span className="text-slate-700">|</span>
        <span>GLOFAS PEAK: <span className="text-teal-300">{live.hydro.length > 0 ? `${Math.round(hRatio * 100)}% OF MEAN` : '—'}</span></span>
        <span className="text-slate-700">|</span>
        <span>FWI: <span className="text-orange-300">{live.index ? `${live.index.fwi} (${live.index.category})` : '—'}</span></span>
        <span className="ml-auto text-slate-600">INCIDENTS DERIVED FROM REAL DATA ONLY</span>
      </div>

      {incidents.length === 0 ? (
        /* ---------------------- Nominal state ---------------------- */
        <div className="relative mt-6 grid place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.03] p-10 text-center">
          <CheckCircle2 size={28} className="text-emerald-300" />
          <p className="mt-3 font-display text-xl font-bold text-white">No active incidents derived from live feeds</p>
          <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-slate-400">
            {live.booted
              ? `Real FIRMS detections, GloFAS exceedance and official gauge trends were correlated and none currently qualifies as an active incident. This is a genuine assessment, not a placeholder — when a real event qualifies it will appear here automatically.`
              : 'Correlating live public feeds — incidents appear here only when real data qualifies.'}
          </p>
          <p className="mt-4 font-mono text-[9px] tracking-widest text-slate-600">
            SOURCES: NASA FIRMS · COPERNICUS GLOFAS · OFFICIAL GAUGE NETWORKS · GBIF — ALL LIVE OR EXPLICITLY UNAVAILABLE
          </p>
        </div>
      ) : (
        <>
          {/* Incident picker */}
          <div className="relative mt-6 grid gap-3 lg:grid-cols-2">
            {incidents.map((inc) => (
              <button
                key={inc.id}
                onClick={() => runSynthesis(inc)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  inc.id === incident?.id
                    ? 'border-moss-400/50 bg-moss-400/10 shadow-[inset_0_0_30px_rgba(74,222,128,0.07)]'
                    : 'border-white/10 bg-forest-950/50 hover:border-moss-400/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold tracking-widest text-slate-500">{inc.code}</span>
                  <span className={`rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-bold tracking-wider ${THREAT_STYLE[inc.severity]}`}>
                    {inc.severity}
                  </span>
                </div>
                <p className="mt-2.5 text-[13.5px] font-semibold leading-snug text-white">{inc.title}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-500">◤ {inc.location}</p>
              </button>
            ))}
          </div>

          {/* Correlation pipeline */}
          <div className="relative mt-7 rounded-2xl border border-grid bg-forest-950/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                <Activity size={13} className="text-moss-400" /> Real-Time Multi-Layer Correlation
              </p>
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-44 overflow-hidden rounded-full bg-white/8">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-moss-400 to-cyan-400 transition-all duration-200 ${correlation < 100 ? 'animate-pulse' : ''}`}
                    style={{ width: `${correlation}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] font-bold text-moss-300 tabular-nums">{correlation}%</span>
              </div>
            </div>

            {/* Cascade pipeline */}
            <div className="mt-5 grid gap-2 lg:grid-cols-5">
              {incident!.cascade.map((c, i) => {
                const revealed = correlation > (i + 1) * 17;
                return (
                  <div
                    key={c.layer}
                    className={`rounded-xl border p-3 transition-all duration-500 ${
                      revealed ? 'opacity-100 translate-y-0 border-white/10 bg-white/[0.03]' : 'opacity-25 translate-y-1 border-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-wider" style={{ color: LAYER_COLOR[c.layer] }}>
                        {LAYER_ICON[c.layer]}
                        {c.layer}
                      </span>
                      <span className={`rounded border px-1 py-0.5 font-mono text-[7.5px] font-bold ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                    </div>
                    <p className="mt-2 text-[10.5px] leading-relaxed text-slate-400">{c.detail}</p>
                    <p className="mt-2 font-mono text-[8.5px] text-slate-600">LAYER {i + 1}/5 · LIVE DATA</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SITREP */}
          <div className="relative mt-6 grid gap-5 lg:grid-cols-[1.25fr_1fr]">
            <div className="rounded-2xl border border-grid bg-forest-950/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                  <FileText size={13} className="text-moss-400" /> National Incident Situation Report
                </p>
                {sitrep && (
                  <StatusBadge tone={sitrep.threatLevel === 'LOW' ? 'ok' : sitrep.threatLevel === 'MODERATE' ? 'warn' : 'danger'} className={THREAT_STYLE[sitrep.threatLevel]}>
                    THREAT: {sitrep.threatLevel}
                  </StatusBadge>
                )}
              </div>

              {sitrep ? (
                <div className="mt-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Kv k="SITREP ID" v={sitrep.id} />
                    <Kv k="TIMESTAMP" v={sitrep.timestamp} />
                    <Kv k="LIVE FEED CONFIDENCE" v={`${sitrep.confidencePct}%`} accent />
                    <Kv k="INCIDENT" v={sitrep.incidentCode} />
                  </div>
                  <p className={`mt-4 min-h-[110px] whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-emerald-100/90 ${typed < sitrep.summary.length ? 'sitrep-caret' : ''}`}>
                    {sitrep.summary.slice(0, typed)}
                  </p>
                  <p className="mt-3 border-t border-white/5 pt-3 font-mono text-[9px] leading-relaxed text-slate-600">
                    DATA FUSION: {sitrep.dataSources.join(' · ')} · DERIVED EXCLUSIVELY FROM LIVE PUBLIC API DATA · DECISION-SUPPORT ONLY
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid h-[150px] place-items-center">
                  <div className="text-center">
                    <Radio size={22} className={`mx-auto text-moss-400 ${generating ? 'animate-glow' : ''}`} />
                    <p className="mt-3 font-mono text-[10px] tracking-[0.3em] text-slate-500 uppercase">
                      {generating ? 'Correlating live layers…' : 'Awaiting synthesis'}
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={() => incident && runSynthesis(incident)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-moss-400/40 bg-moss-400/10 px-4 py-2 font-mono text-[10px] font-bold tracking-widest text-moss-300 transition-colors hover:bg-moss-400/20"
              >
                <RotateCcw size={12} /> REGENERATE SITREP
              </button>
            </div>

            {/* Dispatch actions */}
            <div className="rounded-2xl border border-grid bg-forest-950/70 p-5">
              <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                <Send size={13} className="text-cyan-400" /> Agency Dispatch Briefing
              </p>
              <div className={`mt-4 space-y-2.5 transition-opacity duration-500 ${sitrep ? 'opacity-100' : 'pointer-events-none opacity-25'}`}>
                {(sitrep?.actions ?? []).map((a, i) => (
                  <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] font-bold tracking-widest text-cyan-300">{a.agency}</span>
                      <span className="flex items-center gap-2">
                        <span className={`rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-bold ${a.priority === 'P1' ? 'border-red-400/50 text-red-300' : a.priority === 'P2' ? 'border-amber-400/50 text-amber-300' : 'border-white/20 text-slate-400'}`}>
                          {a.priority}
                        </span>
                        <span className="font-mono text-[9px] text-slate-500">{a.eta}</span>
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">{a.action}</p>
                  </div>
                ))}
                {!sitrep && (
                  <p className="py-10 text-center font-mono text-[10px] tracking-widest text-slate-600 uppercase">
                    Dispatch queue locked — generating…
                  </p>
                )}
              </div>
              <p className="mt-3 font-mono text-[9px] text-slate-600">ACTIONS ARE ADVISORY RECOMMENDATIONS — NOT MEASURED DATA</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kv({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
      <p className="font-mono text-[8px] tracking-widest text-slate-600">{k}</p>
      <p className={`truncate font-mono text-[10.5px] font-bold ${accent ? 'text-emerald-300' : 'text-slate-300'}`}>{v}</p>
    </div>
  );
}
