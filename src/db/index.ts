import Dexie, { type Table } from 'dexie';
import type { Stop, RouteItem, RecordedTrack } from '../types';
import defaultRoutes from '../data/tepicRoutes.json';

export class TransitStudioDatabase extends Dexie {
  stops!: Table<Stop, string>;
  routes!: Table<RouteItem, string>;
  tracks!: Table<RecordedTrack, string>;

  constructor() {
    super('TepicTransitStudioDB');
    this.version(1).stores({
      stops: 'id, type, direction, sequence, *routeIds, createdAt',
      routes: 'id, code, category, isCustom',
      tracks: 'id, routeId, direction, startedAt',
    });
  }
}

export const db = new TransitStudioDatabase();

// Initialize and seed default routes if needed
export async function initializeDatabase() {
  const routesCount = await db.routes.count();
  if (routesCount === 0) {
    console.log('[DB] Seeding 39 official SEMOVI Tepic routes...');
    await db.routes.bulkAdd(defaultRoutes as RouteItem[]);
  }

  // Pre-seed sample stops if empty for immediate testing
  const stopsCount = await db.stops.count();
  if (stopsCount === 0) {
    const sampleStops: Stop[] = [
      {
        id: "stop-suchiate-mexico-victoria",
        name: "Av. México y Victoria",
        coordinates: { lat: 21.5034, lng: -104.8912 },
        type: "costumbre",
        routeIds: ["r-o-suchiate"],
        direction: "ida",
        sequence: 1,
        accuracy: 2.8,
        createdAt: new Date().toISOString()
      },
      {
        id: "stop-suchiate-catedral",
        name: "Av. México y Amado Nervo (Catedral)",
        coordinates: { lat: 21.5095, lng: -104.8957 },
        type: "oficial",
        routeIds: ["r-o-suchiate"],
        direction: "ida",
        sequence: 2,
        accuracy: 3.1,
        createdAt: new Date().toISOString()
      },
      {
        id: "stop-suchiate-mololoa",
        name: "Av. México y Puente Mololoa",
        coordinates: { lat: 21.5200, lng: -104.8965 },
        type: "oficial",
        routeIds: ["r-o-suchiate"],
        direction: "ida",
        sequence: 3,
        accuracy: 3.5,
        createdAt: new Date().toISOString()
      },
      {
        id: "stop-suchiate-base",
        name: "Terminal Río Suchiate Base",
        coordinates: { lat: 21.5285, lng: -104.8620 },
        type: "base",
        routeIds: ["r-o-suchiate"],
        direction: "ida",
        sequence: 4,
        accuracy: 2.4,
        createdAt: new Date().toISOString()
      }
    ];
    await db.stops.bulkAdd(sampleStops);
  }
}
