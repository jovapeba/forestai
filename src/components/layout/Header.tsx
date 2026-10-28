import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Globe2, Menu, Radar, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { TERRITORIES } from '@/data/territoriesData';
import { LanguageBar } from './LanguageBar';
import { useT } from '@/store/useAppStore';

const NAV = [
  { href: '#global', key: 'nav.global' },
  { href: '#modules', key: 'nav.modules' },
  { href: '#technology', key: 'nav.technology' },
  { href: '#virtual-grid', key: 'nav.grid' },
  { href: '#command', key: 'nav.command' },
  { href: '#benefits', key: 'nav.benefits' },
  { href: '#pilot', key: 'nav.pilot' },
];

export function Header() {
  const t = useT();
  const territoryCode = useAppStore((s) => s.territoryCode);
  const setTerritory = useAppStore((s) => s.setTerritory);
  const setPilotOpen = useAppStore((s) => s.setPilotOpen);
  const [territoryOpen, setTerritoryOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const active = TERRITORIES.find((t2) => t2.code === territoryCode) ?? TERRITORIES[0];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setTerritoryOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass-strong shadow-[0_8px_40px_rgba(0,0,0,0.45)]' : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        {/* Brand */}
        <a href="#top" className="flex items-center gap-3 shrink-0">
          <span className="relative grid h-9 w-9 place-items-center rounded-lg border border-moss-400/40 bg-forest-800">
            <Radar className="h-4.5 w-4.5 text-moss-400" size={18} />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-moss-400 shadow-[0_0_10px_2px_rgba(74,222,128,0.8)] animate-glow" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg font-800 font-extrabold tracking-tight text-white">
              VERDANT<span className="text-moss-400"> AI</span>
            </span>
            <span className="hidden sm:block font-mono text-[9px] uppercase tracking-[0.22em] text-slate-500">
              National Environmental Intelligence
            </span>
          </span>
        </a>

        {/* Nav */}
        <nav className="ml-4 hidden xl:flex items-center gap-1">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-[13px] font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              {t(n.key)}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          {/* Territory quick-selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setTerritoryOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-forest-800/70 px-3 py-2 text-[13px] text-slate-200 transition-colors hover:border-moss-400/40"
            >
              <Globe2 size={14} className="text-moss-400" />
              <span className="hidden sm:inline">{active.flag} {active.name}</span>
              <span className="sm:hidden">{active.flag}</span>
              <ChevronDown size={13} className={`text-slate-500 transition-transform ${territoryOpen ? 'rotate-180' : ''}`} />
            </button>
            {territoryOpen && (
              <div className="absolute right-0 top-11 w-72 overflow-hidden rounded-xl border border-grid bg-forest-900/95 shadow-2xl backdrop-blur-xl">
                <p className="border-b border-grid px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  Sovereign Territory Presets
                </p>
                {TERRITORIES.map((terr) => (
                  <button
                    key={terr.code}
                    onClick={() => {
                      setTerritory(terr.code);
                      setTerritoryOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-moss-400/10 ${
                      terr.code === territoryCode ? 'bg-moss-400/10' : ''
                    }`}
                  >
                    <span className="text-lg">{terr.flag}</span>
                    <span className="flex-1">
                      <span className="block text-[13px] font-semibold text-white">{terr.name}</span>
                      <span className="block font-mono text-[10px] text-slate-500">{terr.focusLabel}</span>
                    </span>
                    <span className="font-mono text-[10px] text-moss-400">{terr.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <a
            href="#global-map"
            className="hidden items-center gap-2 rounded-lg border border-moss-400/40 bg-forest-800/70 px-3 py-2 text-[13px] font-semibold text-moss-300 transition-colors hover:border-moss-400/70 hover:text-white sm:flex"
          >
            <Globe2 size={14} /> Global Map
          </a>

          <div className="hidden lg:block">
            <LanguageBar />
          </div>

          <button
            onClick={() => setPilotOpen(true)}
            className="hidden md:inline-flex items-center gap-2 rounded-lg bg-moss-400 px-4 py-2 text-[13px] font-bold text-forest-950 shadow-[0_0_24px_rgba(74,222,128,0.35)] transition-all hover:bg-moss-300 hover:shadow-[0_0_34px_rgba(74,222,128,0.55)]"
          >
            {t('cta.pilot')}
          </button>

          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-slate-300 xl:hidden"
            aria-label="Menu"
          >
            {mobileOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="glass-strong border-t border-grid px-4 pb-5 pt-2 xl:hidden">
          <nav className="grid gap-1">
            <a
              href="#global-map"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-lg bg-moss-400/10 px-3 py-2.5 text-sm font-semibold text-moss-300 hover:bg-moss-400/20"
            >
              <Globe2 size={15} /> Global Map — full screen
            </a>
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5"
              >
                {t(n.key)}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between gap-3">
            <LanguageBar />
            <button
              onClick={() => {
                setPilotOpen(true);
                setMobileOpen(false);
              }}
              className="rounded-lg bg-moss-400 px-4 py-2 text-[13px] font-bold text-forest-950"
            >
              {t('cta.pilot')}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
