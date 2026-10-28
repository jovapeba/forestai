import { ArrowDownRight, Flame, Mountain, Radio, Satellite, Trees, Waves } from 'lucide-react';
import { useT } from '@/store/useAppStore';
import { SectionHeading, StatusBadge } from '@/components/ui/bits';
import { useAppStore } from '@/store/useAppStore';

export const MODULES = [
  {
    id: 'console-forest',
    code: '01',
    name: 'CANOPY',
    tag: 'Canopy Health & Drought Stress',
    icon: Trees,
    color: '#22c55e',
    stats: ['4-layer soil probe', 'NDVI canopy index', 'deforestation risk'],
  },
  {
    id: 'console-fire',
    code: '02',
    name: 'IGNIS',
    tag: 'NASA FIRMS & Fire Weather Sentinel',
    icon: Flame,
    color: '#f59e0b',
    stats: ['FRP hotspots', 'FWI 0–100', 'wind vector'],
  },
  {
    id: 'console-water',
    code: '03',
    name: 'FLUVIA',
    tag: 'River Basins & 7-Day GloFAS Hydrograph',
    icon: Waves,
    color: '#14b8a6',
    stats: ['ST-01…ST-04', '20-yr threshold', 'flood forecast'],
  },
  {
    id: 'console-animal',
    code: '04',
    name: 'FAUNA',
    tag: 'Wildlife Biotelemetry & Corridors',
    icon: Mountain,
    color: '#a3e635',
    stats: ['GPS breadcrumbs', 'habitat breach', 'coexistence buffer'],
  },
  {
    id: 'console-satellite',
    code: '05',
    name: 'ORBITA',
    tag: 'Earth Observation Explorer',
    icon: Satellite,
    color: '#38bdf8',
    stats: ['GIBS true-color', 'NDVI sim', 'canopy stress'],
  },
  {
    id: 'console-command',
    code: '06',
    name: 'SENTRY',
    tag: 'National AI Incident Command',
    icon: Radio,
    color: '#ef4444',
    stats: ['SITREP engine', 'cascade view', 'agency dispatch'],
  },
];

export function CoreModulesGrid() {
  const t = useT();
  const lang = useAppStore((s) => s.lang);
  return (
    <section id="modules" className="relative scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading kicker="03 · MODULES" title={t('modules.title')} sub={t('modules.sub')} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <a
              key={m.id}
              href={`#${m.id}`}
              className="group relative overflow-hidden rounded-2xl border border-white/8 bg-forest-800/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
            >
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: `${m.color}26` }}
              />
              <div className="flex items-start justify-between">
                <span
                  className="grid h-11 w-11 place-items-center rounded-xl border"
                  style={{ borderColor: `${m.color}44`, background: `${m.color}12`, color: m.color }}
                >
                  <m.icon size={20} />
                </span>
                <span className="font-mono text-[10px] tracking-[0.25em] text-slate-600">{m.code}</span>
              </div>
              <h3 className="mt-5 font-display text-lg font-bold tracking-wide text-white">{m.name}</h3>
              <p className="mt-1 text-[13px] text-slate-400">{m.tag}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {m.stats.map((s) => (
                  <span
                    key={s}
                    className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-400"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4">
                <StatusBadge tone={m.id === 'console-command' ? 'danger' : 'ok'} pulse={m.id === 'console-command'}>
                  {m.id === 'console-command' ? 'STANDBY · ARMED' : 'LAYER ONLINE'}
                </StatusBadge>
                <span
                  className="flex items-center gap-1 text-[11px] font-semibold transition-transform group-hover:translate-x-0.5"
                  style={{ color: m.color }}
                >
                  OPEN CONSOLE <ArrowDownRight size={13} />
                </span>
              </div>
              <span className="absolute bottom-0 left-0 h-0.5 w-0 transition-all duration-500 group-hover:w-full" style={{ background: m.color }} />
              <span data-lang={lang} className="hidden" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
