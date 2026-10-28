import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, Mail, MapPin, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { TERRITORIES, getTerritory } from '@/data/territoriesData';
import { MODULES } from '@/components/modules/CoreModulesGrid';
import { generatePilotBriefing } from '@/services/pdf';

const MODULE_COLORS: Record<string, string> = {
  'console-forest': '#22c55e',
  'console-fire': '#f59e0b',
  'console-water': '#14b8a6',
  'console-animal': '#a3e635',
  'console-satellite': '#38bdf8',
  'console-command': '#ef4444',
};

export function PilotRequestModal() {
  const open = useAppStore((s) => s.pilotOpen);
  const setOpen = useAppStore((s) => s.setPilotOpen);
  const territoryCode = useAppStore((s) => s.territoryCode);

  const [step, setStep] = useState(0);
  const [territory, setTerritory] = useState(territoryCode);
  const [modules, setModules] = useState<string[]>(['console-fire', 'console-water', 'console-command']);
  const [hectares, setHectares] = useState(500_000);
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [ref] = useState(() => `VERDANT-PILOT-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`);

  const territoryObj = getTerritory(territory);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const canNext = step === 2 ? emailValid && email.length > 0 : true;

  const virtualSensors = useMemo(() => Math.max(12, Math.ceil(hectares / 500)), [hectares]);

  const download = () => {
    const blob = generatePilotBriefing({
      reference: ref,
      territory: territoryObj.name,
      modules: modules.map((m) => MODULES.find((x) => x.id === m)?.name ?? m),
      hectares,
      email: email || 'state-agency@national.gov',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VERDANT-Pilot-Briefing-${territoryObj.code}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const close = () => {
    setOpen(false);
    setStep(0);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-forest-950/80 p-4 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={close}
        aria-hidden
      />
      <div className="glass-strong relative w-full max-w-2xl overflow-hidden rounded-3xl shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid px-7 py-5">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-moss-400">
              National Pilot Program · Zero-Device
            </p>
            <h3 className="mt-1 font-display text-xl font-bold text-white">Request State Pilot</h3>
          </div>
          <button onClick={close} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 px-7 pt-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-moss-400' : 'bg-white/10'}`} />
          ))}
        </div>

        <div className="px-7 py-6">
          {step === 0 && (
            <div>
              <StepLabel n="01" title="Select Territory" sub="Where should the sovereign virtual grid operate?" />
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {TERRITORIES.map((tr) => (
                  <button
                    key={tr.code}
                    onClick={() => setTerritory(tr.code)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                      territory === tr.code ? 'border-moss-400/60 bg-moss-400/10' : 'border-white/10 bg-white/[0.02] hover:border-moss-400/30'
                    }`}
                  >
                    <span className="text-xl">{tr.flag}</span>
                    <span className="flex-1">
                      <span className="block text-[13px] font-semibold text-white">{tr.name}</span>
                      <span className="block font-mono text-[9.5px] text-slate-500">{tr.focusLabel}</span>
                    </span>
                    {territory === tr.code && <Check size={15} className="text-moss-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <StepLabel n="02" title="Choose Priority Modules" sub="Select the intelligence layers your agencies need first." />
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {MODULES.map((m) => {
                  const on = modules.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => setModules((prev) => (on ? prev.filter((x) => x !== m.id) : [...prev, m.id]))}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                        on ? 'border-white/25 bg-white/[0.05]' : 'border-white/10 bg-white/[0.015] hover:border-white/20'
                      }`}
                      style={on ? { borderColor: `${MODULE_COLORS[m.id]}66`, background: `${MODULE_COLORS[m.id]}0e` } : undefined}
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-lg border" style={{ borderColor: `${MODULE_COLORS[m.id]}55`, color: MODULE_COLORS[m.id] }}>
                        <m.icon size={15} />
                      </span>
                      <span className="flex-1">
                        <span className="block font-mono text-[11px] font-bold text-white">{m.name}</span>
                        <span className="block text-[10.5px] text-slate-500">{m.tag}</span>
                      </span>
                      {on && <Check size={14} style={{ color: MODULE_COLORS[m.id] }} />}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 font-mono text-[9.5px] text-slate-600">
                {modules.length} MODULE{modules.length === 1 ? '' : 'S'} SELECTED · MIN 1 REQUIRED
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <StepLabel n="03" title="Monitored Area & Contact" sub="Estimate the territory envelope and verify your state email." />
              <div className="mt-5 rounded-2xl border border-grid bg-forest-950/60 p-5">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-slate-500">MONITORED AREA</span>
                  <span className="font-bold text-moss-300 tabular-nums">{hectares.toLocaleString()} ha</span>
                </div>
                <input
                  type="range"
                  min={50_000}
                  max={5_000_000}
                  step={10_000}
                  value={hectares}
                  onChange={(e) => setHectares(Number(e.target.value))}
                  className="mt-3 w-full"
                />
                <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-600">
                  <span>50K HA</span>
                  <span>5M HA</span>
                </div>
                <p className="mt-3 border-t border-white/5 pt-3 font-mono text-[9.5px] text-slate-500">
                  REFERENCE: {territoryObj.name} · {territoryObj.basin} · all live public APIs, zero devices
                </p>
              </div>

              <div className="mt-4 rounded-2xl border border-grid bg-forest-950/60 p-5">
                <label className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <Mail size={12} className="text-moss-400" /> State Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="ministry.environment@gov.example"
                  className={`mt-2.5 w-full rounded-lg border bg-forest-950 px-4 py-2.5 font-mono text-[12px] text-white placeholder:text-slate-700 focus:outline-none ${
                    emailTouched && !emailValid ? 'border-red-400/60' : emailValid ? 'border-moss-400/50' : 'border-white/15'
                  }`}
                />
                {emailTouched && !emailValid && (
                  <p className="mt-1.5 font-mono text-[9px] text-red-400">EMAIL VERIFICATION FAILED — VALID STATE ADDRESS REQUIRED</p>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <StepLabel n="04" title="Instant Pilot Feasibility Scope" sub="Generated from your parameters by the VERDANT scope engine." />
              <div className="mt-5 rounded-2xl border border-moss-400/30 bg-moss-400/[0.05] p-5">
                <div className="flex items-center gap-2.5">
                  <Sparkles size={15} className="text-moss-400" />
                  <p className="font-display text-[15px] font-bold text-white">
                    {territoryObj.flag} {territoryObj.name} — Sovereign Virtual Grid
                  </p>
                  <span className="ml-auto rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 font-mono text-[9px] font-bold text-emerald-300">
                    FEASIBLE
                  </span>
                </div>
                <div className="mt-4 grid gap-x-6 gap-y-2.5 font-mono text-[11px] sm:grid-cols-2">
                  <Kv k="REFERENCE" v={ref} />
                  <Kv k="MONITORED AREA" v={`${hectares.toLocaleString()} ha`} />
                  <Kv k="VIRTUAL SENSOR NODES" v={`~${virtualSensors}`} accent />
                  <Kv k="PHYSICAL DEVICES" v="0" accent />
                  <Kv k="CAPEX" v="EUR 0" accent />
                  <Kv k="REFRESH CYCLE" v="< 15 min" />
                  <Kv k="EARTH COVERAGE" v="100%" accent />
                  <Kv k="AGENCY SEATS" v="4 INCLUDED" />
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {modules.map((m) => {
                    const mod = MODULES.find((x) => x.id === m);
                    return (
                      <span key={m} className="rounded border px-2 py-0.5 font-mono text-[9px] font-bold" style={{ borderColor: `${MODULE_COLORS[m]}55`, color: MODULE_COLORS[m], background: `${MODULE_COLORS[m]}0f` }}>
                        {mod?.name}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-4 border-t border-moss-400/15 pt-3 text-[11.5px] leading-relaxed text-slate-400">
                  Scope confirmation will be sent to <span className="font-mono text-moss-300">{email}</span>. The 30-day pilot activates
                  territory ingestion for {territoryObj.focusLabel} — all feeds are open data, so activation is instant.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={download}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-[12.5px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/20"
                >
                  <Download size={14} /> Download PDF Briefing
                </button>
                <button
                  onClick={close}
                  className="inline-flex items-center gap-2 rounded-lg bg-moss-400 px-5 py-2.5 text-[12.5px] font-bold text-forest-950 transition-colors hover:bg-moss-300"
                >
                  <ShieldCheck size={14} /> Confirm & Submit Request
                </button>
              </div>
              <p className="mt-3 flex items-center gap-1.5 font-mono text-[9px] text-slate-600">
                <MapPin size={10} /> Simulated briefing — production pilots receive a digitally signed PDF.
              </p>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between border-t border-grid px-7 py-4">
          <button
            onClick={() => (step === 0 ? close() : setStep((s) => s - 1))}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[12.5px] font-medium text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft size={14} /> {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < 3 && (
            <button
              onClick={() => canNext && setStep((s) => s + 1)}
              disabled={!canNext || (step === 1 && modules.length === 0)}
              className="inline-flex items-center gap-2 rounded-lg bg-moss-400 px-5 py-2 text-[12.5px] font-bold text-forest-950 transition-all enabled:hover:bg-moss-300 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Continue <ArrowRight size={14} />
            </button>
          )}
          {step === 3 && <span className="font-mono text-[10px] text-slate-600">SCOPE GENERATED</span>}
        </div>
      </div>
    </div>
  );
}

function StepLabel({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.3em] text-moss-400 uppercase">
        STEP {n} <span className="h-px w-6 bg-moss-400/40" />
      </p>
      <h4 className="mt-2 font-display text-lg font-bold text-white">{title}</h4>
      <p className="mt-1 text-[12.5px] text-slate-500">{sub}</p>
    </div>
  );
}

function Kv({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-white/6 pb-1.5">
      <span className="text-[9.5px] tracking-widest text-slate-600">{k}</span>
      <span className={`font-bold ${accent ? 'text-emerald-300' : 'text-slate-200'}`}>{v}</span>
    </div>
  );
}
