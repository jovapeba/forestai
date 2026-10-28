import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { EnvironmentalMap } from '@/components/map/EnvironmentalMap';
import { Header } from '@/components/layout/Header';
import { getTerritory } from '@/data/territoriesData';

/**
 * Dedicated full-viewport GLOBAL MAP page (route `#global-map`).
 *
 * Forces the Global Earth View territory (worldwide fires, earthquakes,
 * GDACS alerts, JMA warnings, air grid, official gauges from every
 * integrated network) and renders the live map edge-to-edge — no marketing
 * sections. The shared feed orchestration (useLiveFeeds) is provided by App,
 * so entering/leaving this page never refetches anything.
 */
export function GlobalMapPage() {
  const setTerritory = useAppStore((s) => s.setTerritory);
  const territoryCode = useAppStore((s) => s.territoryCode);

  // The global map is the Global Earth View — switch the shared territory
  // on mount (only if the user was on a country view).
  useEffect(() => {
    if (territoryCode !== 'GL') setTerritory('GL');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const territory = getTerritory(territoryCode);

  return (
    <div className="flex min-h-svh flex-col bg-forest-950">
      <Header />
      <main className="flex flex-1 flex-col">
        {/* Context bar */}
        <div className="flex items-center justify-between gap-3 border-b border-grid bg-forest-900/60 px-3 py-2 sm:px-4">
          <a
            href="#top"
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-forest-800/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-300 transition-colors hover:border-moss-400/40 hover:text-white"
          >
            <ArrowLeft size={13} /> Site
          </a>
          <p className="truncate font-mono text-[10px] uppercase tracking-widest text-slate-400">
            <span className="text-moss-400">🌍 GLOBAL EARTH VIEW</span>
            <span className="hidden sm:inline"> · worldwide fires · earthquakes · GDACS alerts · air grid · official gauges</span>
            <span className="ml-2 text-slate-600">viewing: {territory.flag} {territory.name}</span>
          </p>
          <a
            href="#virtual-grid"
            className="hidden shrink-0 items-center gap-2 rounded-lg border border-moss-400/40 bg-forest-800/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-moss-300 transition-colors hover:bg-forest-800 sm:flex"
          >
            Country views
          </a>
        </div>

        {/* Full-bleed live map — EnvironmentalMap brings layer control,
            legend, HUD and mobile layer sheet with it */}
        <div className="relative flex-1 p-2 sm:p-3">
          <EnvironmentalMap className="h-[calc(100svh-8.5rem)] md:h-[calc(100svh-8rem)]" />
        </div>
      </main>
    </div>
  );
}
