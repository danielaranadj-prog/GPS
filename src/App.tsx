import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeDatabase, db } from './db';
import { useTransitData } from './hooks/useTransitData';
import { useGeolocation } from './hooks/useGeolocation';
import { useWakeLock } from './hooks/useWakeLock';
import { Header } from './components/Header';
import { MapViewer } from './components/MapViewer';
import { FieldControls } from './components/FieldControls';
import { DeviationBanner } from './components/DeviationBanner';
import { DesktopEditorDrawer } from './components/DesktopEditorDrawer';
import { ExportModal } from './components/ExportModal';
import { NewRouteModal } from './components/NewRouteModal';
import { RouteManagerModal } from './components/RouteManagerModal';
import { TelemetryHUD } from './components/TelemetryHUD';
import { useLiveQuery } from 'dexie-react-hooks';
import type { StopType, Coordinates, Stop, RouteCategory } from './types';

type HistoryAction = 
  | { type: 'add_stop'; stopId: string }
  | { type: 'move_stop'; stopId: string; oldCoords: Coordinates }
  | { type: 'delete_stop'; stop: Stop };

export function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [isDesktopMode, setIsDesktopMode] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [routeModalMode, setRouteModalMode] = useState<'new' | 'variant' | null>(null);
  const [lastMarkedStop, setLastMarkedStop] = useState<Stop | null>(null);
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [centerTrigger, setCenterTrigger] = useState(0);
  const [isDeviationDismissed, setIsDeviationDismissed] = useState(false);
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [isRouteManagerOpen, setIsRouteManagerOpen] = useState(false);

  // Initialize DB and seed default 39 Tepic SEMOVI routes
  useEffect(() => {
    initializeDatabase().then(async () => {
      // Limpiar ramales o rutas creadas por error durante las pruebas
      await db.routes.filter(r => !!r.isCustom).delete();
      // Eliminar ruta no circular
      const yerba = await db.routes.filter(r => r.name === 'La Yerba').first();
      if (yerba) await db.routes.delete(yerba.id);
      setIsDbReady(true);
    });
  }, []);

  // Transit Data Hook
  const {
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
  } = useTransitData();

  // All stops across all routes for export
  const allStops = useLiveQuery(() => db.stops.toArray(), []) || [];

  // Official path for current route and direction
  const officialPath = useMemo(() => {
    if (!selectedRoute) return [];
    return direction === 'ida' ? selectedRoute.ida : selectedRoute.vuelta;
  }, [selectedRoute, direction]);

  const handleRouteTraceEdited = useCallback(async (newCoords: [number, number][]) => {
    if (!selectedRoute) return;
    const updated = {
      ...selectedRoute,
      ida: newCoords,
      vuelta: [...newCoords].reverse()
    };
    await db.routes.put(updated);
  }, [selectedRoute]);

  // Geolocation & Continuous Track Recording
  const {
    position,
    hasRealGps,
    isRecording,
    recordedPoints,
    totalRecordedDistanceMeters,
    startRecording,
    stopRecording,
    loadTrack,
    clearRecording,
    clearDeviation,
    deviationStatus,
    isSimulating,
    toggleSimulation,
  } = useGeolocation({ officialPath });

  // Screen Wake Lock API (keeps iPhone screen awake)
  const { isLocked: wakeLockActive, toggleWakeLock } = useWakeLock();

  // Mark Stop Handler (High accuracy GPS + reverse geocoding + audio feedback)
  const handleMarkStop = useCallback(async (type: StopType) => {
    const coords: Coordinates = {
      lat: position.lat,
      lng: position.lng,
    };
    const created = await addStop(coords, type, undefined, position.accuracy);
    if (created) {
      setHistory(prev => [...prev, { type: 'add_stop', stopId: created.id }]);
      setLastMarkedStop(created);
      setCenterTrigger(prev => prev + 1); // trigger waze zoom
    }
    return created;
  }, [addStop, position]);

  const handleStartRecording = useCallback(() => {
    startRecording();
    setCenterTrigger(prev => prev + 1); // trigger waze zoom
  }, [startRecording]);

  const handleDeleteStop = useCallback(async (stopId: string) => {
    const stop = stops.find(s => s.id === stopId);
    if (stop) {
      setHistory(prev => [...prev, { type: 'delete_stop', stop }]);
    }
    await deleteStop(stopId);
    if (lastMarkedStop?.id === stopId) setLastMarkedStop(null);
  }, [stops, deleteStop, lastMarkedStop]);

  // Global Undo Handler
  const handleUndoGlobal = useCallback(async () => {
    if (history.length === 0) return;
    const lastAction = history[history.length - 1];
    
    if (lastAction.type === 'add_stop') {
      await deleteStop(lastAction.stopId);
      if (lastMarkedStop?.id === lastAction.stopId) setLastMarkedStop(null);
    } else if (lastAction.type === 'move_stop') {
      await updateStop(lastAction.stopId, { coordinates: lastAction.oldCoords });
    } else if (lastAction.type === 'delete_stop') {
      await db.stops.add(lastAction.stop); // restore it exactly as it was
    }
    
    setHistory(prev => prev.slice(0, -1));
  }, [history, deleteStop, updateStop, lastMarkedStop]);

  // Legacy Undo last marked stop (for the visual banner button)
  const handleUndoLastStop = useCallback(async () => {
    if (!lastMarkedStop) return;
    await handleDeleteStop(lastMarkedStop.id);
  }, [lastMarkedStop, handleDeleteStop]);

  // Keyboard shortcuts (Cmd+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return; // Let browser handle text undo
        e.preventDefault();
        handleUndoGlobal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndoGlobal]);

  // Desktop Map Click to place stop
  const handleMapClick = useCallback(async (coords: Coordinates) => {
    if (!isDesktopMode) return;
    const created = await addStop(coords, 'costumbre', undefined, 1.0);
    if (created) {
      setHistory(prev => [...prev, { type: 'add_stop', stopId: created.id }]);
      setLastMarkedStop(created);
    }
  }, [isDesktopMode, addStop]);

  // Stop Dragged on Sidewalk
  const handleStopDragEnd = useCallback(async (stopId: string, newCoords: Coordinates) => {
    const stop = stops.find(s => s.id === stopId);
    if (stop) {
      setHistory(prev => [...prev, { type: 'move_stop', stopId, oldCoords: stop.coordinates }]);
    }
    await updateStop(stopId, { coordinates: newCoords });
  }, [stops, updateStop]);

  // Aceptar trazo 2026
  const handleAcceptTrace = useCallback(async () => {
    if (recordedPoints.length < 2) return;
    const newCoords: [number, number][] = recordedPoints.map(p => [p.lat, p.lng]);
    await acceptRecordedTrackAsOfficial(newCoords);
    clearRecording();
  }, [recordedPoints, acceptRecordedTrackAsOfficial, clearRecording]);

  // Save as Variant
  const handleSaveVariantSubmit = useCallback(async (variantName: string) => {
    const coordsToUse = recordedPoints.length >= 2
      ? recordedPoints.map(p => [p.lat, p.lng] as [number, number])
      : deviationStatus.deviationPoints;

    await saveAsVariant(variantName, coordsToUse);
    clearRecording();
  }, [recordedPoints, deviationStatus.deviationPoints, saveAsVariant, clearRecording]);

  // Create new custom route
  const handleCreateRouteSubmit = useCallback(async (name: string, code: string, category: RouteCategory) => {
    const initialCoords: [number, number][] = recordedPoints.length >= 2
      ? recordedPoints.map(p => [p.lat, p.lng])
      : [
          [position.lat, position.lng],
          [position.lat + 0.005, position.lng + 0.005],
        ];

    await createCustomRoute({
      code,
      name,
      agency: "Rutas de Tepic / Xalisco",
      category,
      color: '#06b6d4',
      ida: initialCoords,
      vuelta: [...initialCoords].reverse(),
    });
  }, [recordedPoints, position, createCustomRoute]);

  const handleCenterGps = useCallback(() => {
    setCenterTrigger(prev => prev + 1);
  }, []);

  if (!isDbReady) {
    return (
      <div className="h-full w-full bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center animate-pulse mb-3">
          <span className="text-xl">🚌</span>
        </div>
        <p className="font-bold text-sm text-white">Iniciando Tepic Transit Studio...</p>
        <p className="text-xs text-slate-500 mt-1">Cargando 39 rutas oficiales SEMOVI y base de datos local</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans relative">
      
      {/* Top App Header */}
      <Header
        routes={routes}
        selectedRoute={selectedRoute}
        selectedRouteId={selectedRouteId}
        onSelectRouteId={(id) => {
          setSelectedRouteId(id);
          if (!visibleRouteIds.includes(id)) {
            setVisibleRouteIds([...visibleRouteIds, id]);
          }
        }}
        visibleRouteIds={visibleRouteIds}
        onOpenRouteManager={() => setIsRouteManagerOpen(true)}
        direction={direction}
        onChangeDirection={setDirection}
        gpsAccuracy={position.accuracy}
        hasRealGps={hasRealGps}
        wakeLockActive={wakeLockActive}
        onToggleWakeLock={toggleWakeLock}
        isDesktopMode={isDesktopMode}
        onToggleDesktopMode={() => setIsDesktopMode(prev => !prev)}
        isSimulating={isSimulating}
        onToggleSimulation={toggleSimulation}
        onOpenNewRouteModal={() => setRouteModalMode('new')}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onCenterGps={handleCenterGps}
      />

      {/* Main Workspace (Map + Drawer) */}
      <div className="flex-1 min-h-0 relative flex flex-col md:flex-row overflow-hidden">
              {isRouteManagerOpen && (
        <RouteManagerModal
          isOpen={isRouteManagerOpen}
          onClose={() => setIsRouteManagerOpen(false)}
          routes={routes}
          visibleRouteIds={visibleRouteIds}
          setVisibleRouteIds={setVisibleRouteIds}
          onDeleteRoutes={deleteRoutes}
        />
      )}
        
        {/* Interactive Map */}
        <div className="flex-1 min-h-0 relative">
          <MapViewer
            currentPosition={position}
            selectedRoute={selectedRoute}
            visibleRouteIds={visibleRouteIds}
            routes={routes}
            direction={direction}
            stops={stops}
            recordedPoints={recordedPoints}
            deviationPoints={deviationStatus.deviationPoints}
            isDesktopMode={isDesktopMode}
            onStopDragEnd={handleStopDragEnd}
            onMapClick={handleMapClick}
            centerTrigger={centerTrigger}
            isEditingRoute={isEditingRoute}
            onRouteTraceEdited={handleRouteTraceEdited}
          />

          {/* Deviation Alert Banner (SEMOVI vs Realidad) */}
          <DeviationBanner
            deviationStatus={deviationStatus}
            routeName={selectedRoute?.name || 'Ruta'}
            isDismissed={isDeviationDismissed}
            onSaveAsVariant={() => setRouteModalMode('variant')}
            onAcceptTrace={handleAcceptTrace}
            onDismiss={() => {
              setIsDeviationDismissed(true);
              clearDeviation();
            }}
            onReopen={() => setIsDeviationDismissed(false)}
          />

          {/* iPhone Ergonomic Field Thumb Bar */}
          {!isDesktopMode && (
            <FieldControls
              currentPosition={position}
              onMarkStop={handleMarkStop}
              isRecording={isRecording}
              onStartRecording={handleStartRecording}
              onStopRecording={stopRecording}
              recordedPointsCount={recordedPoints.length}
              recordedDistanceMeters={totalRecordedDistanceMeters}
              lastMarkedStop={lastMarkedStop}
              onUndoLastStop={handleUndoLastStop}
            />
          )}
        </div>

        {/* Desktop Mode QA Sidebar */}
        {isDesktopMode && (
          <DesktopEditorDrawer
            isOpen={isDesktopMode}
            onClose={() => setIsDesktopMode(false)}
            selectedRoute={selectedRoute}
            direction={direction}
            stops={stops}
            onUpdateStop={updateStop}
            onDeleteStop={handleDeleteStop}
            onReorderStop={reorderStop}
            recordedPointsLength={recordedPoints.length}
            onAcceptTrace={handleAcceptTrace}
            onOpenVariantModal={() => setRouteModalMode('variant')}
            onLoadTrack={loadTrack}
            isEditingRoute={isEditingRoute}
            onToggleEditingRoute={() => setIsEditingRoute(!isEditingRoute)}
          />
        )}
      </div>

      


      {/* Official Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        allStops={allStops}
        allRoutes={routes}
      />

      {/* New Route / Variant Modal */}
      <NewRouteModal
        isOpen={routeModalMode !== null}
        mode={routeModalMode || 'new'}
        initialRouteName={selectedRoute?.name}
        onClose={() => setRouteModalMode(null)}
        onCreateRoute={handleCreateRouteSubmit}
        onSaveVariant={handleSaveVariantSubmit}
      />

    </div>
  );
}
