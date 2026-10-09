import Dexie, { type Table } from 'dexie';
import type { Stop, RouteItem, RecordedTrack, Place } from '../types';
import defaultRoutes from '../data/tepicRoutes.json';

export class TransitStudioDatabase extends Dexie {
  stops!: Table<Stop, string>;
  routes!: Table<RouteItem, string>;
  tracks!: Table<RecordedTrack, string>;
  places!: Table<Place, string>;

  constructor(name = 'TepicTransitStudioDB') {
    super(name);
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
    });
    // Additive migration: existing stores and records are preserved.
    this.version(6).stores({ places: 'id, name, category, status, updatedAt' });
  }
}

export const db = new TransitStudioDatabase();

// Seed only missing defaults; never overwrite field edits or delete custom routes.
export async function initializeDatabase() {
  
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

  await db.transaction('rw', db.routes, async () => {
    const existing = new Set(await db.routes.toCollection().primaryKeys());
    await db.routes.bulkAdd(mappedRoutes.filter(route => !existing.has(route.id)));
  });

  // No sample stops — user creates real stops from GPS field work
}
