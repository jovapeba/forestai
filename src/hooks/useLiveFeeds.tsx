import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getTerritory } from '@/data/territoriesData';
import { fetchFireWeather, fetchHotspots, fetchSoilMoisture, fetchAirQuality } from '@/services/api/openMeteoService';
import { fetchRiverDischarge } from '@/services/api/floodService';
import { fetchTerritoryEvents, type EventBundle } from '@/services/api/eventsService';
import { fetchRainRadar } from '@/services/api/rainRadarService';
import { fetchFireIncidents, fetchFirePerimeters, type FireIncident, type FirePerimeter } from '@/services/api/fireIncidentsService';
import { fetchUsDrought, fetchCountyAqi, type UsIndexPoint } from '@/services/api/usIndexService';
import type { RainRadar } from '@/types/environmental';
import {
  fetchOccurrences,
  fetchSpeciesObservations,
  fetchInatSpeciesObservations,
  type SpeciesObservations,
} from '@/services/api/wildlifeService';
import { fetchRealGauges } from '@/services/api/waterLevelService';
import { fetchUsgsDailyGages } from '@/services/api/waterdataDevService';
import { fetchAmedas, type AmedasRow } from '@/services/api/amedasService';
import { fetchCityAqGrid, type CityAqRow } from '@/services/api/cityAqService';
import type {
  FireHotspot,
  FireWeather,
  FireIndex,
  HydrographPoint,
  Occurrence,
  RealGauge,
  SoilPoint,
  AirQuality,
  UsgsDailyGage,
  FeedSource,
} from '@/types/environmental';

export interface LiveFeeds {
  viewMode: 'country' | 'global';
  weather: FireWeather | null;
  index: FireIndex | null;
  hotspots: FireHotspot[];
  hotspotsSource: FeedSource;
  hydro: HydrographPoint[];
  hydroSource: FeedSource;
  soil: SoilPoint[];
  soilSource: FeedSource;
  air: AirQuality | null;
  airSource: FeedSource;
  occurrences: Occurrence[];
  occurrencesSource: FeedSource;
  speciesObs: SpeciesObservations[];
  realGauges: RealGauge[];
  realGaugesSource: FeedSource;
  events: EventBundle;
  rainRadar: RainRadar;
  usgsGages: UsgsDailyGage[];
  usgsGagesSource: FeedSource;
  fireIncidents: FireIncident[];
  fireIncidentsSource: FeedSource;
  firePerimeters: FirePerimeter[];
  firePerimetersSource: FeedSource;
  usDrought: UsIndexPoint[];
  usDroughtSource: FeedSource;
  countyAqi: UsIndexPoint[];
  countyAqiSource: FeedSource;
  amedas: AmedasRow[];
  amedasSource: FeedSource;
  amedasFrame: string | null;
  cityAq: CityAqRow[];
  cityAqSource: FeedSource;
  booted: boolean;
}

/** Declarative feed runner: fetch → know when the result is genuinely DOWN. */
interface FeedRunner {
  run: () => Promise<unknown>;
  apply: (bundle: unknown) => Partial<LiveFeeds>;
  isDown: (bundle: unknown) => boolean;
}

const down = (b: { source: FeedSource }): boolean => b.source === 'UNAVAILABLE';

const EMPTY_BUNDLE: EventBundle = { items: [], sources: [] };

const INITIAL: Omit<LiveFeeds, 'viewMode'> = {
  weather: null,
  index: null,
  hotspots: [],
  hotspotsSource: 'UNAVAILABLE' as FeedSource,
  hydro: [],
  hydroSource: 'UNAVAILABLE' as FeedSource,
  soil: [],
  soilSource: 'UNAVAILABLE' as FeedSource,
  air: null,
  airSource: 'UNAVAILABLE' as FeedSource,
  occurrences: [],
  occurrencesSource: 'UNAVAILABLE' as FeedSource,
  speciesObs: [],
  realGauges: [],
  realGaugesSource: 'UNAVAILABLE' as FeedSource,
  events: EMPTY_BUNDLE,
  rainRadar: { framePath: null, frameTime: null, source: 'UNAVAILABLE' as FeedSource },
  usgsGages: [],
  usgsGagesSource: 'UNAVAILABLE' as FeedSource,
  fireIncidents: [],
  fireIncidentsSource: 'NOT-APPLICABLE' as FeedSource,
  firePerimeters: [],
  firePerimetersSource: 'NOT-APPLICABLE' as FeedSource,
  usDrought: [],
  usDroughtSource: 'NOT-APPLICABLE' as FeedSource,
  countyAqi: [],
  countyAqiSource: 'NOT-APPLICABLE' as FeedSource,
  amedas: [],
  amedasSource: 'NOT-APPLICABLE' as FeedSource,
  amedasFrame: null,
  cityAq: [],
  cityAqSource: 'UNAVAILABLE' as FeedSource,
  booted: false,
};

/**
 * Single orchestration point for all public data feeds. Feeds land
 * PROGRESSIVELY as each request resolves (FIRMS CSV is ~4 MB, weather ~1 KB —
 * nothing waits for the slowest). There is NO simulated fallback: while a
 * feed is loading the UI shows an explicit loading state, and if a feed fails
 * it shows an explicit UNAVAILABLE state. In the global earth view,
 * point-scoped feeds are labelled NOT-APPLICABLE.
 *
 * Reliability: after the first pass, every feed that ended genuinely
 * UNAVAILABLE (not NOT-APPLICABLE, not a legitimately-empty live window) is
 * silently re-fetched once after a short delay. Cold CDN edges, brief proxy
 * hiccups and dev-server restarts would otherwise strand a feed for the
 * whole session.
 */
export function useLiveFeeds(): LiveFeeds {
  const territoryCode = useAppStore((s) => s.territoryCode);
  const territory = getTerritory(territoryCode);
  const [feeds, setFeeds] = useState<LiveFeeds>(() => ({
    ...INITIAL,
    viewMode: 'country' as const,
  }));
  const feedsRef = useRef<LiveFeeds>(feeds);

  const land = (patch: Partial<LiveFeeds>) => {
    feedsRef.current = { ...feedsRef.current, ...patch };
    setFeeds((prev) => ({ ...prev, ...patch }));
  };

  useEffect(() => {
    let cancelled = false;
    const isGlobal = Boolean(territory.global);
    feedsRef.current = { ...INITIAL, viewMode: isGlobal ? 'global' : 'country' };
    setFeeds({ ...feedsRef.current });

    const pointRunner: FeedRunner = {
      // Point-scoped feeds (weather/FWI, soil, air, GloFAS hydrograph) are not
      // applicable in the global earth view — labelled NOT-APPLICABLE.
      run: async () => {
        if (isGlobal) {
          return {
            weather: null,
            index: null,
            hydro: [],
            hydroSource: 'NOT-APPLICABLE' as FeedSource,
            soil: [],
            soilSource: 'NOT-APPLICABLE' as FeedSource,
            air: null,
            airSource: 'NOT-APPLICABLE' as FeedSource,
            speciesObs: [] as SpeciesObservations[],
          };
        }
        const wx = await fetchFireWeather(territory);
        const hy = await fetchRiverDischarge(territory).catch(() => ({ points: [], source: 'UNAVAILABLE' as FeedSource }));
        const soil = await fetchSoilMoisture(territory).catch(() => ({ items: [], source: 'UNAVAILABLE' as FeedSource }));
        const air = await fetchAirQuality(territory).catch(() => ({ air: null, source: 'UNAVAILABLE' as FeedSource }));
        let speciesObs: SpeciesObservations[] = [];
        try {
          const gbif = await fetchSpeciesObservations(territory);
          const inat = await fetchInatSpeciesObservations(territory);
          speciesObs = [...gbif, ...inat];
        } catch {
          /* honest empty — the map shows no records rather than fake ones */
        }
        return {
          weather: wx.weather,
          index: wx.index,
          hydro: hy.points,
          hydroSource: hy.source,
          soil: soil.items,
          soilSource: soil.source,
          air: air.air,
          airSource: air.source,
          speciesObs,
        };
      },
      apply: (b) => {
        const r = b as {
          weather: FireWeather | null;
          index: FireIndex | null;
          hydro: HydrographPoint[];
          hydroSource: FeedSource;
          soil: SoilPoint[];
          soilSource: FeedSource;
          air: AirQuality | null;
          airSource: FeedSource;
          speciesObs: SpeciesObservations[];
        };
        return {
          weather: r.weather,
          index: r.index,
          hydro: r.hydro,
          hydroSource: r.hydroSource,
          soil: r.soil,
          soilSource: r.soilSource,
          air: r.air,
          airSource: r.airSource,
          speciesObs: r.speciesObs,
        };
      },
      isDown: (b) => {
        const r = b as { hydroSource?: FeedSource; soilSource?: FeedSource; airSource?: FeedSource } | null;
        return !!r && !isGlobal && r.hydroSource === 'UNAVAILABLE' && r.soilSource === 'UNAVAILABLE' && r.airSource === 'UNAVAILABLE';
      },
    };

    const runners: FeedRunner[] = [
      pointRunner,
      {
        run: () => fetchHotspots(territory),
        apply: (b) => ({ hotspots: (b as { items: FireHotspot[] }).items, hotspotsSource: (b as { source: FeedSource }).source }),
        isDown: (b) => down(b as { source: FeedSource }),
      },
      {
        run: () => fetchOccurrences(territory),
        apply: (b) => ({ occurrences: (b as { items: Occurrence[] }).items, occurrencesSource: (b as { source: FeedSource }).source }),
        isDown: (b) => down(b as { source: FeedSource }),
      },
      {
        run: () => fetchRealGauges(territory),
        apply: (b) => ({ realGauges: (b as { items: RealGauge[] }).items, realGaugesSource: (b as { source: FeedSource }).source }),
        isDown: (b) => down(b as { source: FeedSource }),
      },
      {
        run: () => fetchTerritoryEvents(territory),
        apply: (b) => ({ events: b as EventBundle }),
        isDown: (b) => (b as EventBundle).sources.length === 0,
      },
      {
        run: () => fetchRainRadar(),
        apply: (b) => ({ rainRadar: b as RainRadar }),
        isDown: (b) => down(b as { source: FeedSource }),
      },
      {
        run: () => fetchUsgsDailyGages(territory),
        apply: (b) => ({ usgsGages: (b as { items: UsgsDailyGage[] }).items, usgsGagesSource: (b as { source: FeedSource }).source }),
        isDown: (b) => down(b as { source: FeedSource }),
      },
      {
        run: () => fetchFireIncidents(territory),
        apply: (b) => ({ fireIncidents: (b as { items: FireIncident[] }).items, fireIncidentsSource: (b as { source: FeedSource }).source }),
        isDown: (b) => down(b as { source: FeedSource }),
      },
      {
        run: () => fetchFirePerimeters(territory),
        apply: (b) => ({ firePerimeters: (b as { items: FirePerimeter[] }).items, firePerimetersSource: (b as { source: FeedSource }).source }),
        isDown: (b) => down(b as { source: FeedSource }),
      },
      {
        run: () => fetchUsDrought(territory),
        apply: (b) => ({ usDrought: (b as { items: UsIndexPoint[] }).items, usDroughtSource: (b as { source: FeedSource }).source }),
        isDown: (b) => down(b as { source: FeedSource }),
      },
      {
        run: () => fetchCountyAqi(territory),
        apply: (b) => ({ countyAqi: (b as { items: UsIndexPoint[] }).items, countyAqiSource: (b as { source: FeedSource }).source }),
        isDown: (b) => down(b as { source: FeedSource }),
      },
      {
        run: () => fetchAmedas(territory),
        apply: (b) => ({
          amedas: (b as { rows: AmedasRow[] }).rows,
          amedasSource: (b as { source: FeedSource }).source,
          amedasFrame: (b as { frameTime: string | null }).frameTime,
        }),
        isDown: (b) => down(b as { source: FeedSource }),
      },
      {
        run: () => fetchCityAqGrid(),
        apply: (b) => ({ cityAq: (b as { rows: CityAqRow[] }).rows, cityAqSource: (b as { source: FeedSource }).source }),
        isDown: (b) => down(b as { source: FeedSource }),
      },
    ];

    /** Latest bundle per runner — updated as each fetch lands. */
    const lastBundles = new Map<FeedRunner, unknown>();

    const runFeed = async (r: FeedRunner): Promise<void> => {
      const bundle = await r.run();
      if (cancelled) return;
      lastBundles.set(r, bundle);
      land(r.apply(bundle));
    };

    const runPass = async (): Promise<void> => {
      await Promise.allSettled(runners.map((r) => runFeed(r)));
    };

    (async () => {
      await runPass();
      land({ booted: true });
      // Up to two quiet retry passes for feeds that ended genuinely
      // UNAVAILABLE — NOT-APPLICABLE and legitimately-empty LIVE states are
      // left alone. Cold CDN edges, brief proxy hiccups and dev-server
      // restarts would otherwise strand a feed for the whole session.
      for (const delayMs of [4000, 9000]) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (cancelled) return;
        const retriable = runners.filter((r) => {
          const bundle = lastBundles.get(r);
          return bundle != null && r.isDown(bundle);
        });
        if (retriable.length === 0) return;
        await Promise.allSettled(retriable.map((r) => runFeed(r)));
        land({ booted: true });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territoryCode]);

  return feeds;
}

const LiveContext = createContext<LiveFeeds | null>(null);

export function LiveFeedsProvider({ value, children }: { value: LiveFeeds; children: ReactNode }) {
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveFeeds {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used inside LiveFeedsProvider');
  return ctx;
}
