import { ArrowRight, ClipboardCheck, Gauge, MapPinned, Rocket } from 'lucide-react';
import { useAppStore, useT } from '@/store/useAppStore';
import { SectionHeading } from '@/components/ui/bits';

const PREVIEW_STEPS = [
  { icon: MapPinned, label: 'Select territory' },
  { icon: ClipboardCheck, label: 'Choose priority modules' },
  { icon: Gauge, label: 'Estimate monitored area' },
  { icon: Rocket, label: 'Instant feasibility scope' },
];

export function PilotSection() {
  const t = useT();
  const setPilotOpen = useAppStore((s) => s.setPilotOpen);

  return (
    <section id="pilot" className="relative scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading kicker="07 · PILOT" title={t('pilot.title')} sub={t('pilot.sub')} />

        <div className="glass relative overflow-hidden rounded-3xl p-8 sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-tech-grid opacity-40" />
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-moss-400/10 blur-3xl" />

          <div className="relative grid gap-10 lg:grid-cols-[1fr_360px]">
            <div>
              <h3 className="font-display text-2xl font-bold text-white">
                Equip your state with a sovereign environmental picture — in weeks, not procurement cycles.
              </h3>
              <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-slate-400">
                The pilot program deploys a complete virtual sensor grid over one territory of your choice.
                Four configuration steps generate an instant feasibility scope; no budget line for hardware,
                no field engineering, no maintenance contracts.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {PREVIEW_STEPS.map((s, i) => (
                  <div key={s.label} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg border border-moss-400/30 bg-moss-400/10 text-moss-300">
                      <s.icon size={15} />
                    </span>
                    <span className="text-[13px] font-medium text-slate-200">
                      <span className="mr-2 font-mono text-[10px] text-slate-600">0{i + 1}</span>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setPilotOpen(true)}
                className="group mt-7 inline-flex items-center gap-2 rounded-lg bg-moss-400 px-6 py-3 text-sm font-bold text-forest-950 shadow-[0_0_30px_rgba(74,222,128,0.4)] transition-all hover:bg-moss-300"
              >
                Open Pilot Request
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

            {/* Scope preview card */}
            <div className="rounded-2xl border border-grid bg-forest-950/70 p-5 font-mono text-[11px]">
              <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-moss-400">
                Scope Engine · Preview
              </p>
              <div className="space-y-2.5 text-slate-400">
                <Row k="TERRITORY" v="SELECTED IN STEP 1" />
                <Row k="DATA SOURCES" v="Public APIs · zero devices" />
                <Row k="PHYSICAL DEVICES" v="0" accent />
                <Row k="CAPEX" v="EUR 0" accent />
                <Row k="REFRESH CYCLE" v="<15 MIN" />
                <Row k="COVERAGE" v="100% EARTH" accent />
                <Row k="AGENCIES" v="4 SEATS INCLUDED" />
                <Row k="SITREP ARCHIVE" v="HASH-CHAINED" />
              </div>
              <div className="mt-5 border-t border-grid pt-4 text-[9.5px] leading-relaxed text-slate-600">
                FINAL SCOPE IS GENERATED IN STEP 4 WITH YOUR PARAMETERS AND EXPORTED AS A PDF BRIEFING.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/4 pb-2">
      <span className="text-[10px] tracking-widest text-slate-600">{k}</span>
      <span className={accent ? 'font-bold text-emerald-300' : 'text-slate-200'}>{v}</span>
    </div>
  );
}
