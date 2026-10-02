import * as turf from '@turf/turf';
import type { Coordinates } from '../types';

export const DEVIATION_THRESHOLD_METERS = 45;

export interface DeviationAnalysis {
  isDeviated: boolean;
  distanceFromOfficialMeters: number;
  nearestPointOnLine?: { lat: number; lng: number };
}

/**
 * Calculates perpendicular distance from a GPS point to the official route line.
 * Points are in [lat, lng]. Turf expects [lng, lat].
 */
export function analyzePointDeviation(
  pos: Coordinates,
  officialPath: [number, number][]
): DeviationAnalysis {
  if (!officialPath || officialPath.length < 2) {
    return {
      isDeviated: false,
      distanceFromOfficialMeters: 0,
    };
  }

  try {
    const pt = turf.point([pos.lng, pos.lat]);
    const lineCoordinates = officialPath.map(([lat, lng]) => [lng, lat]);
    const line = turf.lineString(lineCoordinates);

    const distanceMeters = turf.pointToLineDistance(pt, line, { units: 'meters' });
    const nearest = turf.nearestPointOnLine(line, pt);

    return {
      isDeviated: distanceMeters > DEVIATION_THRESHOLD_METERS,
      distanceFromOfficialMeters: Math.round(distanceMeters),
      nearestPointOnLine: nearest ? {
        lat: nearest.geometry.coordinates[1],
        lng: nearest.geometry.coordinates[0],
      } : undefined,
    };
  } catch (err) {
    console.error('Error analyzing deviation:', err);
    return {
      isDeviated: false,
      distanceFromOfficialMeters: 0,
    };
  }
}

/**
 * Computes total path distance in meters for a sequence of [lat, lng] points.
 */
export function calculatePolylineDistance(points: [number, number][]): number {
  if (!points || points.length < 2) return 0;
  try {
    const line = turf.lineString(points.map(([lat, lng]) => [lng, lat]));
    return Math.round(turf.length(line, { units: 'meters' }));
  } catch {
    return 0;
  }
}
