import { FileCheck2, HeartPulse, Landmark, Network, ShieldCheck, Siren } from 'lucide-react';
import { useT } from '@/store/useAppStore';
import { SectionHeading } from '@/components/ui/bits';

const PILLARS = [
  {
    icon: ShieldCheck,
    title: 'Data Sovereignty & Security',
    text: 'All environmental intelligence flows into your national infrastructure — open sources, sovereign ownership, no foreign device fleet inside your borders.',
  },
  {
    icon: Network,
    title: 'Multi-Agency Coordination',
    text: 'Civil defense, water authorities, forestry and wildlife services read from one operational picture — ending the data silo that costs response hours.',
  },
  {
    icon: Siren,
    title: 'Pre-Disaster Early Warnings',
    text: 'FWI spikes, GloFAS threshold exceedances and predator buffer breaches surface hours-to-days before impact, not after.',
  },
  {
    icon: FileCheck2,
    title: 'Verifiable Incident History',
    text: 'Every alert, layer correlation and dispatch action is archived as a hash-chained record — audit-ready evidence for every event.',
  },
  {
    icon: HeartPulse,
    title: 'Community & Infrastructure Protection',
    text: 'Villages, dikes, agricultural land and habitats sit inside the same monitored envelope as the wilderness around them.',
  },
  {
    icon: Landmark,
    title: 'EU ESG & Natural Capital Reporting (Digital MRV)',
    text: 'Continuous satellite-verified monitoring produces regulator-ready MRV outputs for ESG disclosure and natural-capital accounting.',
  },
];

export function BenefitsSection() {
  const t = useT();
  return (
    <section id="benefits" className="relative scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading kicker="06 · BENEFITS" title={t('benefits.title')} sub={t('benefits.sub')} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p, i) => (
            <div
              key={p.title}
              className="group relative overflow-hidden rounded-2xl border border-white/8 bg-forest-800/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-moss-400/30"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-moss-400/30 bg-moss-400/10 text-moss-300 transition-transform group-hover:scale-105">
                <p.icon size={19} />
              </span>
              <span className="absolute right-5 top-5 font-mono text-[10px] text-slate-700">0{i + 1}</span>
              <h3 className="mt-4 font-display text-[16px] font-bold leading-snug text-white">{p.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
