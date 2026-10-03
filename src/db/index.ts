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
    // Version 3: force re-seed after catalog cleanup (15 routes)
    this.version(3).stores({
      stops: 'id, type, direction, sequence, *routeIds, createdAt',
      routes: 'id, code, category, isCustom',
      tracks: 'id, routeId, direction, startedAt',
    }); // version 3: non-destructive — initializeDatabase() bulkPut handles re-sync
  }
}

export const db = new TransitStudioDatabase();

// Initialize and seed default routes — always overwrite so names stay up-to-date
export async function initializeDatabase() {
  console.log('[DB] Syncing official SEMOVI Tepic routes (bulkPut)...');
  // bulkPut = insert OR update; keeps custom routes untouched since they have different ids
  await db.routes.bulkPut(defaultRoutes as RouteItem[]);

  // No sample stops — user creates real stops from GPS field work
}
