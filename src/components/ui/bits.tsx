import { useEffect, useRef, useState, type ReactNode } from 'react';

/* ------------------------------ StatusBadge ---------------------------- */

const TONES = {
  ok: { dot: 'bg-emerald-400', text: 'text-emerald-300', ring: 'border-emerald-400/30 bg-emerald-400/10' },
  info: { dot: 'bg-cyan-400', text: 'text-cyan-300', ring: 'border-cyan-400/30 bg-cyan-400/10' },
  warn: { dot: 'bg-amber-400', text: 'text-amber-300', ring: 'border-amber-400/30 bg-amber-400/10' },
  danger: { dot: 'bg-red-400', text: 'text-red-300', ring: 'border-red-400/30 bg-red-400/10' },
  muted: { dot: 'bg-slate-400', text: 'text-slate-300', ring: 'border-white/15 bg-white/5' },
} as const;

export function StatusBadge({
  tone = 'ok',
  pulse = true,
  children,
  className = '',
}: {
  tone?: keyof typeof TONES;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold tracking-widest uppercase ${t.ring} ${t.text} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulse && <span className={`absolute inline-flex h-full w-full rounded-full ${t.dot} opacity-75 animate-ping-slow`} />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${t.dot}`} />
      </span>
      {children}
    </span>
  );
}

/* ---------------------------- SectionHeading --------------------------- */

export function SectionHeading({
  kicker,
  title,
  sub,
  align = 'center',
}: {
  kicker: string;
  title: ReactNode;
  sub?: string;
  align?: 'center' | 'left';
}) {
  return (
    <div className={`max-w-3xl ${align === 'center' ? 'mx-auto text-center' : ''} mb-10`}>
      <p className="font-mono text-[11px] font-semibold tracking-[0.3em] uppercase text-moss-400 mb-3">{kicker}</p>
      <h2 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight">{title}</h2>
      {sub && <p className="mt-4 text-slate-400 leading-relaxed">{sub}</p>}
    </div>
  );
}

/* -------------------------------- useT hook already in store; helpers --- */

export function useCountUp(target: number, durationMs = 1400): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    // interval-based so progress also completes in background/hidden tabs
    const id = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, durationMs]);
  return value;
}

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/* ------------------------------ source chip ---------------------------- */

export function SourceChip({ source }: { source: string }) {
  const live = source.startsWith('LIVE');
  const derived = source.startsWith('DERIVED');
  const unavailable = source === 'UNAVAILABLE';
  const na = source === 'NOT-APPLICABLE';
  const tone = unavailable
    ? 'border-red-400/40 bg-red-400/10 text-red-300'
    : na
      ? 'border-white/15 bg-white/5 text-slate-400'
      : live
        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
        : derived
          ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
          : 'border-cyan-400/30 bg-cyan-400/5 text-cyan-200/80';
  const glyph = live ? '●' : derived ? '△' : unavailable ? '✕' : na ? '◌' : '○';
  const tip = live
    ? 'Feed integrity: direct public-API link (real data)'
    : derived
      ? 'Transparent derivation from real live API inputs'
      : unavailable
        ? 'Feed unavailable — NO data is shown or simulated'
        : na
          ? 'Territory-scoped feed — not applicable in this view'
          : 'Feed state';
  return (
    <span
      title={tip}
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[9px] tracking-wider ${tone}`}
    >
      {glyph} {source}
    </span>
  );
}
