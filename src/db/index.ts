import Dexie, { type Table } from 'dexie';
import type { Stop, RouteItem, RecordedTrack } from '../types';
import defaultRoutes from '../data/tepicRoutes.json';

export class TransitStudioDatabase extends Dexie {
  stops!: Table<Stop, string>;
  routes!: Table<RouteItem, string>;
  tracks!: Table<RecordedTrack, string>;

  constructor() {
    super('TepicTransitStudioDB');
    // Version 1 schema (kept for migration chain)
    this.version(1).stores({
      stops: 'id, type, direction, sequence, *routeIds, createdAt',
      routes: 'id, code, category, isCustom',
      tracks: 'id, routeId, direction, startedAt',
    });
    // Version 2: same schema, forces re-seeding of routes with correct names
    this.version(2).stores({
      stops: 'id, type, direction, sequence, *routeIds, createdAt',
      routes: 'id, code, category, isCustom',
      tracks: 'id, routeId, direction, startedAt',
    });
    // Version 4: force re-seed to load all 60 routes
    this.version(5).stores({
      stops: 'id, type, direction, sequence, *routeIds, createdAt',
      routes: 'id, code, category, isCustom',
      tracks: 'id, routeId, direction, startedAt',
    }); // version 4: non-destructive — initializeDatabase() bulkPut handles re-sync
  }
}

export const db = new TransitStudioDatabase();

// Initialize and seed default routes — always overwrite so names stay up-to-date
export async function initializeDatabase() {
  console.log('[DB] Syncing official SEMOVI Tepic routes (bulkPut)...');
  
  // The new JSON has a { "routes": [...] } structure and uses { lat, lng } instead of [lat, lng]
  const rawData: any = defaultRoutes;
  const routeList = rawData.routes || rawData;

  const mappedRoutes: RouteItem[] = routeList.map((r: any) => ({
    id: r.id || `r-${Math.random()}`,
    code: r.id || 'N/A',
    name: r.name,
    agency: 'SEMOVI Nayarit',
    category: 'troncal',
    color: r.color || '#2563eb',
    ida: r.coordinates ? r.coordinates.map((c: any) => [c.lat, c.lng]) : (r.ida || []),
    vuelta: r.coordinates ? r.coordinates.slice().reverse().map((c: any) => [c.lat, c.lng]) : (r.vuelta || []),
    isCustom: false,
    notes: r.groupName || ''
  }));

  // bulkPut = insert OR update; keeps custom routes untouched since they have different ids
  await db.routes.bulkPut(mappedRoutes);

  // No sample stops — user creates real stops from GPS field work
}
