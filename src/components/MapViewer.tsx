import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { Stop, RouteItem, DirectionType, GpsBreadcrumb, Coordinates } from '../types';

interface MapViewerProps {
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
  isEditingRoute?: boolean;
  onRouteTraceEdited?: (newCoords: [number, number][]) => void;
  onStopDragEnd?: (stopId: string, newCoords: Coordinates) => void;
  onMapClick?: (coords: Coordinates) => void;
  centerTrigger?: number;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  currentPosition,
  selectedRoute,
  visibleRouteIds,
  routes,
  direction,
  stops,
  recordedPoints,
  deviationPoints,
  isDesktopMode,
  isEditingRoute,
  onRouteTraceEdited,
  onStopDragEnd,
  onMapClick,
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
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const stopsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const terminusGroupRef = useRef<L.LayerGroup | null>(null);
  const visibleRoutesGroupRef = useRef<L.LayerGroup | null>(null);

  type BasemapType = 'google-streets' | 'google-hybrid' | 'osm' | 'dark';
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
      url = 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png';
      subdomains = 'abcd';
      maxZoom = 20;
    }

    const newLayer = L.tileLayer(url, {
      subdomains,
      maxZoom,
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [basemap]);

  // Handle Map Click in Desktop Mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const clickHandler = (e: L.LeafletMouseEvent) => {
      if (isDesktopMode && onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    };

    map.on('click', clickHandler);
    return () => {
      map.off('click', clickHandler);
    };
  }, [isDesktopMode, onMapClick]);

  
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
      if (isEditingRoute && visibleRouteIds.length === 1 && route.id === selectedRoute?.id && (L as any).pm) {
        (line as any).pm.enable({
          allowSelfIntersection: true,
          preventMarkerRemoval: false,
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
      if (route.id === selectedRoute?.id && terminusGroupRef.current) {
        const startPt = pathCoords[0];
        const endPt = pathCoords[pathCoords.length - 1];

        L.marker(startPt, {
          icon: L.divIcon({ className: 'custom-terminus-icon', html: '🚩', iconSize: [24, 24] })
        }).addTo(terminusGroupRef.current);

        L.marker(endPt, {
          icon: L.divIcon({ className: 'custom-terminus-icon', html: '🏁', iconSize: [24, 24] })
        }).addTo(terminusGroupRef.current);
      }
    });

    try {
      if (allCoords.length > 0 && mapReadyTick > 0) {
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

  // Render Stops Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const stopsGroup = stopsLayerGroupRef.current;
    if (!map || !stopsGroup || !mapReadyRef.current) return;

    stopsGroup.clearLayers();

    stops.forEach((stop) => {
      // Color badge based on stop type
      let badgeColor = '#10b981'; // oficial (green)
      let typeLabel = 'Oficial';
      if (stop.type === 'costumbre') {
        badgeColor = '#f59e0b'; // costumbre (yellow)
        typeLabel = 'Costumbre';
      } else if (stop.type === 'base') {
        badgeColor = '#8b5cf6'; // base (purple)
        typeLabel = 'Base';
      }


      let statusBadge = '';
      const isOrphan = !stop.routeIds || stop.routeIds.length === 0;
      const isLowAccuracy = stop.accuracy && stop.accuracy > 15;

      if (isOrphan) {
        badgeColor = '#f97316'; // orange-500
        statusBadge = '<span class="px-1 py-0.5 bg-orange-500/20 text-orange-400 rounded uppercase text-[8px] font-black tracking-widest border border-orange-500/30">Huérfana</span>';
      } else if (isLowAccuracy) {
        badgeColor = '#f43f5e'; // rose-500
        statusBadge = '<span class="px-1 py-0.5 bg-rose-500/20 text-rose-400 rounded uppercase text-[8px] font-black tracking-widest border border-rose-500/30">Mala Señal</span>';
      }

      const iconHtml = `

        <div class="relative flex items-center justify-center cursor-pointer group" style="transform: rotate(var(--map-heading, 0deg)); transition: transform 0.3s ease-out; transform-origin: center bottom;">
          <div class="w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center font-bold text-xs text-white transition-transform transform active:scale-90"
               style="background-color: ${badgeColor}; box-shadow: 0 0 12px ${badgeColor}80;">
            ${stop.sequence}
          </div>
          <div class="absolute -bottom-1 w-2 h-2 rounded-full bg-white shadow"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-stop-icon',
        html: iconHtml,
        iconSize: [32, 36],
        iconAnchor: [16, 34],
        popupAnchor: [0, -32],
      });

      const marker = L.marker([stop.coordinates.lat, stop.coordinates.lng], {
        icon: customIcon,
        draggable: true,
        title: `#${stop.sequence} ${stop.name}`,
      });

      // Drag event for sidewalk tuning
      if (onStopDragEnd) {
        marker.on('dragend', (e) => {
          const latlng = (e.target as L.Marker).getLatLng();
          onStopDragEnd(stop.id, { lat: latlng.lat, lng: latlng.lng });
        });
      }

      // Popup
      const popupContent = `
        <div class="p-2 min-w-[200px] text-slate-900 font-sans">
          <div class="flex items-center gap-2 mb-1">
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white" style="background-color: ${badgeColor}">
              #${stop.sequence} ${typeLabel}
            </span>
            ${stop.accuracy ? `<span class="text-[10px] text-slate-500 font-medium">±${stop.accuracy}m</span>` : ''}
            ${statusBadge}
          </div>
          <p class="font-bold text-sm text-slate-800 leading-tight">${stop.name}</p>
          <p class="text-[11px] text-slate-500 mt-1">Lat: ${stop.coordinates.lat.toFixed(5)}, Lng: ${stop.coordinates.lng.toFixed(5)}</p>
          ${isDesktopMode ? `<p class="text-[10px] text-blue-600 font-semibold mt-1.5">💡 Arrastra el pin para ajustar sobre la banqueta</p>` : ''}
        </div>
      `;

      marker.bindPopup(popupContent, { className: 'custom-transit-popup' });
      stopsGroup.addLayer(marker);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, isDesktopMode, onStopDragEnd, mapReadyTick]);

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

    // Vehicle/surveyor dot
    if (!userMarkerRef.current) {
      const userIconHtml = `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-8 h-8 rounded-full bg-blue-500 animate-ping opacity-60"></div>
          <div class="relative w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center">
            <div class="w-2.5 h-2.5 rounded-full bg-white"></div>
          </div>
        </div>
      `;

      const userIcon = L.divIcon({
        className: 'user-gps-icon',
        html: userIconHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      userMarkerRef.current = L.marker([lat, lng], {
        icon: userIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng([lat, lng]);
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
      mapInstanceRef.current.panTo([currentPosition.lat, currentPosition.lng], { animate: true });
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

  // Re-center on centerTrigger change (Waze-like zoom)
  useEffect(() => {
    if (!mapInstanceRef.current || !centerTrigger) return; // ignore initial 0
    setIsFollowing(true); // Reactivate follow mode
    mapInstanceRef.current.flyTo([currentPosition.lat, currentPosition.lng], 18, {
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
    <div className="relative w-full h-full min-h-[300px] bg-slate-900 overflow-hidden">
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
      <div className="absolute top-4 left-4 z-[400] flex bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-1 shadow-2xl text-xs font-semibold text-slate-300 gap-1 pointer-events-auto">
        <button
          onClick={() => setBasemap('google-streets')}
          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
            basemap === 'google-streets' ? 'bg-blue-600 text-white shadow' : 'hover:text-white hover:bg-slate-800'
          }`}
        >
          <span>Google Calles</span>
        </button>
        <button
          onClick={() => setBasemap('google-hybrid')}
          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
            basemap === 'google-hybrid' ? 'bg-blue-600 text-white shadow' : 'hover:text-white hover:bg-slate-800'
          }`}
        >
          <span>Satélite</span>
        </button>
        <button
          onClick={() => setBasemap('osm')}
          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
            basemap === 'osm' ? 'bg-blue-600 text-white shadow' : 'hover:text-white hover:bg-slate-800'
          }`}
        >
          <span>OpenSource</span>
        </button>
        <button
          onClick={() => setBasemap('dark')}
          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
            basemap === 'dark' ? 'bg-blue-600 text-white shadow' : 'hover:text-white hover:bg-slate-800'
          }`}
        >
          <span>Oscuro</span>
        </button>
      </div>
      
      {/* Follow mode indicator/button */}
      {!isFollowing && (
        <button 
          onClick={() => setIsFollowing(true)}
          className="absolute bottom-6 right-6 z-[400] bg-blue-600 text-white p-3 rounded-full shadow-lg border border-white/20 animate-bounce pointer-events-auto"
        >
          🎯 Centrar
        </button>
      )}
    </div>
  );
};
