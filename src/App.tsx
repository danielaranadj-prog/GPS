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
import { useLiveQuery } from 'dexie-react-hooks';
import type { StopType, Coordinates, Stop, RouteCategory } from './types';

export function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [isDesktopMode, setIsDesktopMode] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [routeModalMode, setRouteModalMode] = useState<'new' | 'variant' | null>(null);
  const [lastMarkedStop, setLastMarkedStop] = useState<Stop | null>(null);
  const [centerTrigger, setCenterTrigger] = useState(0);
  const [isDeviationDismissed, setIsDeviationDismissed] = useState(false);

  // Initialize DB and seed default 39 Tepic SEMOVI routes
  useEffect(() => {
    initializeDatabase().then(() => {
      setIsDbReady(true);
    });
  }, []);

  // Transit Data Hook
  const {
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
  } = useTransitData();

  // All stops across all routes for export
  const allStops = useLiveQuery(() => db.stops.toArray(), []) || [];

  // Official path for current route and direction
  const officialPath = useMemo(() => {
    if (!selectedRoute) return [];
    return direction === 'ida' ? selectedRoute.ida : selectedRoute.vuelta;
  }, [selectedRoute, direction]);

  // Geolocation & Continuous Track Recording
  const {
    position,
    hasRealGps,
    isRecording,
    recordedPoints,
    totalRecordedDistanceMeters,
    startRecording,
    stopRecording,
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
      setLastMarkedStop(created);
    }
    return created;
  }, [addStop, position]);

  // Undo last marked stop
  const handleUndoLastStop = useCallback(async () => {
    if (!lastMarkedStop) return;
    await deleteStop(lastMarkedStop.id);
    setLastMarkedStop(null);
  }, [lastMarkedStop, deleteStop]);

  // Desktop Map Click to place stop
  const handleMapClick = useCallback(async (coords: Coordinates) => {
    if (!isDesktopMode) return;
    const created = await addStop(coords, 'costumbre', undefined, 1.0);
    if (created) {
      setLastMarkedStop(created);
    }
  }, [isDesktopMode, addStop]);

  // Stop Dragged on Sidewalk
  const handleStopDragEnd = useCallback(async (stopId: string, newCoords: Coordinates) => {
    await updateStop(stopId, { coordinates: newCoords });
  }, [updateStop]);

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
        onSelectRouteId={setSelectedRouteId}
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
      <div className="flex-1 min-h-0 relative flex overflow-hidden">
        
        {/* Interactive Map */}
        <div className="flex-1 min-h-0 h-full relative">
          <MapViewer
            currentPosition={position}
            selectedRoute={selectedRoute}
            direction={direction}
            stops={stops}
            recordedPoints={recordedPoints}
            deviationPoints={deviationStatus.deviationPoints}
            isDesktopMode={isDesktopMode}
            onStopDragEnd={handleStopDragEnd}
            onMapClick={handleMapClick}
            centerTrigger={centerTrigger}
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
              onStartRecording={startRecording}
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
            onDeleteStop={deleteStop}
            onReorderStop={reorderStop}
            recordedPointsLength={recordedPoints.length}
            onAcceptTrace={handleAcceptTrace}
            onOpenVariantModal={() => setRouteModalMode('variant')}
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
