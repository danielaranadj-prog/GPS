import { useState, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Stop, RouteItem, DirectionType, StopType, Coordinates } from '../types';
import { feedbackService } from '../services/sound';
import { reverseGeocode } from '../services/nominatim';

import * as turf from '@turf/turf';

export function useTransitData(mappingMode: 'zone' | 'route' | 'stops') {
  const routes = useLiveQuery(() => db.routes.toArray(), []) || [];
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [visibleRouteIds, setVisibleRouteIds] = useState<string[]>([]);
  const [direction, setDirection] = useState<DirectionType>('ida');

  // Fallback to first route if selected not found
  const selectedRoute = routes.find(r => r.id === selectedRouteId) || null;

  // Stops: computed dynamically by geometric proximity to visible routes.
  // Stops are CITY INFRASTRUCTURE — they are not owned by a route.
  // A route "claims" a stop when the stop is within 1m of its polyline.
  // Stops are sorted by their position along the route (orientation-correct).
  const stops = useLiveQuery(
    async () => {
      if (mappingMode === 'zone' || mappingMode === 'stops') return await db.stops.toArray();
      if (visibleRouteIds.length === 0 || routes.length === 0) return [];
      const allStops = await db.stops.toArray();
      if (allStops.length === 0) return [];

      const seenIds = new Set<string>();
      const result: (Stop & { _locationAlongLine: number })[] = [];

      for (const routeId of visibleRouteIds) {
        const route = routes.find(r => r.id === routeId);
        if (!route) continue;

        const pathCoords = direction === 'ida' ? route.ida : (route.vuelta || route.ida);
        if (!pathCoords || pathCoords.length < 2) continue;

        // Build turf line in [lng, lat] order (GeoJSON)
        const baseLine = turf.lineString(pathCoords.map(p => [p[1], p[0]]));

        for (const stop of allStops) {
          const pt = turf.point([stop.coordinates.lng, stop.coordinates.lat]);
          const nearest = turf.nearestPointOnLine(baseLine, pt);
          const distMeters = turf.distance(pt, nearest, { units: 'meters' });

          // Strict 1m proximity — city stop must be right on the route line
          if (distMeters > 1.0) continue;

          const locationAlongLine = nearest.properties?.location ?? 0;

          if (seenIds.has(stop.id)) continue;
          seenIds.add(stop.id);

          result.push({ ...stop, routeIds: [routeId], _locationAlongLine: locationAlongLine });
        }
      }

      // Sort by position along the (first) visible route to respect orientation
      return result
        .sort((a, b) => a._locationAlongLine - b._locationAlongLine)
        .map(({ _locationAlongLine, ...stop }) => stop as Stop);
    },
    [visibleRouteIds, routes, direction]
  ) || [];

  // Set default route once routes load
  

  // Add stop with auto-naming, sequence calculation and tactile chime
  const addStop = useCallback(async (
    coords: Coordinates,
    type: StopType = 'costumbre',
    customName?: string,
    accuracy?: number
  ) => {
    // In zone mode, selectedRoute can be null. We just won't snap to its line.
    // if (!selectedRoute && mappingMode === 'route') return null;

    
    const currentSequence = stops.length + 1;
    let stopName = customName;

    // Snap to route geometry to survive the strict 1.5m filter
    let finalCoords = coords;
    const baseCoords = selectedRoute?.ida;
    if (baseCoords && baseCoords.length >= 2) {
      const pt = turf.point([coords.lng, coords.lat]);
      const baseLine = turf.lineString(baseCoords.map(p => [p[1], p[0]]));
      const nearest = turf.nearestPointOnLine(baseLine, pt);
      finalCoords = { lat: nearest.geometry.coordinates[1], lng: nearest.geometry.coordinates[0] };
    }

    if (!stopName) {
      // Reverse geocode street name
      stopName = await reverseGeocode(finalCoords.lat, finalCoords.lng);
    }

    // Generate unique ID slug

    const cleanSlug = stopName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 28);

    // Global city stop — no explicit route ownership; discovered by geometry
    const stopId = `stop-${cleanSlug}-${Date.now().toString().slice(-4)}`;

    const newStop: Stop = {
      id: stopId,
      name: stopName,
      coordinates: finalCoords,
      type,
      routeIds: [], // empty: routes discover this stop by geometry (<=1m proximity)
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
      const remaining = await db.stops.toArray();

      const routeStops = remaining
        .filter(s => (s.routeIds || []).includes(selectedRouteId))
        .sort((a, b) => a.sequence - b.sequence);

      for (let i = 0; i < routeStops.length; i++) {
        await db.stops.update(routeStops[i].id, { sequence: i + 1 });
      }
    }
  }, [selectedRouteId, direction]);


  const deleteRoutes = useCallback(async (ids: string[]) => {
    await db.routes.bulkDelete(ids);
    const remainingStops = await db.stops.toArray();
    for (const stop of remainingStops) {
      const newRouteIds = (stop.routeIds || []).filter(id => !ids.includes(id));
      if (newRouteIds.length === 0) {
        await db.stops.delete(stop.id);
      } else if (newRouteIds.length !== (stop.routeIds || []).length) {
        await db.stops.update(stop.id, { routeIds: newRouteIds });
      }
    }
    if (ids.includes(selectedRouteId)) {
      setSelectedRouteId(''); // will fallback to routes[0]
    }
    setVisibleRouteIds(prev => prev.filter(id => !ids.includes(id)));
  }, [selectedRouteId]);

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
    visibleRouteIds,
    setVisibleRouteIds,
    deleteRoutes,
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
