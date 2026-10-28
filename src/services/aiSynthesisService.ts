import { severityRank } from './api/hazard';
import type {
  Incident,
  SITREP,
  Territory,
  ThreatLevel,
  DispatchAction,
  FireHotspot,
  FireIndex,
  FireWeather,
  HydrographPoint,
  Occurrence,
  RealGauge,
  EnvironmentalEvent,
  FeedSource,
} from '@/types/environmental';

/**
 * SENTRY — real-event incident derivation.
 *
 * Incidents are NOT a pre-written scenario catalogue. They are derived
 * exclusively from the live public feeds currently in memory:
 *
 *   • A fire incident exists only when NASA FIRMS actually reports hotspots
 *     inside the territory bbox (real FRP, real coordinates, real wind).
 *   • A hydrology incident exists only when the live GloFAS forecast really
 *     exceeds its own climatological mean envelope (real numbers).
 *   • If nothing qualifies, deriveIncidents returns [] and the UI states
 *     "no active incidents" — nothing is invented.
 *
 * The SITREP text cites only real live values. Dispatch actions are
 * explicitly advisory (decision-support, not measurements).
 */

export interface LiveCtx {
  hotspots: FireHotspot[];
  hotspotsSource: FeedSource;
  hydro: HydrographPoint[];
  hydroSource: FeedSource;
  index: FireIndex | null;
  weather: FireWeather | null;
  realGauges: RealGauge[];
  realGaugesSource: FeedSource;
  occurrences: Occurrence[];
  occurrencesSource: FeedSource;
  events: EnvironmentalEvent[];
  eventsSources: FeedSource[];
}

/** Share of live public feeds currently healthy (0..1) — a real measure. */
export function liveFeedHealth(ctx: LiveCtx): { live: number; total: number } {
  const checks = [
    ctx.weather !== null,
    ctx.hotspotsSource.startsWith('LIVE'),
    ctx.hydroSource.startsWith('LIVE'),
    ctx.realGaugesSource.startsWith('LIVE'),
    ctx.occurrencesSource.startsWith('LIVE'),
    ctx.eventsSources.length > 0,
  ];
  return { live: checks.filter(Boolean).length, total: checks.length };
}

/** Peak discharge vs GloFAS climatological mean across the 7-day window. */
export function hydroPeakRatio(hydro: HydrographPoint[]): number {
  if (hydro.length === 0) return 0;
  const peak = hydro.reduce((a, b) => (b.discharge > a.discharge ? b : a), hydro[0]);
  return peak.mean > 0 ? peak.discharge / peak.mean : 0;
}

export function deriveIncidents(territory: Territory, ctx: LiveCtx): Incident[] {
  const incidents: Incident[] = [];
  const year = new Date().getFullYear();

  /* ---- Fire incident — only from real FIRMS detections ----------------- */
  if (ctx.hotspotsSource === 'LIVE:NASA-FIRMS' && ctx.hotspots.length > 0) {
    const maxFrp = Math.max(...ctx.hotspots.map((h) => h.frp));
    const top = ctx.hotspots[0];
    const severity: ThreatLevel = maxFrp >= 100 ? 'HIGH' : maxFrp >= 40 ? 'MODERATE' : 'LOW';
    incidents.push({
      id: 'FIRE',
      code: `INC-${territory.code}-${year}-FIRE`,
      title: `Active fire detections — ${ctx.hotspots.length} thermal anomalies, peak ${maxFrp} MW`,
      location: `${top.lat.toFixed(3)}°, ${top.lon.toFixed(3)}° (strongest anomaly)`,
      severity,
      cascade: [
        {
          layer: 'SATELLITE',
          status: 'ACTIVE',
          detail: `NASA FIRMS VIIRS hotspots streamed live inside the territory bbox (${ctx.hotspots.length} detections in the current window).`,
        },
        {
          layer: 'FIRE',
          status: 'TRIGGERED',
          detail:
            `Peak FRP ${maxFrp} MW at ${top.lat.toFixed(3)}°, ${top.lon.toFixed(3)}°; acquisition ${top.acqDate} ${top.acqTime}Z via ${top.satellite}. ` +
            (ctx.weather
              ? `Live fire weather: ${ctx.weather.temp}°C, RH ${ctx.weather.humidity}%, wind ${ctx.weather.wind.dir}° @ ${ctx.weather.wind.speed} km/h.`
              : 'Live fire weather feed currently unavailable.'),
        },
        {
          layer: 'BASIN',
          status: 'MONITOR',
          detail: `Ash-loading risk logged for ${territory.basin} headwaters if burns reach drainage lines.`,
        },
        {
          layer: 'SPECIES',
          status: 'MONITOR',
          detail:
            ctx.occurrencesSource === 'LIVE:GBIF'
              ? `${ctx.occurrences.length} recent real GBIF field records inside the country window; occurrence dots on the map remain live ground truth.`
              : 'GBIF country window currently unavailable.',
        },
        {
          layer: 'CIVIL',
          status: 'STANDBY',
          detail: 'Recommendation: check downwind settlements against the live wind vector before issuing advisories.',
        },
      ],
    });
  }

  /* ---- Hydrology incident — only from real GloFAS exceedance ----------- */
  if (ctx.hydroSource === 'LIVE:GLOFAS') {
    const peak = ctx.hydro.reduce((a, b) => (b.discharge > a.discharge ? b : a), ctx.hydro[0]);
    const ratio = peak.mean > 0 ? peak.discharge / peak.mean : 0;
    if (ratio >= 1.3) {
      const severity: ThreatLevel = ratio >= 2.5 ? 'SEVERE' : ratio >= 1.8 ? 'HIGH' : 'MODERATE';
      const point = territory.hydroPoints[0];
      incidents.push({
        id: 'BASIN',
        code: `INC-${territory.code}-${year}-BASIN`,
        title: `GloFAS discharge ${Math.round(ratio * 100)}% of climatological mean at ${point.name}`,
        location: `${point.name} (${point.lat.toFixed(2)}°, ${point.lon.toFixed(2)}°) — ${territory.basin}`,
        severity,
        cascade: [
          {
            layer: 'SATELLITE',
            status: 'MONITOR',
            detail: 'GIBS daily composite available for manual flood-extent inspection; no automated SAR imagery in the public tier.',
          },
          {
            layer: 'FIRE',
            status: 'STANDBY',
            detail: 'Fire weather is not the driver; wet-loop lightning risk monitored via live FWI feed.',
          },
          {
            layer: 'BASIN',
            status: 'TRIGGERED',
            detail: `GloFAS 7-day ensemble peaks at ${peak.discharge.toLocaleString()} m³/s on ${peak.date} versus climatological mean ${peak.mean.toLocaleString()} m³/s — modelled exceedance, clearly labelled.`,
          },
          {
            layer: 'SPECIES',
            status: 'MONITOR',
            detail: 'Riparian habitat inundation possible; monitor GBIF occurrence shifts after the event window.',
          },
          {
            layer: 'CIVIL',
            status: 'STANDBY',
            detail: 'Recommendation: coordinate with the national hydrometric agency before any public flood messaging.',
          },
        ],
      });
    }
  }

  /* ---- Seismic incident — only from real USGS detections --------------- */
  const quakes = ctx.events.filter((e) => e.kind === 'SEISMIC');
  if (quakes.length > 0) {
    const strongest = quakes.reduce((a, b) =>
      Number((b.detail.match(/M([\d.]+)/) ?? [0, 0])[1]) > Number((a.detail.match(/M([\d.]+)/) ?? [0, 0])[1]) ? b : a,
    );
    const mag = Number((strongest.detail.match(/M([\d.]+)/) ?? [0, 0])[1]);
    if (mag >= 4.5) {
      const severity: ThreatLevel = mag >= 6.5 ? 'SEVERE' : mag >= 5.5 ? 'HIGH' : 'MODERATE';
      incidents.push({
        id: 'SEISMIC',
        code: `INC-${territory.code}-${year}-SEISMIC`,
        title: `Earthquake M${mag} — ${strongest.title}`,
        location: `${strongest.lat?.toFixed(2)}°, ${strongest.lon?.toFixed(2)}° · ${strongest.detail}`,
        severity,
        cascade: [
          {
            layer: 'SATELLITE',
            status: 'MONITOR',
            detail: 'GIBS daily composite available for post-event damage inspection; no automated radar imagery in the public tier.',
          },
          { layer: 'FIRE', status: 'STANDBY', detail: 'Fire layer nominal — no interaction with the seismic event.' },
          {
            layer: 'BASIN',
            status: 'MONITOR',
            detail:
              ctx.realGaugesSource.startsWith('LIVE')
                ? `Official gauges live (${ctx.realGauges.slice(0, 2).map((g) => g.name).join(', ')}) — watch for seiche/turbidity anomalies.`
                : 'No open official gauge feed for this territory — monitor via GloFAS modelled discharge.',
          },
          {
            layer: 'SPECIES',
            status: 'MONITOR',
            detail: 'No wildlife telemetry in the public tier — GBIF occurrence dots remain live ground truth for the area.',
          },
          {
            layer: 'CIVIL',
            status: mag >= 5.5 ? 'TRIGGERED' : 'STANDBY',
            detail: `USGS reports ${quakes.length} events ≥ M2.5 within 700 km in the last 7 days. Recommendation: check official civil-protection channels before messaging.`,
          },
        ],
      });
    }
  }

  /* ---- Met-warning incident — only from real MeteoAlarm CAP ------------ */
  const caps = ctx.events.filter((e) => e.kind === 'MET-WARNING');
  if (caps.length > 0) {
    const severityOrder: Record<string, ThreatLevel> = { EXTREME: 'SEVERE', SEVERE: 'HIGH', MODERATE: 'MODERATE', MINOR: 'LOW' };
    const worst = caps.reduce((a, b) =>
      (severityRank[severityOrder[b.detail.split(' ')[0]] ?? 'LOW'] ?? 0) > (severityRank[severityOrder[a.detail.split(' ')[0]] ?? 'LOW'] ?? 0) ? b : a,
    );
    const severity = severityOrder[worst.detail.split(' ')[0]] ?? 'LOW';
    incidents.push({
      id: 'MET',
      code: `INC-${territory.code}-${year}-MET`,
      title: `${caps.length} official weather warning${caps.length > 1 ? 's' : ''} — worst: ${worst.title}`,
      location: worst.detail.replace(/^[A-Z]+ · /, ''),
      severity,
      cascade: [
        { layer: 'SATELLITE', status: 'MONITOR', detail: 'GIBS daily true-color composite available for cloud/storm inspection.' },
        { layer: 'FIRE', status: 'STANDBY', detail: ctx.index ? `Live-derived FWI ${ctx.index.fwi} (${ctx.index.category}) — cross-check against the warning.` : 'Live FWI feed unavailable.' },
        { layer: 'BASIN', status: 'MONITOR', detail: 'Hydro-meteorological coupling possible — GloFAS discharge watch continues.' },
        { layer: 'SPECIES', status: 'STANDBY', detail: 'No direct wildlife telemetry implication in the public tier.' },
        {
          layer: 'CIVIL',
          status: 'TRIGGERED',
          detail: `Official MeteoAlarm CAP issued by the national met service. All ${caps.length} active warnings are listed in the events panel with real severity and onset.`,
        },
      ],
    });
  }

  /* ---- Natural-event incident — only from real NASA EONET -------------- */
  const naturals = ctx.events.filter((e) => e.kind === 'NATURAL');
  if (naturals.length > 0) {
    const top = naturals[0];
    const severity: ThreatLevel = /wildfire|volcan/i.test(top.detail) ? 'MODERATE' : 'LOW';
    incidents.push({
      id: 'NATURAL',
      code: `INC-${territory.code}-${year}-NAT`,
      title: `NASA EONET: ${top.title}`,
      location: `${top.lat?.toFixed(2)}°, ${top.lon?.toFixed(2)}° · ${top.detail}`,
      severity,
      cascade: [
        { layer: 'SATELLITE', status: 'ACTIVE', detail: `EONET event geometry live — visible in the GIBS composite window.` },
        { layer: 'FIRE', status: /wildfire/i.test(top.detail) ? 'TRIGGERED' : 'STANDBY', detail: /wildfire/i.test(top.detail) ? 'FIRMS hotspots in the territory may correlate with this event.' : 'No fire interaction.' },
        { layer: 'BASIN', status: /flood/i.test(top.detail) ? 'TRIGGERED' : 'MONITOR', detail: /flood/i.test(top.detail) ? 'GloFAS discharge watch continues during the flood event.' : 'No direct hydrologic trigger.' },
        { layer: 'SPECIES', status: 'STANDBY', detail: 'GBIF occurrence dots remain live ground truth.' },
        { layer: 'CIVIL', status: 'STANDBY', detail: 'Recommendation: correlate with national civil-protection advisories.' },
      ],
    });
  }

  return incidents;
}

/** Synthesize a full SITREP from a real derived incident + live context. */
export function synthesizeSITREP(
  incident: Incident,
  territory: Territory,
  ctx: LiveCtx,
): SITREP {
  const health = liveFeedHealth(ctx);
  const hRatio = hydroPeakRatio(ctx.hydro);

  // Threat escalation from REAL live indices only
  let rank = severityRank[incident.severity];
  if (ctx.index && ctx.index.fwi >= 70) rank += 1;
  if (incident.cascade.some((c) => c.layer === 'BASIN' && c.status === 'TRIGGERED') && hRatio >= 2) rank += 1;
  const threatLevel: ThreatLevel = (['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'CRITICAL'] as ThreatLevel[])[
    Math.min(rank, 4)
  ];

  const fireTriggered = incident.cascade.find((c) => c.layer === 'FIRE')?.status === 'TRIGGERED';
  const basinTriggered = incident.cascade.find((c) => c.layer === 'BASIN')?.status === 'TRIGGERED';
  const civilTriggered = incident.cascade.find((c) => c.layer === 'CIVIL')?.status === 'TRIGGERED';

  const actions: DispatchAction[] = [];
  if (fireTriggered) {
    const top = ctx.hotspots[0];
    actions.push({
      agency: 'FORESTRY',
      action:
        (top
          ? `Verify the strongest FIRMS anomaly at ${top.lat.toFixed(3)}°, ${top.lon.toFixed(3)}° (${top.frp} MW, ${top.acqDate} ${top.acqTime}Z). `
          : '') +
        (ctx.weather
          ? `Cut containment guidance along the downwind corridor from live wind vector ${ctx.weather.wind.dir}° @ ${ctx.weather.wind.speed} km/h.`
          : 'Live wind feed unavailable — request a local met briefing before dispatch.'),
      priority: 'P1',
      eta: '≤ 90 min',
    });
  }
  if (basinTriggered) {
    const point = territory.hydroPoints[0];
    actions.push({
      agency: 'WATER AUTHORITY',
      action:
        `Cross-check GloFAS exceedance at ${point.name} against official gauges` +
        (ctx.realGaugesSource.startsWith('LIVE')
          ? ` (live: ${ctx.realGauges.slice(0, 2).map((g) => `${g.name} ${g.level}${g.unit === 'cm' ? 'cm' : 'm'}`).join(', ')})`
          : ' — no open official gauge feed for this territory') +
        '; verify dike/bridge clearance downstream.',
      priority: 'P1',
      eta: '≤ 4 h',
    });
  }
  if (civilTriggered || threatLevel === 'SEVERE' || threatLevel === 'CRITICAL') {
    actions.push({
      agency: 'CIVIL DEFENSE',
      action: 'Stage precautionary public advisory; open coordination channel with municipal emergency HQ; prepare shelter list for affected settlements.',
      priority: 'P1',
      eta: '≤ 2 h',
    });
  }
  actions.push({
    agency: 'STATE COMMAND',
    action: 'Archive this SITREP as an immutable incident record; cross-report to the national ESG/MRV ledger and adjacent agencies.',
    priority: 'P3',
    eta: '≤ 24 h',
  });

  // Confidence = real fraction of live public feeds backing this synthesis
  const confidencePct = Math.round((health.live / health.total) * 1000) / 10;

  const liveSources = [
    ctx.hotspotsSource.startsWith('LIVE') && 'NASA FIRMS (live)',
    ctx.weather && 'Open-Meteo (live)',
    ctx.hydroSource === 'LIVE:GLOFAS' && 'Copernicus GloFAS (modelled, live)',
    ctx.realGaugesSource.startsWith('LIVE') && 'Official gauges (live)',
    ctx.occurrencesSource === 'LIVE:GBIF' && 'GBIF (live)',
    ctx.eventsSources.includes('LIVE:USGS-EQ') && 'USGS earthquakes (live)',
    ctx.eventsSources.includes('LIVE:EONET') && 'NASA EONET (live)',
    ctx.eventsSources.includes('LIVE:METEOALARM') && 'MeteoAlarm CAP (live)',
  ].filter(Boolean) as string[];

  return {
    id: `SITREP-${territory.code}-${incident.id}-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}`,
    incidentCode: incident.code,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z',
    threatLevel,
    confidencePct,
    summary:
      `${incident.title} — classified ${threatLevel}. ` +
      (fireTriggered
        ? `Real FIRMS detections: ${ctx.hotspots.length}; peak FRP ${Math.max(...ctx.hotspots.map((h) => h.frp))} MW. ` +
          (ctx.index ? `Live-derived FWI ${ctx.index.fwi} (${ctx.index.category}). ` : '')
        : '') +
      (basinTriggered
        ? `Live GloFAS peak at ${Math.round(hRatio * 100)}% of climatological mean on the primary reach. `
        : '') +
      `${health.live}/${health.total} public feeds live. ` +
      `Recommended posture: ${threatLevel === 'LOW' || threatLevel === 'MODERATE' ? 'HEIGHTENED MONITORING' : threatLevel === 'HIGH' ? 'PRE-POSITION RESOURCES' : 'IMMEDIATE DISPATCH'}.`,
    cascade: incident.cascade,
    actions,
    dataSources: liveSources.length > 0 ? liveSources : ['ALL FEEDS CURRENTLY UNAVAILABLE'],
  };
}
