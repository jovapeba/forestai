import { Component, type ReactNode } from 'react';

/**
 * Error boundary for one console panel. A crash in a single panel (e.g. an
 * unexpected API shape) must never blank the whole application — the boundary
 * keeps the rest of the operational picture alive and states the problem.
 */
export class PanelErrorBoundary extends Component<{ label: string; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[${this.props.label}] panel crashed:`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass rounded-3xl p-8 text-center">
          <p className="font-mono text-[10px] tracking-[0.3em] text-red-300 uppercase">{this.props.label}</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Panel failed to render</h3>
          <p className="mx-auto mt-3 max-w-md text-[12.5px] leading-relaxed text-slate-400">
            A rendering error occurred in this console only. All other panels, the map and live feeds are unaffected.
            No data was faked to fill this panel — reload to retry.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
