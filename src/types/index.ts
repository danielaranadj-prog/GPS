export type StopType = 'oficial' | 'costumbre' | 'base';
export type DirectionType = 'ida' | 'vuelta';
export type RouteCategory = 'troncal' | 'alimentadora' | 'suburbana' | 'xalisco' | 'ramal';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Stop {
  id: string; // e.g. "stop-suchiate-mexico-victoria"
  name: string; // e.g. "Av. México y Victoria"
  coordinates: Coordinates;
  type: StopType;
  routeIds?: string[]; // computed dynamically by geometry — do not rely on stored value
  direction: DirectionType;
  sequence: number;
  accuracy?: number; // in meters (e.g. 3.2)
  notes?: string;
  createdAt?: string;
}

export interface RouteItem {
  id: string;
  code: string;
  name: string;
  agency: string;
  category: RouteCategory;
  color: string;
  ida: [number, number][]; // [lat, lng][]
  vuelta: [number, number][]; // [lat, lng][]
  isCustom?: boolean;
  status?: 'active' | 'coming_soon';
  baseStopId?: string;
  notes?: string;
}

export interface GpsBreadcrumb {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
  speed?: number | null;
  heading?: number | null;
  distanceFromOfficial?: number; // meters
  isDeviation?: boolean;
}

export interface RecordedTrack {
  id: string;
  routeId: string;
  direction: DirectionType;
  name: string;
  points: GpsBreadcrumb[];
  startedAt: string;
  finishedAt?: string;
  totalDistanceMeters: number;
}

export interface DeviationStatus {
  isDeviated: boolean;
  currentDistanceMeters: number;
  maxDistanceMeters: number;
  accumulatedDistanceMeters: number;
  deviationPoints: [number, number][];
  startPoint?: Coordinates;
}

export interface ExportStopsFile {
  cityId: string;
  exportDate?: string;
  version?: string;
  stops: {
    id: string;
    name: string;
    coordinates: { lat: number; lng: number };
    type: StopType;
    routeIds: string[]; // empty array for global stops
    direction: DirectionType;
    sequence: number;
    accuracy?: number;
  }[];
}
