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
import { StopsManager } from './components/StopsManager';
import { PlacesWorkspace } from './components/PlacesWorkspace';
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
  const [placesOpen, setPlacesOpen] = useState(false);
  const [placesDirty, setPlacesDirty] = useState(false);
  const [dbError, setDbError] = useState('');
  const [isDesktopMode, setIsDesktopMode] = useState(false);
  const [mappingMode, setMappingMode] = useState<'zone' | 'route' | 'stops'>('zone');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [routeModalMode, setRouteModalMode] = useState<'new' | 'variant' | null>(null);
  const [lastMarkedStop, setLastMarkedStop] = useState<Stop | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [centerTrigger, setCenterTrigger] = useState(0);
  const [isDeviationDismissed, setIsDeviationDismissed] = useState(false);
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [traceHistory, setTraceHistory] = useState<[number, number][][]>([]);
  const [isRouteManagerOpen, setIsRouteManagerOpen] = useState(false);

  // Initialize DB and seed default 39 Tepic SEMOVI routes
  useEffect(() => {
    initializeDatabase().then(() => setIsDbReady(true)).catch(() => setDbError('No pudimos abrir los datos. Cierra otras pestañas de GPS y vuelve a cargar; no borres los datos del navegador.'));
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
    reverseOfficialTrack,
    cleanOfficialTrack,
    saveAsVariant,
    createCustomRoute,
  } = useTransitData(mappingMode);

  // All stops across all routes for export
  const allStops = useLiveQuery(() => db.stops.toArray(), []) || [];

  // Official path for current route and direction
  const officialPath = useMemo(() => {
    if (!selectedRoute) return [];
    return direction === 'ida' ? selectedRoute.ida : selectedRoute.vuelta;
  }, [selectedRoute, direction]);

  
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (!selectedRoute || traceHistory.length === 0) return;
        e.preventDefault();
        const previousCoords = traceHistory[traceHistory.length - 1];
        setTraceHistory(prev => prev.slice(0, -1));
        const updated = {
          ...selectedRoute,
          ida: previousCoords,
          vuelta: [...previousCoords].reverse()
        };
        await db.routes.put(updated);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRoute, traceHistory]);
  
  const handleRouteTraceEdited = useCallback(async (newCoords: [number, number][]) => {
    if (selectedRoute) {
      setTraceHistory(prev => [...prev, selectedRoute.ida]);
    }
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
      if (placesOpen) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return; // Let browser handle text undo
        e.preventDefault();
        handleUndoGlobal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndoGlobal, placesOpen]);

  // Desktop Map Click to place stop
  const handleMapClick = useCallback(async (coords: Coordinates) => {
    if (!isDesktopMode && mappingMode !== 'stops') return;
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

  if (!isDbReady) { return <div className="h-full w-full bg-slate-50 p-6" role="status">{dbError || 'Abriendo tus datos…'}</div>; }

  return (
    <div className="h-full w-full flex flex-col bg-white text-slate-900 overflow-hidden font-sans relative">
      
      {/* Top App Header */}
      <Header
        mappingMode={mappingMode}
        onToggleMappingMode={mode => {if(placesOpen&&placesDirty&&!window.confirm('Hay cambios de un lugar sin guardar. ¿Descartarlos y salir?'))return;setPlacesDirty(false);setPlacesOpen(false);setMappingMode(mode)}}
        placesOpen={placesOpen}
        onOpenPlaces={() => setPlacesOpen(true)}
        routes={routes}
        selectedRoute={mappingMode === 'route' ? selectedRoute : null}
        selectedRouteId={selectedRouteId}
        onSelectRouteId={(id) => {
          setSelectedRouteId(id);
          if (!visibleRouteIds.includes(id)) {
            setVisibleRouteIds([...visibleRouteIds, id]);
          }
        }}
        visibleRouteIds={mappingMode === 'zone' ? routes.map(r => r.id) : visibleRouteIds}
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
        onClearRoutes={() => setVisibleRouteIds([])}
      />

      {placesOpen && <PlacesWorkspace onDirtyChange={setPlacesDirty} />}
      {/* Keep existing editor state, but isolate all place interactions. */}
      <div className={placesOpen ? 'hidden' : 'flex flex-1 min-h-0 flex-col'}>
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
          {/* Floating GPS Button */}
          <button
            onClick={handleCenterGps}
            className="absolute top-4 right-4 z-[900] w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-blue-600 border border-slate-100 hover:bg-blue-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-crosshair"><circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/></svg>
          </button>
          
          <MapViewer
            mappingMode={mappingMode}
            currentPosition={position}
            selectedRoute={selectedRoute}
            visibleRouteIds={visibleRouteIds}
            routes={routes}
            direction={direction}
            stops={stops}
            recordedPoints={recordedPoints}
            deviationPoints={deviationStatus.deviationPoints}
            isDesktopMode={isDesktopMode}
            isRecording={isRecording}
            onStopDragEnd={handleStopDragEnd}
            onMapClick={handleMapClick}
            centerTrigger={centerTrigger}
            isEditingRoute={isEditingRoute}
            onRouteTraceEdited={handleRouteTraceEdited}
            onStopClick={setSelectedStopId}
          />

          {/* iPhone Ergonomic Field Thumb Bar */}
          {!isDesktopMode && mappingMode !== 'stops' && (
            <FieldControls
              mappingMode={mappingMode}
              currentPosition={position}
              onMarkStop={handleMarkStop}
              isRecording={isRecording}
              onStartRecording={handleStartRecording}
              onStopRecording={stopRecording}
              recordedPointsCount={recordedPoints.length}
              recordedDistanceMeters={totalRecordedDistanceMeters}
              lastMarkedStop={lastMarkedStop}
              onUndoLastStop={handleUndoLastStop}
              onAcceptTrace={handleAcceptTrace}
              onClearTrace={clearRecording}
            />
          )}
        </div>

        {/* Dedicated Stops Manager Sidebar */}
        {mappingMode === 'stops' && (
          <StopsManager
            stops={stops}
            selectedStopId={selectedStopId}
            onDeleteStop={handleDeleteStop}
            onUpdateStop={updateStop}
          />
        )}

        {/* Desktop Mode QA Sidebar */}
        {isDesktopMode && mappingMode !== 'stops' && (
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
            onReverseTrace={reverseOfficialTrack}
            onCleanTrace={cleanOfficialTrack}
          />
        )}
      </div>

      


      </div>
      {/* Official Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        allStops={allStops}
        allRoutes={routes}
        selectedRouteId={mappingMode === 'route' ? selectedRouteId : null}
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
