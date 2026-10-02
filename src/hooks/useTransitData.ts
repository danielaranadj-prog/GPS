import { useState, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Stop, RouteItem, DirectionType, StopType, Coordinates } from '../types';
import { feedbackService } from '../services/sound';
import { reverseGeocode } from '../services/nominatim';

export function useTransitData() {
  const routes = useLiveQuery(() => db.routes.toArray(), []) || [];
  const [selectedRouteId, setSelectedRouteId] = useState<string>('r-o-suchiate');
  const [direction, setDirection] = useState<DirectionType>('ida');

  // Fallback to first route if selected not found
  const selectedRoute = routes.find(r => r.id === selectedRouteId) || routes[0] || null;

  // Stops for current route and direction
  const stops = useLiveQuery(
    async () => {
      if (!selectedRouteId) return [];
      const allStops = await db.stops
        .where('direction')
        .equals(direction)
        .toArray();

      return allStops
        .filter(s => s.routeIds.includes(selectedRouteId))
        .sort((a, b) => a.sequence - b.sequence);
    },
    [selectedRouteId, direction]
  ) || [];

  // Set default route once routes load
  useEffect(() => {
    if (routes.length > 0 && !routes.some(r => r.id === selectedRouteId)) {
      setSelectedRouteId(routes[0].id);
    }
  }, [routes, selectedRouteId]);

  // Add stop with auto-naming, sequence calculation and tactile chime
  const addStop = useCallback(async (
    coords: Coordinates,
    type: StopType = 'costumbre',
    customName?: string,
    accuracy?: number
  ) => {
    if (!selectedRoute) return null;

    const currentSequence = stops.length + 1;
    let stopName = customName;

    if (!stopName) {
      // Reverse geocode street name
      stopName = await reverseGeocode(coords.lat, coords.lng);
    }

    // Generate unique ID slug
    const cleanSlug = stopName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 28);

    const stopId = `stop-${selectedRoute.code.toLowerCase()}-${cleanSlug}-${Date.now().toString().slice(-4)}`;

    const newStop: Stop = {
      id: stopId,
      name: stopName,
      coordinates: coords,
      type,
      routeIds: [selectedRoute.id],
      direction,
      sequence: currentSequence,
      accuracy,
      createdAt: new Date().toISOString(),
    };

    await db.stops.add(newStop);
    feedbackService.playSuccess();
    return newStop;
  }, [selectedRoute, direction, stops.length]);

  // Update existing stop (e.g. pin dragged on desktop map)
  const updateStop = useCallback(async (id: string, updates: Partial<Stop>) => {
    await db.stops.update(id, updates);
  }, []);

  // Delete stop and re-sequence remaining stops
  const deleteStop = useCallback(async (id: string) => {
    const stopToDelete = await db.stops.get(id);
    if (!stopToDelete) return;

    await db.stops.delete(id);

    // Re-index remaining stops
    if (selectedRouteId) {
      const remaining = await db.stops
        .where('direction')
        .equals(direction)
        .toArray();

      const routeStops = remaining
        .filter(s => s.routeIds.includes(selectedRouteId))
        .sort((a, b) => a.sequence - b.sequence);

      for (let i = 0; i < routeStops.length; i++) {
        await db.stops.update(routeStops[i].id, { sequence: i + 1 });
      }
    }
  }, [selectedRouteId, direction]);

  // Move stop up or down in order
  const reorderStop = useCallback(async (stopId: string, targetIndex: number) => {
    const list = [...stops];
    const currentIndex = list.findIndex(s => s.id === stopId);
    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= list.length) return;

    const [moved] = list.splice(currentIndex, 1);
    list.splice(targetIndex, 0, moved);

    // Update sequences
    for (let i = 0; i < list.length; i++) {
      await db.stops.update(list[i].id, { sequence: i + 1 });
    }
  }, [stops]);

  // Aceptar trazo 2026: replaces official geometry with recorded track
  const acceptRecordedTrackAsOfficial = useCallback(async (newCoords: [number, number][]) => {
    if (!selectedRoute || newCoords.length < 2) return;

    const updated = {
      ...selectedRoute,
      [direction]: newCoords,
      notes: `${selectedRoute.notes || ''} [Actualizado con trazo 2026 de calle]`.trim(),
    };

    await db.routes.put(updated);
    feedbackService.playSuccess();
  }, [selectedRoute, direction]);

  // Guardar como Ramal / Variante
  const saveAsVariant = useCallback(async (variantName: string, newCoords: [number, number][]) => {
    if (!selectedRoute) return;

    const variantId = `r-var-${Date.now().toString().slice(-6)}`;
    const newRoute: RouteItem = {
      id: variantId,
      code: `${selectedRoute.code}-V`,
      name: variantName,
      agency: selectedRoute.agency,
      category: 'ramal',
      color: '#ec4899',
      ida: direction === 'ida' ? newCoords : selectedRoute.ida,
      vuelta: direction === 'vuelta' ? newCoords : selectedRoute.vuelta,
      isCustom: true,
      notes: `Ramal derivado de ${selectedRoute.name}`,
    };

    await db.routes.add(newRoute);
    setSelectedRouteId(variantId);
    feedbackService.playSuccess();
  }, [selectedRoute, direction]);

  // Create new custom route from scratch (e.g. Xalisco nueva ruta)
  const createCustomRoute = useCallback(async (route: Omit<RouteItem, 'id'>) => {
    const newId = `r-c-${Date.now().toString().slice(-6)}`;
    const fullRoute: RouteItem = {
      ...route,
      id: newId,
      isCustom: true,
    };
    await db.routes.add(fullRoute);
    setSelectedRouteId(newId);
    feedbackService.playSuccess();
    return fullRoute;
  }, []);

  return {
    routes,
    selectedRoute,
    selectedRouteId,
    setSelectedRouteId,
    direction,
    setDirection,
    stops,
    addStop,
    updateStop,
    deleteStop,
    reorderStop,
    acceptRecordedTrackAsOfficial,
    saveAsVariant,
    createCustomRoute,
  };
}
