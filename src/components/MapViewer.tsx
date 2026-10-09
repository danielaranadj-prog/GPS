import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import type { Stop, RouteItem, DirectionType, GpsBreadcrumb, Coordinates } from '../types';

interface MapViewerProps {
  mappingMode: 'zone' | 'route' | 'stops';
  currentPosition: {
    lat: number;
    lng: number;
    accuracy: number;
    heading: number | null;
  };
  selectedRoute: RouteItem | null;
  visibleRouteIds: string[];
  routes: RouteItem[];
  direction: DirectionType;
  stops: Stop[];
  recordedPoints: GpsBreadcrumb[];
  deviationPoints: [number, number][];
  isDesktopMode: boolean;
  isRecording?: boolean;
  isEditingRoute?: boolean;
  onRouteTraceEdited?: (newCoords: [number, number][]) => void;
  onStopDragEnd?: (stopId: string, newCoords: Coordinates) => void;
  onMapClick?: (coords: Coordinates) => void;
  onStopClick?: (stopId: string) => void;
  centerTrigger?: number;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  mappingMode,
  currentPosition,
  selectedRoute,
  visibleRouteIds,
  routes,
  direction,
  stops,
  recordedPoints,
  deviationPoints,
  isDesktopMode,
  isRecording,
  isEditingRoute,
  onRouteTraceEdited,
  onStopDragEnd,
  onMapClick,
  onStopClick,
  centerTrigger,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layers
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const officialLineRef = useRef<L.Polyline | null>(null);
  const officialGlowLineRef = useRef<L.Polyline | null>(null);
  const recordedLineRef = useRef<L.Polyline | null>(null);
  const deviationLineRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const stopsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const terminusGroupRef = useRef<L.LayerGroup | null>(null);
  const visibleRoutesGroupRef = useRef<L.LayerGroup | null>(null);

  type BasemapType = 'google-streets' | 'google-hybrid' | 'osm' | 'dark' | 'carto-light';
  const [basemap, setBasemap] = useState<BasemapType>('google-streets');
  // useRef so effects always read current value synchronously (no stale closure)
  const mapReadyRef = useRef(false);
  // Incrementing this forces dependent effects to re-run after map is initialized
  const [mapReadyTick, setMapReadyTick] = useState(0);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // In StrictMode or on re-mount, clean previous instance
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch {
        // ignore
      }
      mapInstanceRef.current = null;
    }

    const container = mapContainerRef.current as HTMLElement & { _leaflet_id?: number | null };
    if (container._leaflet_id) {
      delete container._leaflet_id;
    }

    const map = L.map(container, {
      center: [currentPosition.lat, currentPosition.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    // Custom zoom control in top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial tile layer: Google Maps Streets (fast, high accuracy, fully detailed for Tepic & Xalisco)
    const tileLayer = L.tileLayer(
      'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 21,
      }
    ).addTo(map);
    tileLayerRef.current = tileLayer;

    // Layer group for stops
    const stopsGroup = L.layerGroup().addTo(map);
    stopsLayerGroupRef.current = stopsGroup;


    // Layer group for start/end terminus markers
    const terminusGroup = L.layerGroup().addTo(map);
    terminusGroupRef.current = terminusGroup;

    const visibleGroup = L.layerGroup().addTo(map);
    visibleRoutesGroupRef.current = visibleGroup;


    mapInstanceRef.current = map;
    mapReadyRef.current = true;
    setMapReadyTick(t => t + 1); // trigger effects that guard on mapReadyRef

    // Force size calculation immediately and after small delays for layout stabilization
    map.invalidateSize();
    const timer1 = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 300);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      mapReadyRef.current = false;
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      try {
        map.remove();
      } catch {
        // ignore
      }
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Basemap Switch (Google Streets, Google Hybrid Satellite, OSM OpenSource, Carto Dark)
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    tileLayerRef.current.remove();

    let url = 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    let subdomains: string | string[] = ['0', '1', '2', '3'];
    let maxZoom = 21;

    if (basemap === 'google-hybrid') {
      url = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      subdomains = ['0', '1', '2', '3'];
      maxZoom = 21;
    } else if (basemap === 'osm') {
      url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      subdomains = 'abc';
      maxZoom = 19;
    } else if (basemap === 'dark') {
      url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      subdomains = 'abc';
      maxZoom = 19;
    } else if (basemap === 'carto-light') {
      url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      subdomains = 'abc';
      maxZoom = 19;
    }

    const newLayer = L.tileLayer(url, {
      subdomains,
      maxZoom,
      className: basemap === 'carto-light' ? 'grayscale opacity-80 brightness-110 contrast-75' : (basemap === 'dark' ? 'invert grayscale brightness-75 contrast-125' : '')
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [basemap]);

  // Handle Map Click in Desktop Mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const clickHandler = (e: L.LeafletMouseEvent) => {
      if (!isEditingRoute && (isDesktopMode || mappingMode === 'stops') && onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    };

    map.on('click', clickHandler);
    return () => {
      map.off('click', clickHandler);
    };
  }, [isDesktopMode, mappingMode, onMapClick]);

  
  // Render Official SEMOVI Route Line(s)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReadyRef.current) return;

    if (visibleRoutesGroupRef.current) {
      visibleRoutesGroupRef.current.clearLayers();
    }
    if (terminusGroupRef.current) {
      terminusGroupRef.current.clearLayers();
    }

    const visibleRoutes = routes.filter(r => visibleRouteIds.includes(r.id));
    
    // Bounds for all visible routes
    let allCoords: [number, number][] = [];

    visibleRoutes.forEach(route => {
      const pathCoords = direction === 'ida' ? route.ida : route.vuelta;
      if (!pathCoords || pathCoords.length < 2) return;
      allCoords.push(...pathCoords);

      
      const isComingSoon = route.status === 'coming_soon';
      const routeColor = isComingSoon ? '#64748b' : (route.color || '#2563eb');
      const isInteractive = isEditingRoute && visibleRouteIds.length === 1 && route.id === selectedRoute?.id;

      const glow = L.polyline(pathCoords, {
        color: '#090d16',
        weight: 8,
        opacity: isComingSoon ? 0.3 : 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      });
      
      const line = L.polyline(pathCoords, {
        color: routeColor,
        weight: 5,
        opacity: isComingSoon ? 0.5 : 1,
        dashArray: isComingSoon ? '10, 10' : undefined,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: isInteractive,
      });

      // If not interactive, bubble clicks to the map just in case (though interactive: false handles it)
      if (!isInteractive) {
         // interactive: false makes it ignore pointer events in Leaflet 1.0+
      } else {
         // When editing, we still want to add stops? No, when editing they are dragging vertices, not adding stops.
      }

      
      
      visibleRoutesGroupRef.current?.addLayer(glow);
      visibleRoutesGroupRef.current?.addLayer(line);

      // Only enable editing if ONE route is selected and we are in edit mode
      if (isEditingRoute && visibleRouteIds.length === 1 && route.id === selectedRoute?.id) {
        (line as any).pm.enable({
          allowSelfIntersection: true,
          preventMarkerRemoval: false,
          snappable: false,
        });

        const handleEdit = () => {
          const latlngs = line.getLatLngs() as L.LatLng[];
          const coords = latlngs.map(ll => [ll.lat, ll.lng] as [number, number]);
          if (onRouteTraceEdited) onRouteTraceEdited(coords);
        };

        line.on('pm:markerdragend', handleEdit);
        line.on('pm:vertexadded', handleEdit);
        line.on('pm:vertexremoved', handleEdit);
        line.on('pm:cut', handleEdit);
      }

      // Terminus badges only for the active selected route
          });

    try {
      if (allCoords.length > 0 && mapReadyTick > 0 && !isEditingRoute) {
        map.fitBounds(allCoords, { padding: [50, 50], animate: true, duration: 1 });
      }
    } catch (e) {
      console.warn('fitBounds error:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, visibleRouteIds, selectedRoute, direction, mapReadyTick, isEditingRoute, onRouteTraceEdited]);


  // Render Street Recorded Track
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReadyRef.current) return;

    if (recordedLineRef.current) recordedLineRef.current.remove();

    if (recordedPoints.length < 2) return;

    const latLngs: [number, number][] = recordedPoints.map(p => [p.lat, p.lng]);
    recordedLineRef.current = L.polyline(latLngs, {
      color: '#10b981',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordedPoints, mapReadyTick]);

  // Render Deviation Track (Alert Red)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReadyRef.current) return;

    if (deviationLineRef.current) deviationLineRef.current.remove();

    if (deviationPoints.length < 2) return;

    deviationLineRef.current = L.polyline(deviationPoints, {
      color: '#ef4444',
      weight: 6,
      opacity: 0.95,
      dashArray: '4, 6',
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviationPoints, mapReadyTick]);

  // Render Stops Markers (zoom-aware density)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const stopsGroup = stopsLayerGroupRef.current;
    if (!map || !stopsGroup || !mapReadyRef.current) return;
    
    if (isEditingRoute) {
      stopsGroup.clearLayers();
      return;
    }

    const buildMarkers = () => {
      stopsGroup.clearLayers();
      const zoom = map.getZoom();

      stops.forEach((stop) => {
        let badgeColor = '#10b981'; // oficial green
        let typeLabel = 'Oficial';
        if (stop.type === 'costumbre') { badgeColor = '#f59e0b'; typeLabel = 'Costumbre'; }
        else if (stop.type === 'base')  { badgeColor = '#8b5cf6'; typeLabel = 'Base'; }

        let statusBadge = '';
        const isOrphan = !stop.routeIds || stop.routeIds.length === 0;
        const isLowAccuracy = stop.accuracy && stop.accuracy > 15;
        if (isOrphan)       { badgeColor = '#f97316'; statusBadge = '<span style="font-size:8px;padding:1px 4px;border-radius:3px;background:#f9731620;color:#fb923c;border:1px solid #f9731640">Huérfana</span>'; }
        else if (isLowAccuracy) { badgeColor = '#f43f5e'; statusBadge = '<span style="font-size:8px;padding:1px 4px;border-radius:3px;background:#f43f5e20;color:#fb7185;border:1px solid #f43f5e40">Mala Señal</span>'; }

        let iconHtml = '';
        let iconSize: [number, number] = [8, 8];
        let iconAnchor: [number, number] = [4, 4];
        let popupAnchor: [number, number] = [0, -6];

        const lockBadge = stop.isLocked ? `<div style="position:absolute;top:-4px;right:-4px;background:#f59e0b;color:white;font-size:8px;line-height:1;border-radius:50%;padding:2px;border:1px solid white;">🔒</div>` : '';

        if (zoom <= 13) {
          // Minimal dot — just a 6px colored circle, no text
          iconHtml = `<div style="position:relative;"><div style="width:6px;height:6px;border-radius:50%;background:${badgeColor};border:1px solid rgba(255,255,255,0.7);box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div></div>`;
          iconSize = [6, 6]; iconAnchor = [3, 3]; popupAnchor = [0, -4];
        } else if (zoom <= 16) {
          // Compact — 14px circle with sequence number in tiny font
          iconHtml = `<div style="position:relative;width:14px;height:14px;border-radius:50%;background:${badgeColor};border:1.5px solid white;display:flex;align-items:center;justify-content:center;font-family:monospace;font-weight:700;font-size:7px;color:white;box-shadow:0 1px 4px rgba(0,0,0,0.35);">${stop.type === 'base' ? '◉' : stop.sequence}${lockBadge}</div>`;
          iconSize = [14, 14]; iconAnchor = [7, 7]; popupAnchor = [0, -8];
        } else {
          // Full — 20px circle, sequence, no neon glow, clean border
          iconHtml = `<div style="position:relative;width:20px;height:20px;border-radius:50%;background:${badgeColor};border:2px solid white;display:flex;align-items:center;justify-content:center;font-family:monospace;font-weight:800;font-size:8px;color:white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${stop.sequence}${lockBadge}</div>`;
          iconSize = [20, 20]; iconAnchor = [10, 10]; popupAnchor = [0, -12];
        }

        const customIcon = L.divIcon({
          className: 'custom-stop-icon',
          html: iconHtml,
          iconSize,
          iconAnchor,
          popupAnchor,
        });

        const marker = L.marker([stop.coordinates.lat, stop.coordinates.lng], {
          icon: customIcon,
          draggable: zoom >= 15 && !stop.isLocked, // only draggable when zoomed in enough and unlocked
          title: `#${stop.sequence} ${stop.name}`,
        });

        if (onStopDragEnd && zoom >= 15 && !stop.isLocked) {
          marker.on('dragend', (e) => {
            const latlng = (e.target as L.Marker).getLatLng();
            onStopDragEnd(stop.id, { lat: latlng.lat, lng: latlng.lng });
          });
        }
        
        marker.on('click', () => {
          if (onStopClick) onStopClick(stop.id);
        });

        const popupContent = `
          <div style="padding:8px;min-width:180px;font-family:sans-serif;font-size:12px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">
              <span style="padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:white;background:${badgeColor}">#${stop.sequence} ${typeLabel}</span>
              ${stop.accuracy ? `<span style="font-size:9px;color:#64748b">±${stop.accuracy}m</span>` : ''}
              ${statusBadge}
            </div>
            <p style="font-weight:700;font-size:13px;color:#1e293b;margin:0 0 4px 0;line-height:1.3">${stop.name}</p>
            <p style="font-size:10px;color:#94a3b8;margin:0">${stop.coordinates.lat.toFixed(5)}, ${stop.coordinates.lng.toFixed(5)}</p>
            ${(isDesktopMode || mappingMode === 'stops') && zoom >= 15 && !stop.isLocked ? '<p style="font-size:9px;color:#2563eb;margin:4px 0 0 0">💡 Arrastra para ajustar</p>' : ''}
            ${stop.isLocked ? '<p style="font-size:9px;color:#d97706;margin:4px 0 0 0">🔒 Parada bloqueada</p>' : ''}
          </div>
        `;

        marker.bindPopup(popupContent, { className: 'custom-transit-popup', maxWidth: 220 });
        stopsGroup.addLayer(marker);
      });
    };

    buildMarkers();

    // Re-build on zoom change so density updates live
    map.on('zoomend', buildMarkers);
    return () => { map.off('zoomend', buildMarkers); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, isDesktopMode, mappingMode, onStopDragEnd, onStopClick, mapReadyTick, isEditingRoute]);

  // Update Live GPS Location Marker & Accuracy Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReadyRef.current) return;

    const { lat, lng, accuracy } = currentPosition;

    // Pulse accuracy halo
    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle([lat, lng], {
        radius: Math.max(accuracy, 6),
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        weight: 1.5,
      }).addTo(map);
    } else {
      accuracyCircleRef.current.setLatLng([lat, lng]);
      accuracyCircleRef.current.setRadius(Math.max(accuracy, 6));
    }

    // Vehicle/surveyor dot (Vector CircleMarker ensures it never gets clipped or hidden by CSS)
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.circleMarker([lat, lng], {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2563eb',
        fillOpacity: 1,
        pane: 'markerPane',
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng([lat, lng]);
      if (userMarkerRef.current.bringToFront) {
        userMarkerRef.current.bringToFront();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition, mapReadyTick]);

  // -------------------------------------------------------------
  // Navigation: Follow Mode & Rotation
  // -------------------------------------------------------------
  const [isFollowing, setIsFollowing] = useState(true);

  // Re-center continuously if following
  useEffect(() => {
    if (isFollowing && mapInstanceRef.current && mapReadyRef.current) {
      mapInstanceRef.current.setView([currentPosition.lat, currentPosition.lng], mapInstanceRef.current.getZoom(), { animate: false });
    }
  }, [currentPosition.lat, currentPosition.lng, isFollowing, mapReadyTick]);

  // If user drags the map, disable follow mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReadyRef.current) return;

    const disableFollow = () => setIsFollowing(false);
    map.on('dragstart', disableFollow);
    
    return () => {
      map.off('dragstart', disableFollow);
    };
  }, [mapReadyTick]);

  
  // Tilt & Zoom when recording starts/stops
  useEffect(() => {
    if (!mapInstanceRef.current || !currentPosition.lat) return;
    
    if (isRecording) {
      setIsFollowing(true);
      mapInstanceRef.current.flyTo([currentPosition.lat, currentPosition.lng], 19, {
        animate: true,
        duration: 1.5,
      });
    } else {
      // Zoom back out when finished
      mapInstanceRef.current.flyTo([currentPosition.lat, currentPosition.lng], 16, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [isRecording]);

  // Re-center on centerTrigger change (Waze-like zoom)
  useEffect(() => {
    if (!mapInstanceRef.current || !centerTrigger) return; // ignore initial 0
    setIsFollowing(true); // Reactivate follow mode
    mapInstanceRef.current.flyTo([currentPosition.lat, currentPosition.lng], isRecording ? 19 : 18, {
      animate: true,
      duration: 1.2,
    });
  }, [centerTrigger]);

  // Update CSS variable for heading to rotate markers correctly
  const heading = isFollowing ? (currentPosition.heading || 0) : 0;
  useEffect(() => {
    document.documentElement.style.setProperty('--map-heading', `${heading}deg`);
  }, [heading]);

  return (
    <div className={`relative w-full h-full min-h-[300px] overflow-hidden ${(basemap === "dark" || basemap === "google-hybrid") ? "bg-slate-900" : "bg-[#e5e3df]"}`} >
      {/* Map Wrapper: oversized to avoid empty corners when rotated */}
      <div 
        className="absolute transition-transform duration-300 ease-out z-0 pointer-events-auto"
        style={{
          top: '-30%',
          left: '-30%',
          width: '160%',
          height: '160%',
          transform: `rotate(${-heading}deg)`,
          transformOrigin: 'center center',
        }}
      >
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Floating Basemap Selector */}
      <div className="absolute top-36 left-4 z-[400] flex flex-col md:flex-row bg-white/90 backdrop-blur-md border border-slate-200 rounded-xl p-1 shadow-lg text-xs font-semibold text-slate-600 gap-1 pointer-events-auto">
        <button
          onClick={() => setBasemap('google-streets')}
          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
            basemap === 'google-streets' ? 'bg-blue-600 text-white shadow' : 'hover:text-blue-600 hover:bg-slate-100'
          }`}
        >
          <span>Google Calles</span>
        </button>
        <button
          onClick={() => setBasemap('google-hybrid')}
          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
            basemap === 'google-hybrid' ? 'bg-blue-600 text-white shadow' : 'hover:text-blue-600 hover:bg-slate-100'
          }`}
        >
          <span>Satélite</span>
        </button>
        <button
          onClick={() => setBasemap('carto-light')}
          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
            basemap === 'carto-light' ? 'bg-blue-600 text-white shadow' : 'hover:text-blue-600 hover:bg-slate-100'
          }`}
        >
          <span>Limpio</span>
        </button>
        
        
      </div>
      
      {/* Follow mode indicator/button */}
      
    </div>
  );
};
