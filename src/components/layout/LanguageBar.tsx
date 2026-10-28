import { useAppStore } from '@/store/useAppStore';
import { LANGS } from '@/data/translations';

export function LanguageBar({ compact = false }: { compact?: boolean }) {
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  return (
    <div
      role="group"
      aria-label="Language"
      className={`flex items-center gap-0.5 rounded-full border border-white/10 bg-forest-800/60 p-0.5 ${compact ? '' : ''}`}
    >
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          title={l.name}
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider transition-colors ${
            lang === l.code ? 'bg-moss-400/20 text-moss-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
