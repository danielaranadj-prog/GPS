import assert from 'node:assert/strict';
import { parseStops } from '../src/services/stops.ts';

const stop = {
  id: 'stop-1', name: 'Parada de prueba', coordinates: { lat: 21.5095, lng: -104.8957 },
  type: 'oficial', direction: 'ida', sequence: 0, routeIds: ['ruta-1'], accuracy: 12,
};

assert.deepEqual(parseStops([stop]), [stop]);
assert.deepEqual(parseStops({ stops: [stop] }), [stop]);
assert.throws(() => parseStops([stop, stop]), /repetido/);
assert.throws(() => parseStops([{ ...stop, coordinates: { lat: 100, lng: 0 } }]), /coordenadas/);
assert.throws(() => parseStops([{ ...stop, accuracy: -1 }]), /precisión/);
assert.throws(() => parseStops([{ ...stop, routeIds: 'ruta-1' }]), /rutas/);
assert.throws(() => parseStops([{ ...stop, direction: 'ambos' }]), /sentido/);
assert.throws(() => parseStops({ features: [] }), /paradas/);
console.log('PASS: validación de paradas, duplicados, coordenadas, GPS y sentido');
