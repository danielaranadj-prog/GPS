import React, { useState } from 'react';
import {
  ListOrdered,
  ChevronUp,
  ChevronDown,
  Trash2,
  Edit2,
  Check,
  X,
  GitMerge,
  GitFork,
  MapPin,
  Sparkles,
  Info,
  UploadCloud
} from 'lucide-react';
import type { Stop, RouteItem, DirectionType, StopType, GpsBreadcrumb } from '../types';
import { db } from '../db';
import * as turf from '@turf/turf';

interface DesktopEditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRoute: RouteItem | null;
  direction: DirectionType;
  stops: Stop[];
  onUpdateStop: (id: string, updates: Partial<Stop>) => Promise<void>;
  onDeleteStop: (id: string) => Promise<void>;
  onReorderStop: (id: string, targetIndex: number) => Promise<void>;
  recordedPointsLength: number;
  onAcceptTrace: () => void;
  onOpenVariantModal: () => void;
  onLoadTrack?: (points: GpsBreadcrumb[]) => void;
  isEditingRoute?: boolean;
  onToggleEditingRoute?: () => void;
}

export const DesktopEditorDrawer: React.FC<DesktopEditorDrawerProps> = ({
  isOpen,
  onClose,
  selectedRoute,
  direction,
  stops,
  onUpdateStop,
  onDeleteStop,
  onReorderStop,
  recordedPointsLength,
  onAcceptTrace,
  onOpenVariantModal,
  onLoadTrack,
  isEditingRoute,
  onToggleEditingRoute,
}) => {
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<StopType>('costumbre');

  if (!isOpen) return null;

  
  const cancelEdit = () => {
    setEditingStopId(null);
  };

  const handleImportTrack = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onLoadTrack) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        let points: GpsBreadcrumb[] = [];
        
        // Is it a GeoJSON?
        if (parsed.type === 'FeatureCollection' || parsed.type === 'Feature') {
          let coords = [];
          if (parsed.type === 'FeatureCollection' && parsed.features.length > 0) {
             const geom = parsed.features[0].geometry;
             if (geom) coords = geom.type === 'MultiLineString' ? geom.coordinates[0] : geom.coordinates;
          } else if (parsed.geometry) {
             coords = parsed.geometry.type === 'MultiLineString' ? parsed.geometry.coordinates[0] : parsed.geometry.coordinates;
          }
          
          if (coords && coords.length > 0) {
            points = coords.map((c: any, i: number) => ({
              lat: c[1],
              lng: c[0],
              accuracy: 5,
              timestamp: Date.now() + i * 1000,
            }));
          }
        } else if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].lat) {
          // Direct array
          points = parsed;
        } else if (parsed.points) {
          points = parsed.points;
        }

        if (points.length > 0) {
          onLoadTrack(points);
        } else {
          alert('No se pudo encontrar un trazo válido en este archivo.');
        }
      } catch (err) {
        console.error(err);
        alert('Error al leer el archivo. Asegúrate que sea un JSON válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset input
  };

  const handleImportStops = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        let stopsToImport: Stop[] = [];

        if (parsed.stops && Array.isArray(parsed.stops)) {
          // Formato nativo
          stopsToImport = parsed.stops;
        } else if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
          // Formato GeoJSON
          let seq = stops.length + 1;
          stopsToImport = parsed.features
            .filter((f: any) => f.geometry?.type === 'Point')
            .map((f: any) => ({
              id: `stop-imported-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
              name: f.properties?.name || f.properties?.title || `Parada importada ${seq}`,
              coordinates: { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] },
              type: 'oficial',
              routeIds: [],
              direction: direction,
              sequence: seq++,
              createdAt: new Date().toISOString()
            }));
        }

        if (stopsToImport.length > 0) {
          let baseLine: any = null;
          if (selectedRoute) {
            const baseCoords = direction === 'ida' ? selectedRoute.ida : selectedRoute.vuelta;
            if (baseCoords && baseCoords.length >= 2) {
              baseLine = turf.lineString(baseCoords.map(p => [p[1], p[0]]));
            }
          }

          const patchedStops = stopsToImport.map(s => {
            let addRoute = false;
            
            if (baseLine) {
              const stopPoint = turf.point([s.coordinates.lng, s.coordinates.lat]);
              const dist = turf.pointToLineDistance(stopPoint, baseLine, { units: 'meters' });
              // Solo vincular a la ruta actual si realmente pasa a menos de 1m de ella
              if (dist <= 1) {
                addRoute = true;
              }
            } else if (!selectedRoute) {
              addRoute = true;
            }

            const newRouteIds = new Set(s.routeIds || []);
            if (addRoute && selectedRoute) {
              newRouteIds.add(selectedRoute.id);
            }

            return {
              ...s,
              routeIds: Array.from(newRouteIds),
              direction: s.direction || direction
            };
          });

          await db.stops.bulkPut(patchedStops);
          const shownStops = patchedStops.filter(s => selectedRoute && s.routeIds.includes(selectedRoute.id)).length;
          alert(`¡Importadas con éxito ${patchedStops.length} paradas en total!\nSe mostraron y vincularon ${shownStops} a esta ruta por estar a 1m o menos de su trazo.`);
        } else {
          alert('Formato no reconocido. Usa el stops.json oficial de la app o un GeoJSON de Puntos (Point).');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset input
  };

  const handleAutoLinkRoutes = async () => {
    if (!selectedRoute) return;
    
    const confirmLink = window.confirm(
      '¿Deseas buscar automáticamente todas las rutas que pasen por esta misma calle (mismo sentido y < 1m de distancia)?'
    );
    if (!confirmLink) return;

    try {
      const allRoutes = await db.routes.toArray();
      let updatedCount = 0;
      const RADIUS_METERS = 1;

      // Calculate the base line for the current route
      const baseCoords = direction === 'ida' ? selectedRoute.ida : selectedRoute.vuelta;
      if (!baseCoords || baseCoords.length < 2) {
        alert('La ruta actual no tiene un trazo válido para comparar.');
        return;
      }
      const baseLine = turf.lineString(baseCoords.map(p => [p[1], p[0]]));

      for (const stop of stops) { 
        const stopPoint = turf.point([stop.coordinates.lng, stop.coordinates.lat]);
        const newRouteIds = new Set(stop.routeIds || []);
        let modified = false;

        // Find the bearing of the current street for this stop
        const baseNearest = turf.nearestPointOnLine(baseLine, stopPoint);
        const baseIndex = baseNearest.properties?.index ?? 0;
        const p1 = baseLine.geometry.coordinates[baseIndex];
        const p2 = baseLine.geometry.coordinates[Math.min(baseIndex + 1, baseLine.geometry.coordinates.length - 1)];
        const baseBearing = turf.bearing(turf.point(p1), turf.point(p2));

        for (const route of allRoutes) {
          if (newRouteIds.has(route.id)) continue;

          const pathCoords = stop.direction === 'ida' ? route.ida : route.vuelta;
          if (!pathCoords || pathCoords.length < 2) continue;

          const line = turf.lineString(pathCoords.map(p => [p[1], p[0]]));
          const distance = turf.pointToLineDistance(stopPoint, line, { units: 'meters' });

          if (distance <= RADIUS_METERS) {
            // It's close. But is it on the same street/direction, or just crossing perpendicularly?
            const targetNearest = turf.nearestPointOnLine(line, stopPoint);
            const targetIndex = targetNearest.properties?.index ?? 0;
            const tp1 = line.geometry.coordinates[targetIndex];
            const tp2 = line.geometry.coordinates[Math.min(targetIndex + 1, line.geometry.coordinates.length - 1)];
            const targetBearing = turf.bearing(turf.point(tp1), turf.point(tp2));

            // Difference in angle
            let diff = Math.abs(baseBearing - targetBearing);
            if (diff > 180) diff = 360 - diff;

            // If the angle difference is <= 60 degrees, it's flowing along the same avenue/street.
            // If it's ~90 degrees, it's a perpendicular cross street (ignore).
            // If it's ~180 degrees, it's the opposite direction on the same street (ignore).
            if (diff <= 60) {
              newRouteIds.add(route.id);
              modified = true;
            }
          }
        }

        if (modified) {
          await db.stops.update(stop.id, { routeIds: Array.from(newRouteIds) });
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        alert(`¡Listo! Se actualizaron ${updatedCount} paradas. Solo se vincularon rutas que fluyen en la misma dirección de la calle.`);
      } else {
        alert('No se encontraron rutas nuevas en esta misma dirección.');
      }
    } catch (err) {
      console.error(err);
      alert('Hubo un error al procesar las rutas espaciales.');
    }
  };

  return (
    <aside className="w-full h-[60%] md:h-full md:w-96 bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 flex flex-col z-40 shadow-2xl text-slate-800 dark:text-slate-100 overflow-hidden">
      {/* Route Merging Panel */}
      <div className="hidden md:block p-3.5 bg-slate-50/70 border-b border-slate-200">
        <div className="flex items-center gap-1.5 mb-2">
          <GitMerge className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Fusión de Trazos GPS
          </h4>
        </div>
        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
          {recordedPointsLength > 1
            ? `Se han registrado ${recordedPointsLength} puntos en vivo sobre la calle.`
            : 'Graba o simula un recorrido para comparar el trazo de calle contra SEMOVI.'}
        </p>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            onClick={onToggleEditingRoute}
            className={`px-2.5 py-2 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all ${
              isEditingRoute
                ? 'bg-amber-600/20 hover:bg-amber-600/30 border-amber-500/50 text-amber-300'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'
            }`}
          >
            <GitMerge className="w-4 h-4" />
            <span className="text-center">{isEditingRoute ? 'Fin Edición' : 'Editar Trazo'}</span>
          </button>
          
          <button
            onClick={onAcceptTrace}
            disabled={recordedPointsLength < 2}
            className="px-2.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-center">Aceptar Trazo 2026</span>
          </button>
          
          <button
            onClick={onOpenVariantModal}
            className="px-2.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-300 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all"
          >
            <GitFork className="w-4 h-4 text-blue-400" />
            <span className="text-center">Guardar como Ramal</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2 mt-3 pt-3 border-t border-slate-200">
          <button
            onClick={async () => {
              if (selectedRoute && window.confirm('¿Seguro que deseas marcar esta ruta como Próximamente?')) {
                await db.routes.update(selectedRoute.id, { status: 'coming_soon' });
                alert('Ruta marcada como Próximamente.');
              }
            }}
            className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <span className="text-[14px]">⏱️</span>
            <span>Próximamente</span>
          </button>
          <button
            onClick={async () => {
              if (selectedRoute && window.confirm('¿Seguro que deseas eliminar esta ruta completamente de la base de datos?')) {
                await db.routes.delete(selectedRoute.id);
                alert('Ruta eliminada.');
              }
            }}
            className="px-2.5 py-2 rounded-xl bg-red-900/20 hover:bg-red-900/40 border border-red-500/30 text-red-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <span className="text-[14px]">🗑️</span>
            <span>Eliminar Ruta</span>
          </button>
        </div>

        {onLoadTrack && (
          <label className="cursor-pointer px-2.5 py-2 w-full rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center gap-2 transition-all">
            <UploadCloud className="w-4 h-4 text-slate-500" />
            <span>Importar Trazo GPS (.json)</span>
            <input type="file" accept=".json,.geojson" onChange={handleImportTrack} className="hidden" />
          </label>
        )}
      </div>

      {/* Stops Sequential List */}
      {!isEditingRoute && (
      <div className="flex-1 overflow-y-auto p-3 pb-safe space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
          <span className="text-base font-bold text-slate-800 dark:text-slate-100">Paradas Registradas ({stops.length})</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="md:hidden p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 mr-2">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-blue-400">Arrastrables</span>
            <button onClick={handleAutoLinkRoutes} className="cursor-pointer hover:text-slate-900 hover:bg-slate-200 flex items-center bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 transition-colors" title="Vincular automáticamente rutas cercanas a estas paradas">
              <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-400" />
              Auto-Vincular
            </button>
            <label className="cursor-pointer hover:text-slate-900 flex items-center bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 transition-colors">
              <UploadCloud className="w-3.5 h-3.5 mr-1" />
              Importar
              <input type="file" accept=".json" onChange={handleImportStops} className="hidden" />
            </label>
          </div>
        </div>

        {stops.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl text-slate-500">
            <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
            <p className="text-sm font-semibold">No hay paradas en este sentido</p>
            <p className="text-xs mt-1">Usa el botón de campo o haz click en el mapa para marcar la primera.</p>
          </div>
        ) : (
          stops.map((stop, index) => {
            let badgeBg = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
            if (stop.type === 'costumbre') badgeBg = 'bg-amber-500/20 text-amber-400 border-amber-500/40';
            if (stop.type === 'base') badgeBg = 'bg-purple-500/20 text-purple-400 border-purple-500/40';

            const cycleType = () => {
              const types: StopType[] = ['oficial', 'costumbre', 'base'];
              const nextType = types[(types.indexOf(stop.type) + 1) % types.length];
              onUpdateStop(stop.id, { type: nextType });
            };

            const promptEditName = () => {
              const newName = window.prompt('Editar nombre de la parada:', stop.name);
              if (newName !== null && newName.trim() !== '') {
                onUpdateStop(stop.id, { name: newName.trim() });
              }
            };

            return (
              <div
                key={stop.id}
                className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-2.5 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all"
              >
                <div className="flex items-center gap-2">
                    {/* Sequence Badge */}
                    <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-blue-400 shrink-0">
                      {stop.sequence}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                        <span className="cursor-pointer hover:text-blue-300" onClick={promptEditName}>{stop.name}</span>
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span onClick={cycleType} className={`cursor-pointer text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${badgeBg}`}>
                          {stop.type}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {stop.coordinates.lat.toFixed(4)}, {stop.coordinates.lng.toFixed(4)}
                        </span>
                      </div>
                    </div>

                    {/* Up / Down reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        disabled={index === 0}
                        onClick={() => onReorderStop(stop.id, index - 1)}
                        className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-900 disabled:opacity-20"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={index === stops.length - 1}
                        onClick={() => onReorderStop(stop.id, index + 1)}
                        className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-900 disabled:opacity-20"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Edit and Delete */}
                    <button
                      onClick={promptEditName}
                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-blue-300"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => !stop.isLocked && onDeleteStop(stop.id)}
                      disabled={stop.isLocked}
                      className="p-1.5 rounded-lg text-slate-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-rose-950/60 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
              </div>
            );
          })
        )}
      </div>

      )}
      {/* Footer tip */}
      <div className="p-3 pb-safe border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center gap-2">
        <Info className="w-4 h-4 text-blue-400 shrink-0" />
        <span>En el mapa puedes arrastrar cualquier pin directamente a la banqueta deseada.</span>
      </div>
    </aside>
  );
};
