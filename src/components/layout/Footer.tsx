import { Heart, Radar, Satellite, Waves, Bird } from 'lucide-react';
import { useT } from '@/store/useAppStore';
import { useNow } from '@/components/ui/bits';

const FEEDS = [
  { icon: Satellite, label: 'NASA GIBS · MODIS Terra', status: 'OK' },
  { icon: Radar, label: 'NASA FIRMS · VIIRS C2', status: 'OK' },
  { icon: Waves, label: 'Copernicus GloFAS', status: 'OK' },
  { icon: Bird, label: 'GBIF / Movebank-model', status: 'OK' },
];

export function Footer() {
  const t = useT();
  const now = useNow(1000);

  return (
    <footer className="relative border-t border-grid bg-forest-900/60">
      {/* Marquee status strip */}
      <div className="overflow-hidden border-b border-grid bg-forest-950/80 py-2">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap px-6 font-mono text-[10px] tracking-widest text-emerald-300/80 uppercase">
          {Array.from({ length: 2 }).map((_, dup) => (
            <span key={dup} className="flex gap-10">
              <span>ALL SERVICES NOMINAL</span>
              {FEEDS.map((f) => (
                <span key={f.label} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.9)]" />
                  {f.label}: {f.status}
                </span>
              ))}
              <span>UTC {now.toISOString().slice(11, 19)}</span>
              <span>DATA INTEGRITY: 99.8%</span>
              <span>ORBITAL PASS: 14M AGO</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-moss-400/40 bg-forest-800">
              <Radar className="text-moss-400" size={18} />
            </span>
            <span className="font-display text-lg font-extrabold text-white">
              VERDANT<span className="text-moss-400"> AI</span>
            </span>
          </div>
          <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-slate-400">{t('footer.disclaimer')}</p>
          <p className="mt-4 font-mono text-[10px] tracking-widest text-slate-600 uppercase">
            Zero-Device Sovereign Architecture · {new Date().getFullYear()}
          </p>
        </div>

        <div>
          <h4 className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">Modules</h4>
          <ul className="mt-4 space-y-2.5 text-[13px] text-slate-400">
            {['CANOPY', 'IGNIS', 'FLUVIA', 'FAUNA', 'ORBITA', 'SENTRY'].map((m) => (
              <li key={m}>
                <a href="#modules" className="transition-colors hover:text-moss-300">{m}</a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">Platform</h4>
          <ul className="mt-4 space-y-2.5 text-[13px] text-slate-400">
            <li><a href="#virtual-grid" className="transition-colors hover:text-moss-300">Virtual Grid</a></li>
            <li><a href="#command" className="transition-colors hover:text-moss-300">Command Center</a></li>
            <li><a href="#benefits" className="transition-colors hover:text-moss-300">Benefits for the State</a></li>
            <li><a href="#pilot" className="transition-colors hover:text-moss-300">National Pilot</a></li>
            <li><a href="#global" className="transition-colors hover:text-moss-300">Territory Scanner</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">Data Feeds</h4>
          <ul className="mt-4 space-y-2.5">
            {FEEDS.map((f) => (
              <li key={f.label} className="flex items-center gap-2.5 text-[13px] text-slate-400">
                <f.icon size={14} className="text-moss-400" />
                <span className="flex-1">{f.label}</span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {f.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-2 text-[12px] text-slate-500">
            <Heart size={12} className="text-red-400" /> Built for state agencies, built on open data.
          </p>
        </div>
      </div>
    </footer>
  );
}
