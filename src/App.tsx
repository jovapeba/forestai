import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useLiveFeeds, LiveFeedsProvider } from '@/hooks/useLiveFeeds';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/hero/HeroSection';
import { TerritoryScanner } from '@/components/scanner/TerritoryScanner';
import { MapSection } from '@/components/map/EnvironmentalMap';
import { CoreModulesGrid } from '@/components/modules/CoreModulesGrid';
import { ForestConsole } from '@/components/modules/ForestConsole';
import { FireSentinel } from '@/components/modules/FireSentinel';
import { WaterHydrograph } from '@/components/modules/WaterHydrograph';
import { AnimalTelemetry } from '@/components/modules/AnimalTelemetry';
import { SatelliteViewer } from '@/components/modules/SatelliteViewer';
import { CommandSection } from '@/components/command/CommandCenterSimulator';
import { HardwareVsVirtualTable } from '@/components/comparison/HardwareVsVirtualTable';
import { BenefitsSection } from '@/components/sections/BenefitsSection';
import { PilotSection } from '@/components/pilot/PilotSection';
import { PilotRequestModal } from '@/components/pilot/PilotRequestModal';
import { PanelErrorBoundary } from '@/components/ui/ErrorBoundary';

function Consoles() {
  return (
    <section className="relative pb-8">
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6">
        <PanelErrorBoundary label="CANOPY">
          <ForestConsole />
        </PanelErrorBoundary>
        <PanelErrorBoundary label="IGNIS">
          <FireSentinel />
        </PanelErrorBoundary>
        <PanelErrorBoundary label="FLUVIA">
          <WaterHydrograph />
        </PanelErrorBoundary>
        <PanelErrorBoundary label="FAUNA">
          <AnimalTelemetry />
        </PanelErrorBoundary>
        <PanelErrorBoundary label="ORBITA">
          <SatelliteViewer />
        </PanelErrorBoundary>
      </div>
    </section>
  );
}

export default function App() {
  const lang = useAppStore((s) => s.lang);
  const feeds = useLiveFeeds();

  // RTL support for Arabic; keep Leaflet panes LTR-friendly.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  return (
    <LiveFeedsProvider value={feeds}>
      <div className="relative min-h-screen overflow-x-clip bg-forest-950">
        <Header />
        <main>
          <HeroSection />
          <TerritoryScanner />
          <MapSection />
          <CoreModulesGrid />
          <Consoles />
          <CommandSection />
          <HardwareVsVirtualTable />
          <BenefitsSection />
          <PilotSection />
        </main>
        <Footer />
        <PilotRequestModal />
      </div>
    </LiveFeedsProvider>
  );
}
