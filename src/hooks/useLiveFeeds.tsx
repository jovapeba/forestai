import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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

/**
 * Single orchestration point for all public data feeds. Feeds land
 * PROGRESSIVELY as each request resolves (FIRMS CSV is ~4 MB, weather ~1 KB —
 * nothing waits for the slowest). There is NO simulated fallback: while a
 * feed is loading the UI shows an explicit loading state, and if a feed fails
 * it shows an explicit UNAVAILABLE state. In the global earth view,
 * point-scoped feeds are labelled NOT-APPLICABLE.
 */
export function useLiveFeeds(): LiveFeeds {
  const territoryCode = useAppStore((s) => s.territoryCode);
  const territory = getTerritory(territoryCode);
  const [feeds, setFeeds] = useState<LiveFeeds>(() => ({
    viewMode: 'country' as const,
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
    events: { items: [], sources: [] },
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
  }));

  useEffect(() => {
    let cancelled = false;
    const isGlobal = Boolean(territory.global);
    setFeeds((prev) => ({
      ...prev,
      viewMode: isGlobal ? 'global' : 'country',
      weather: null,
      index: null,
      hotspots: [],
      hotspotsSource: 'UNAVAILABLE',
      hydro: [],
      hydroSource: 'UNAVAILABLE',
      soil: [],
      soilSource: 'UNAVAILABLE',
      air: null,
      airSource: 'UNAVAILABLE',
      occurrences: [],
      occurrencesSource: 'UNAVAILABLE',
      speciesObs: [],
      realGauges: [],
      realGaugesSource: 'UNAVAILABLE',
      events: { items: [], sources: [] },
      rainRadar: { framePath: null, frameTime: null, source: 'UNAVAILABLE' },
      usgsGages: [],
      usgsGagesSource: 'UNAVAILABLE',
      fireIncidents: [],
      fireIncidentsSource: 'NOT-APPLICABLE',
      firePerimeters: [],
      firePerimetersSource: 'NOT-APPLICABLE',
      usDrought: [],
      usDroughtSource: 'NOT-APPLICABLE',
      countyAqi: [],
      countyAqiSource: 'NOT-APPLICABLE',
      amedas: [],
      amedasSource: 'NOT-APPLICABLE',
      amedasFrame: null,
      cityAq: [],
      cityAqSource: 'UNAVAILABLE',
      booted: false,
    }));

    (async () => {
      const land = (patch: Partial<LiveFeeds>) => {
        if (!cancelled) setFeeds((prev) => ({ ...prev, ...patch }));
      };

      // Point-scoped feeds (weather/FWI, soil, air, GloFAS hydrograph) are not
      // applicable in the global earth view — labelled NOT-APPLICABLE, never faked.
      const pointFeeds = isGlobal
        ? [
            Promise.resolve(
              land({
                weather: null,
                index: null,
                hydro: [],
                hydroSource: 'NOT-APPLICABLE',
                soil: [],
                soilSource: 'NOT-APPLICABLE',
                air: null,
                airSource: 'NOT-APPLICABLE',
                speciesObs: [],
              }),
            ),
          ]
        : [
            fetchFireWeather(territory)
              .then((b) => land({ weather: b.weather, index: b.index }))
              .catch(() => land({ weather: null, index: null })),
            fetchRiverDischarge(territory)
              .then((b) => land({ hydro: b.points, hydroSource: b.source }))
              .catch(() => land({ hydro: [], hydroSource: 'UNAVAILABLE' })),
            fetchSoilMoisture(territory)
              .then((b) => land({ soil: b.items, soilSource: b.source }))
              .catch(() => land({ soil: [], soilSource: 'UNAVAILABLE' })),
            fetchAirQuality(territory)
              .then((b) => land({ air: b.air, airSource: b.source }))
              .catch(() => land({ air: null, airSource: 'UNAVAILABLE' })),
            (async () => {
              const gbifBundle = await fetchSpeciesObservations(territory);
              const inatBundle = await fetchInatSpeciesObservations(territory);
              land({ speciesObs: [...gbifBundle, ...inatBundle] });
            })().catch(() => land({ speciesObs: [] })),
          ];

      // Both modes: fires, GBIF window, real gauges (all networks in global), events
      const worldwideFeeds = [
        fetchHotspots(territory)
          .then((b) => land({ hotspots: b.items, hotspotsSource: b.source }))
          .catch(() => land({ hotspots: [], hotspotsSource: 'UNAVAILABLE' })),
        fetchOccurrences(territory)
          .then((b) => land({ occurrences: b.items, occurrencesSource: b.source }))
          .catch(() => land({ occurrences: [], occurrencesSource: 'UNAVAILABLE' })),
        fetchRealGauges(territory)
          .then((b) => land({ realGauges: b.items, realGaugesSource: b.source }))
          .catch(() => land({ realGauges: [], realGaugesSource: 'UNAVAILABLE' })),
        fetchTerritoryEvents(territory)
          .then((b) => land({ events: b }))
          .catch(() => land({ events: { items: [], sources: [] } })),
        fetchRainRadar()
          .then((r) => land({ rainRadar: r }))
          .catch(() => land({ rainRadar: { framePath: null, frameTime: null, source: 'UNAVAILABLE' } })),
        fetchUsgsDailyGages(territory)
          .then((g) => land({ usgsGages: g.items, usgsGagesSource: g.source }))
          .catch(() => land({ usgsGages: [], usgsGagesSource: 'UNAVAILABLE' })),
        fetchFireIncidents(territory)
          .then((b) => land({ fireIncidents: b.items, fireIncidentsSource: b.source }))
          .catch(() => land({ fireIncidents: [], fireIncidentsSource: 'UNAVAILABLE' })),
        fetchFirePerimeters(territory)
          .then((b) => land({ firePerimeters: b.items, firePerimetersSource: b.source }))
          .catch(() => land({ firePerimeters: [], firePerimetersSource: 'UNAVAILABLE' })),
        fetchUsDrought(territory)
          .then((b) => land({ usDrought: b.items, usDroughtSource: b.source }))
          .catch(() => land({ usDrought: [], usDroughtSource: 'UNAVAILABLE' })),
        fetchCountyAqi(territory)
          .then((b) => land({ countyAqi: b.items, countyAqiSource: b.source }))
          .catch(() => land({ countyAqi: [], countyAqiSource: 'UNAVAILABLE' })),
        fetchAmedas(territory)
          .then((b) => land({ amedas: b.rows, amedasSource: b.source, amedasFrame: b.frameTime }))
          .catch(() => land({ amedas: [], amedasSource: 'UNAVAILABLE', amedasFrame: null })),
        fetchCityAqGrid()
          .then((b) => land({ cityAq: b.rows, cityAqSource: b.source }))
          .catch(() => land({ cityAq: [], cityAqSource: 'UNAVAILABLE' })),
      ];

      await Promise.allSettled([...pointFeeds, ...worldwideFeeds]);
      land({ booted: true });
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
