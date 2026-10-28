import type { FireIndex, FwiCategory, ThreatLevel } from '@/types/environmental';

/**
 * Transparent, deterministic derivations from REAL live weather.
 * No randomness, no seeded values — every output is a pure function of
 * real API inputs, labelled `DERIVED:OPEN-METEO` wherever displayed.
 */

/**
 * Open-Meteo's dedicated FWI variable was retired upstream, so the Canadian
 * Fire Weather Index is approximated with a Nesterov-style drying index
 * rescaled to the 0–100 FWI band, directly from the live weather reading.
 */
export function deriveFwi(temp: number, humidity: number, windSpeed: number): FireIndex {
  const dryness = Math.max(0, ((temp - 5) * (100 - humidity)) / 100); // 0..~30
  const fwi = Math.min(100, Math.round(dryness * 2.6 + windSpeed * 0.45));
  return {
    fwi,
    category: fwiToCategory(fwi),
    droughtCode: Math.min(500, Math.round(dryness * 14)),
    source: 'DERIVED:OPEN-METEO',
  };
}

export const fwiToCategory = (fwi: number): FwiCategory =>
  fwi >= 70 ? 'EXTREME' : fwi >= 45 ? 'HIGH' : fwi >= 20 ? 'MODERATE' : 'LOW';

export const severityRank: Record<ThreatLevel, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  SEVERE: 3,
  CRITICAL: 4,
};

export const threatColor: Record<ThreatLevel, string> = {
  LOW: '#4ade80',
  MODERATE: '#f59e0b',
  HIGH: '#f97316',
  SEVERE: '#ef4444',
  CRITICAL: '#ef4444',
};
