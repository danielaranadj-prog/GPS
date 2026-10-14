import type { Stop } from '../types';

/** Validate an entire backup before changing IndexedDB. */
export function parseStops(input: unknown): Stop[] {
  const source = Array.isArray(input) ? input :
    input && typeof input === 'object' && 'stops' in input ? (input as { stops: unknown }).stops : null;
  if (!Array.isArray(source) || source.length > 20000) throw new Error('El archivo debe contener hasta 20 000 paradas.');
  const ids = new Set<string>();
  return source.map((value, index) => {
    const fail = (message: string): never => { throw new Error(`Parada ${index + 1}: ${message}`); };
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('registro inválido.');
    const stop = value as Record<string, unknown>;
    if (typeof stop.id !== 'string' || !stop.id.trim() || stop.id.length > 180 || ids.has(stop.id)) return fail('ID vacío, repetido o demasiado largo.');
    if (typeof stop.name !== 'string' || !stop.name.trim() || stop.name.length > 180) return fail('nombre inválido.');
    const point = stop.coordinates as Record<string, unknown> | undefined;
    if (!point || typeof point.lat !== 'number' || !Number.isFinite(point.lat) || Math.abs(point.lat) > 90 ||
      typeof point.lng !== 'number' || !Number.isFinite(point.lng) || Math.abs(point.lng) > 180) return fail('coordenadas inválidas.');
    if (!['oficial', 'costumbre', 'base'].includes(String(stop.type))) return fail('tipo inválido.');
    if (stop.direction !== 'ida' && stop.direction !== 'vuelta') return fail('sentido inválido.');
    if (!Number.isInteger(stop.sequence) || (stop.sequence as number) < 0) return fail('secuencia inválida.');
    if (stop.routeIds !== undefined && (!Array.isArray(stop.routeIds) || stop.routeIds.some(id => typeof id !== 'string' || !id))) return fail('rutas vinculadas inválidas.');
    if (stop.accuracy !== undefined && (typeof stop.accuracy !== 'number' || !Number.isFinite(stop.accuracy) || stop.accuracy < 0)) return fail('precisión inválida.');
    ids.add(stop.id);
    return stop as unknown as Stop;
  });
}
