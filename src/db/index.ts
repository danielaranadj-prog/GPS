import Dexie, { type Table } from 'dexie';
import type { Stop, RouteItem, RecordedTrack, Place, AdCampaign, Client } from '../types';
import defaultRoutes from '../data/tepicRoutes.json';
import defaultPlaces from '../data/tepicPlaces.json';

export class TransitStudioDatabase extends Dexie {
  stops!: Table<Stop, string>;
  routes!: Table<RouteItem, string>;
  tracks!: Table<RecordedTrack, string>;
  places!: Table<Place, string>;
  ads!: Table<AdCampaign, string>;
  clients!: Table<Client, string>;

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
    this.version(7).stores({ ads: 'id, type, isActive, createdAt' });
    this.version(8).stores({ 
      ads: 'id, type, clientId, isActive, createdAt',
      clients: 'id, name, createdAt'
    });
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

  // Seed default places if not already present
  await db.transaction('rw', db.places, async () => {
    const existingPlaces = new Set(await db.places.toCollection().primaryKeys());
    const newPlaces = (defaultPlaces as Place[]).filter(p => !existingPlaces.has(p.id));
    if (newPlaces.length > 0) {
      await db.places.bulkAdd(newPlaces);
    }
  });

  // Seed default sample clients and ads if not already present
  const adsCount = await db.ads.count();
  if (adsCount === 0) {
    const defaultClients: Client[] = [
      { id: 'client-cafe-de-olla', name: 'Café de Olla', contactEmail: 'contacto@cafedeolla.mx', createdAt: new Date().toISOString() },
      { id: 'client-burger-lab', name: 'Burger Lab', contactEmail: 'hola@burgerlab.mx', createdAt: new Date().toISOString() },
      { id: 'client-farmacia', name: 'Farmacia Popular', contactEmail: 'farmacia@uan.mx', createdAt: new Date().toISOString() }
    ];
    await db.clients.bulkAdd(defaultClients);

    const defaultAds: AdCampaign[] = [
      {
        id: 'ad-cafe-de-olla-centro',
        clientId: 'client-cafe-de-olla',
        type: 'landmark',
        title: 'Café de Olla Centro',
        description: 'Café tradicional de olla y desayunos a unos pasos de la Catedral.',
        icon: '☕',
        referenceText: 'frente a Café de Olla (casi esquina Libertad)',
        promoText: '15% desc. en barra mostrando tu trayecto',
        coordinates: { lat: 21.51205, lng: -104.89152 },
        radiusMeters: 350,
        callToAction: 'Ver cupón',
        isActive: true,
        routeIds: [],
        createdAt: new Date().toISOString()
      },
      {
        id: 'ad-burger-lab-forum',
        clientId: 'client-burger-lab',
        type: 'landmark',
        title: 'Burger Lab Forum',
        description: 'Hamburguesas artesanales y malteadas sobre el boulevard de acceso.',
        icon: '🍔',
        referenceText: 'a pasos de Burger Lab Forum',
        promoText: 'Combo Viajero 2x1 al descender',
        coordinates: { lat: 21.49179, lng: -104.86640 },
        radiusMeters: 350,
        callToAction: 'Aprovechar 2x1',
        isActive: true,
        routeIds: [],
        createdAt: new Date().toISOString()
      },
      {
        id: 'ad-pin-forum',
        clientId: 'client-burger-lab',
        type: 'pin',
        title: 'Burger Lab (Pin Dorado)',
        description: 'Marcador dorado destacado sobre las rutas de Forum.',
        icon: '⭐',
        coordinates: { lat: 21.49179, lng: -104.86640 },
        radiusMeters: 400,
        callToAction: 'Cómo llegar',
        isActive: true,
        routeIds: [],
        createdAt: new Date().toISOString()
      }
    ];
    await db.ads.bulkAdd(defaultAds);
  }

  // No sample stops — user creates real stops from GPS field work
}
