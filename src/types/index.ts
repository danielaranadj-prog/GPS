export type StopType = 'oficial' | 'costumbre' | 'base';
export type PlaceCategory = 'escuela' | 'hospital' | 'mercado' | 'plaza' | 'oficina' | 'gobierno' | 'banco' | 'parque' | 'deporte' | 'estadio' | 'museo' | 'teatro' | 'monumento' | 'cementerio' | 'religion' | 'restaurante' | 'cafe' | 'agencia' | 'bar' | 'hotel' | 'gimnasio' | 'cine' | 'terminal' | 'colonia' | 'otro';
export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  aliases: string[];
  neighborhood: string;
  municipality: string;
  entrance: string;
  coordinates: Coordinates;
  status: 'pendiente' | 'verificado';
  captureMethod: 'pin' | 'gps';
  accuracy?: number;
  capturedAt?: string;
  createdAt: string;
  updatedAt: string;
}
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
  isLocked?: boolean; // prevent deletion or movement
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

export type AdType = 'banner' | 'pin';

export interface Client {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  createdAt: string;
}

export interface AdCampaign {
  id: string;
  clientId: string; // <-- New field
  type: AdType;
  title: string;
  description: string;
  icon: string; // Emoji, URL
  routeIds: string[]; // which routes this ad applies to, or empty for all
  coordinates?: Coordinates; // used if type is 'pin'
  radiusMeters?: number; // threshold to trigger
  callToAction?: string; // e.g. 'Llevarme ahí', 'Obtener Promo'
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  notes?: string;
  createdAt: string;
}
