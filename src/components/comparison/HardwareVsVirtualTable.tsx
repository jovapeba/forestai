import { ArrowRight, Boxes, Check, Database, Download, Globe2, LayoutDashboard, Wifi, X } from 'lucide-react';
import { useT } from '@/store/useAppStore';
import { SectionHeading, StatusBadge } from '@/components/ui/bits';

const ROWS: { label: string; hw: string; virtual: string }[] = [
  { label: 'Capital Expenditure', hw: 'Millions (€ device fleets)', virtual: '€0 — public APIs only' },
  { label: 'Deployment Time', hw: 'Months (site survey + install)', virtual: 'Instant — territory ingestion' },
  { label: 'Global Reach', hw: 'Limited to mounted sites', virtual: '100% Earth coverage' },
  { label: 'Maintenance', hw: 'Battery swaps, probe cleaning', virtual: 'Zero maintenance' },
  { label: 'Failure Mode', hw: 'Dead node = data hole', virtual: 'Multi-source redundancy' },
  { label: 'Scalability', hw: 'Linear cost per sensor', virtual: 'Unlimited virtual nodes' },
];

const STEPS = [
  {
    icon: Globe2,
    title: 'Territory Ingestion',
    text: 'A sovereign territory is enrolled by drawing its boundary — FIRMS, GloFAS, GBIF, Open-Meteo and GIBS streams are bound to the area in seconds.',
  },
  {
    icon: Database,
    title: 'API Stream Normalization',
    text: 'Every heterogeneous feed is calibrated into one virtual telemetry schema: coordinates, timestamps, quality flags, threat envelopes.',
  },
  {
    icon: LayoutDashboard,
    title: 'Multi-Agency Dashboard',
    text: 'Forestry, water authority, wildlife service and civil defense operate from the same sovereign picture — one event, one decision.',
  },
];

export function HardwareVsVirtualTable() {
  const t = useT();
  return (
    <section id="technology" className="relative scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading kicker="05 · TECHNOLOGY" title={t('tech.title')} sub={t('tech.sub')} />

        {/* Comparison table */}
        <div className="glass overflow-hidden rounded-3xl">
          <div className="grid grid-cols-[1.1fr_1fr_1fr] border-b border-grid bg-forest-900/80 font-mono text-[10px] font-bold uppercase tracking-[0.18em]">
            <div className="px-5 py-4 text-slate-500">Dimension</div>
            <div className="flex items-center gap-2 px-5 py-4 text-slate-400">
              <Wifi size={13} className="text-slate-500" /> Traditional Hardware IoT
            </div>
            <div className="flex items-center gap-2 border-l border-grid bg-moss-400/[0.06] px-5 py-4 text-moss-300">
              <Boxes size={13} /> VERDANT Zero-Device Virtual Sensors
            </div>
          </div>
          {ROWS.map((r, i) => (
            <div key={r.label} className={`grid grid-cols-[1.1fr_1fr_1fr] border-b border-white/4 ${i % 2 ? 'bg-white/[0.015]' : ''}`}>
              <div className="px-5 py-4 text-[13px] font-semibold text-white">{r.label}</div>
              <div className="flex items-center gap-2.5 px-5 py-4 text-[12.5px] text-slate-500">
                <X size={13} className="shrink-0 text-red-400/70" /> {r.hw}
              </div>
              <div className="flex items-center gap-2.5 border-l border-grid bg-moss-400/[0.045] px-5 py-4 text-[12.5px] text-moss-200">
                <Check size={13} className="shrink-0 text-moss-400" /> {r.virtual}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <StatusBadge tone="ok">ZERO-DEVICE VERIFIED · 100% OPEN-DATA TELEMETRY</StatusBadge>
            <p className="font-mono text-[10px] text-slate-600">SOURCES: NASA · NOAA · ESA/COPERNICUS · GBIF · OPEN-METEO</p>
          </div>
        </div>

        {/* Lifecycle */}
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="glass relative overflow-hidden rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-moss-400/30 bg-moss-400/10 text-moss-300">
                  <s.icon size={19} />
                </span>
                <span className="font-display text-4xl font-extrabold text-white/8">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-white">{s.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{s.text}</p>
              {i < STEPS.length - 1 && (
                <ArrowRight size={18} className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-moss-400/60 lg:block" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-5 py-4">
          <Download size={15} className="text-cyan-300" />
          <p className="flex-1 text-[13px] text-cyan-100/80">
            Every territory becomes a sovereign virtual grid: <span className="font-mono text-cyan-300">ingest → normalize → operate</span>. No towers, no collars, no river probes — and no decade-long procurement cycle.
          </p>
          <a href="#pilot" className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-[12px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/20">
            Scope your territory <ArrowRight size={13} />
          </a>
        </div>
      </div>
    </section>
  );
}
