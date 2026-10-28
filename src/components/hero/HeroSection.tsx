import { ArrowRight, Radar, Satellite, Signal, Waves } from 'lucide-react';
import { useAppStore, useT } from '@/store/useAppStore';
import { StatusBadge, useCountUp } from '@/components/ui/bits';

const NODES = [
  { top: '18%', left: '12%', delay: '0s', label: 'ST-02' },
  { top: '30%', left: '78%', delay: '0.9s', label: 'B-024' },
  { top: '58%', left: '22%', delay: '1.7s', label: 'HS-04' },
  { top: '72%', left: '70%', delay: '0.4s', label: 'ST-01' },
  { top: '44%', left: '55%', delay: '2.1s', label: 'SAT' },
];

export function HeroSection() {
  const t = useT();
  const setPilotOpen = useAppStore((s) => s.setPilotOpen);
  const layers = useCountUp(6, 1800);
  const refresh = useCountUp(15, 1600);

  return (
    <section id="top" className="relative flex min-h-[100svh] items-center overflow-hidden pt-16">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-tech-grid opacity-60" />
      <div className="absolute -top-40 left-1/2 h-[540px] w-[900px] -translate-x-1/2 rounded-full bg-moss-400/10 blur-[130px]" />
      <div className="absolute bottom-0 right-0 h-[420px] w-[560px] rounded-full bg-cyan-500/10 blur-[120px]" />

      {/* Radar instrument — right side */}
      <div className="pointer-events-none absolute -right-40 top-1/2 hidden -translate-y-1/2 lg:block">
        <div className="relative h-[640px] w-[640px]">
          <div className="radar-disc absolute inset-0 border border-grid" />
          <div className="radar-sweep absolute inset-0 animate-radar-sweep" />
          <div className="absolute inset-[12%] rounded-full border border-grid/70" />
          <div className="absolute inset-[30%] rounded-full border border-grid/60" />
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-moss-400 shadow-[0_0_16px_4px_rgba(74,222,128,0.7)]" />
          {NODES.map((n, i) => (
            <div key={i} className="absolute" style={{ top: n.top, left: n.left }}>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-moss-400" style={{ animationDelay: n.delay }} />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-moss-400/90" />
              </span>
              <span className="absolute left-3.5 top-0.5 whitespace-nowrap font-mono text-[9px] tracking-widest text-moss-400/80">
                {n.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating telemetry chips */}
      <div className="pointer-events-none absolute left-6 top-28 hidden xl:block animate-float">
        <StatusBadge tone="ok">REAL PUBLIC APIs · LIVE</StatusBadge>
      </div>
      <div className="pointer-events-none absolute bottom-24 left-16 hidden xl:block animate-float" style={{ animationDelay: '1.4s' }}>
        <StatusBadge tone="info">NASA FIRMS · GLOFAS · GBIF</StatusBadge>
      </div>
      <div className="pointer-events-none absolute bottom-40 right-16 hidden xl:block animate-float" style={{ animationDelay: '0.8s' }}>
        <StatusBadge tone="warn">ZERO SIMULATED DATA</StatusBadge>
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        <div className="max-w-3xl">
          <StatusBadge tone="ok" className="mb-6">{t('hero.badge')}</StatusBadge>

          <p className="font-mono text-sm font-semibold tracking-[0.35em] text-moss-300 uppercase">
            Vidi. Predvidi. Zaštiti.
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl xl:text-7xl">
            VERDANT:{' '}
            <span className="bg-gradient-to-r from-moss-400 via-moss-300 to-cyan-400 bg-clip-text text-transparent">
              SEE. PREDICT. PROTECT.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">{t('hero.sub')}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setPilotOpen(true)}
              className="group inline-flex items-center gap-2 rounded-lg bg-moss-400 px-6 py-3 text-sm font-bold text-forest-950 shadow-[0_0_30px_rgba(74,222,128,0.4)] transition-all hover:bg-moss-300 hover:shadow-[0_0_44px_rgba(74,222,128,0.6)]"
            >
              {t('cta.pilot')}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <a
              href="#virtual-grid"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 backdrop-blur transition-colors hover:border-moss-400/50 hover:text-moss-300"
            >
              <Radar size={16} className="text-moss-400" />
              Explore the Virtual Grid
            </a>
          </div>

          {/* Metric counters */}
          <div className="mt-14 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-grid bg-grid/60 md:grid-cols-4">
            <Metric index="01" value="1" render="01" label={t('hero.metric1')} icon={<Signal size={14} />} />
            <Metric index="02" value={layers} render={String(layers).padStart(2, '0')} label={t('hero.metric2')} icon={<Waves size={14} />} />
            <Metric index="03" value="0" render="0" label={t('hero.metric3')} icon={<Satellite size={14} />} />
            <Metric index="04" value={`<${refresh} min`} render={`<${refresh} min`} label={t('hero.metric4')} icon={<Radar size={14} />} />
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <a
        href="#global"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.3em] text-slate-600 uppercase transition-colors hover:text-moss-400"
      >
        ▼ Initiate scan
      </a>
    </section>
  );
}

function Metric({
  index,
  value,
  render,
  label,
  icon,
}: {
  index: string;
  value: string | number;
  render: string;
  label: string;
  icon: React.ReactNode;
}) {
  void value;
  return (
    <div className="group bg-forest-900/80 p-5 transition-colors hover:bg-forest-800">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-widest text-slate-600">{index}</span>
        <span className="text-moss-400/70 transition-colors group-hover:text-moss-400">{icon}</span>
      </div>
      <p className="mt-3 font-display text-2xl font-extrabold text-white tabular-nums">{render}</p>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">{label}</p>
    </div>
  );
}
