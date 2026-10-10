import type { Place, PlaceCategory } from '../types';

export const placeCategories: Record<PlaceCategory, string> = {
  gobierno: 'Gobierno', escuela: 'Escuela', hospital: 'Hospital / salud', mercado: 'Mercado', plaza: 'Plaza / comercio',
  oficina: 'Oficina / trámites', parque: 'Parque', deporte: 'Espacio deportivo', estadio: 'Estadio',
  museo: 'Museo', teatro: 'Teatro', monumento: 'Monumento histórico', 
  cementerio: 'Panteón / Cementerio', religion: 'Iglesia / Templo', restaurante: 'Restaurante', cafe: 'Cafetería',
  agencia: 'Agencia automotriz', bar: 'Bar / Centro nocturno', hotel: 'Hotel / Alojamiento',
  gimnasio: 'Gimnasio / Deportivo', cine: 'Cine / Entretenimiento',
  terminal: 'Terminal', colonia: 'Colonia', otro: 'Otro',
};
export const normalizePlace = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function exportPlaces(places: Place[]) {
  return {
    type: 'FeatureCollection', schemaVersion: 1, dataset: 'pordondepasa-places', exportedAt: new Date().toISOString(),
    features: places.map(({ coordinates, ...properties }) => ({
      type: 'Feature', id: properties.id, properties,
      geometry: { type: 'Point', coordinates: [coordinates.lng, coordinates.lat] },
    })),
  };
}

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Se esperaba un objeto GeoJSON.');
  return value as Record<string, unknown>;
};
function text(value: unknown, field: string, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > 1000 || (required && !value.trim())) throw Error(`Campo inválido: ${field}.`);
  return value.trim();
}
function date(value: unknown, field: string) {
  const result = text(value, field, true);
  if (!Number.isFinite(Date.parse(result))) throw Error(`Fecha inválida: ${field}.`);
  return result;
}

/** Validate the whole file before writing anything. Never import stops into places. */
export function parsePlaces(input: unknown): Place[] {
  const data = object(input);
  if (data.type !== 'FeatureCollection' || data.dataset !== 'pordondepasa-places' || data.schemaVersion !== 1 || !Array.isArray(data.features)) {
    throw Error('Usa un GeoJSON de Lugares exportado por esta herramienta (versión 1). No se admiten archivos de paradas o rutas.');
  }
  if (data.features.length > 10000) throw Error('El archivo supera los 10 000 lugares.');
  const ids = new Set<string>();
  return data.features.map((feature, index) => {
    try {
      const f = object(feature), p = object(f.properties), geometry = object(f.geometry);
      if (f.type !== 'Feature' || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2) throw Error('La geometría debe ser un punto [longitud, latitud].');
      const [lng, lat] = geometry.coordinates;
      if (typeof lng !== 'number' || !Number.isFinite(lng) || Math.abs(lng) > 180 || typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90) throw Error('Coordenadas inválidas.');
      const id = text(p.id, 'id', true);
      if (ids.has(id)) throw Error('Identificador repetido en el archivo.');
      if (f.id !== undefined && f.id !== id) throw Error('El identificador del punto no coincide.');
      ids.add(id);
      const rawCategory = text(p.category, 'category', true).toLowerCase();
      const aliases: Record<string, PlaceCategory> = {
        museos: 'museo', teatros: 'teatro', estadios: 'estadio',
        'espacio deportivo': 'deporte', 'espacios deportivos': 'deporte', espacio_deportivo: 'deporte', espacios_deportivos: 'deporte', deportes: 'deporte',
        'monumento historico': 'monumento', 'monumento histórico': 'monumento', 'monumentos historicos': 'monumento', 'monumentos históricos': 'monumento',
        monumento_historico: 'monumento', monumentos_historicos: 'monumento', monumentos: 'monumento',
        cementerios: 'cementerio', panteon: 'cementerio', panteones: 'cementerio',
        'sitios religiosos': 'religion', 'sitio religioso': 'religion', iglesia: 'religion', iglesias: 'religion', templo: 'religion', templos: 'religion',
        restaurantes: 'restaurante',
        cafes: 'cafe', cafeteria: 'cafe', cafeterias: 'cafe',
        'agencias de autos': 'agencia', 'agencia de autos': 'agencia', automotriz: 'agencia',
        bares: 'bar', antro: 'bar', antros: 'bar', cantina: 'bar',
        hoteles: 'hotel', motel: 'hotel', moteles: 'hotel',
        gimnasios: 'gimnasio', gym: 'gimnasio',
        cines: 'cine', cinema: 'cine'
      };
      const category = (aliases[rawCategory] || rawCategory) as PlaceCategory;
      if (!Object.prototype.hasOwnProperty.call(placeCategories, category)) throw Error('Categoría desconocida.');
      if (p.status !== 'pendiente' && p.status !== 'verificado') throw Error('Estado de revisión inválido.');
      if (p.captureMethod !== 'gps' && p.captureMethod !== 'pin') throw Error('Método de captura inválido.');
      if (!Array.isArray(p.aliases) || p.aliases.length > 30) throw Error('Los nombres alternativos deben ser una lista de hasta 30 nombres.');
      if (p.accuracy !== undefined && (typeof p.accuracy !== 'number' || !Number.isFinite(p.accuracy) || p.accuracy < 0)) throw Error('Precisión inválida.');
      if (p.captureMethod === 'pin' && p.accuracy !== undefined) throw Error('Un pin manual no tiene precisión GPS.');
      return {
        id, name: text(p.name, 'name', true), category,
        aliases: p.aliases.map(a => text(a, 'alias', true)), neighborhood: text(p.neighborhood, 'neighborhood'),
        municipality: text(p.municipality, 'municipality'), entrance: text(p.entrance, 'entrance'),
        coordinates: {lat, lng}, status: p.status, captureMethod: p.captureMethod,
        ...(p.accuracy !== undefined ? {accuracy: p.accuracy as number} : {}),
        ...(p.capturedAt !== undefined ? {capturedAt: date(p.capturedAt, 'capturedAt')} : {}),
        createdAt: date(p.createdAt, 'createdAt'), updatedAt: date(p.updatedAt, 'updatedAt'),
      };
    } catch (error) {
      throw Error(`Lugar ${index + 1}: ${error instanceof Error ? error.message : 'Registro inválido.'}`);
    }
  });
}
