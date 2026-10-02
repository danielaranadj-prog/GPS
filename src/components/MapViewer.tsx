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
  direction: DirectionType;
  stops: Stop[];
  recordedPoints: GpsBreadcrumb[];
  deviationPoints: [number, number][];
  isDesktopMode: boolean;
  onStopDragEnd?: (stopId: string, newCoords: Coordinates) => void;
  onMapClick?: (coords: Coordinates) => void;
  centerTrigger?: number;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  currentPosition,
  selectedRoute,
  direction,
  stops,
  recordedPoints,
  deviationPoints,
  isDesktopMode,
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

  const [basemap, setBasemap] = useState<'dark' | 'voyager' | 'osm'>('dark');

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [currentPosition.lat, currentPosition.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    // Custom zoom control in top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial tile layer (Carto Dark)
    const tileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
      {
        subdomains: 'abcd',
        maxZoom: 20,
      }
    ).addTo(map);
    tileLayerRef.current = tileLayer;

    // Layer group for stops
    const stopsGroup = L.layerGroup().addTo(map);
    stopsLayerGroupRef.current = stopsGroup;
    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Basemap Switch
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    tileLayerRef.current.remove();

    let url = 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png';
    let subdomains = 'abcd';

    if (basemap === 'voyager') {
      url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    } else if (basemap === 'osm') {
      url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      subdomains = 'abc';
    }

    const newLayer = L.tileLayer(url, {
      subdomains,
      maxZoom: 20,
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

  // Render Official SEMOVI Route Line
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (officialLineRef.current) officialLineRef.current.remove();
    if (officialGlowLineRef.current) officialGlowLineRef.current.remove();

    if (!selectedRoute) return;
    const pathCoords = direction === 'ida' ? selectedRoute.ida : selectedRoute.vuelta;
    if (!pathCoords || pathCoords.length < 2) return;

    // Glowing base line
    officialGlowLineRef.current = L.polyline(pathCoords, {
      color: selectedRoute.color || '#3b82f6',
      weight: 9,
      opacity: 0.25,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // Core crisp line
    officialLineRef.current = L.polyline(pathCoords, {
      color: selectedRoute.color || '#3b82f6',
      weight: 4,
      opacity: 0.85,
      dashArray: '8, 8',
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
  }, [selectedRoute, direction]);

  // Render Street Recorded Track
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

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
  }, [recordedPoints]);

  // Render Deviation Track (Alert Red)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

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
  }, [deviationPoints]);

  // Render Stops Markers
  useEffect(() => {
    const stopsGroup = stopsLayerGroupRef.current;
    if (!stopsGroup) return;

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

      const iconHtml = `
        <div class="relative flex items-center justify-center cursor-pointer group">
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
        draggable: isDesktopMode,
        title: `#${stop.sequence} ${stop.name}`,
      });

      // Drag event for desktop sidewalk tuning
      if (isDesktopMode && onStopDragEnd) {
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
          </div>
          <p class="font-bold text-sm text-slate-800 leading-tight">${stop.name}</p>
          <p class="text-[11px] text-slate-500 mt-1">Lat: ${stop.coordinates.lat.toFixed(5)}, Lng: ${stop.coordinates.lng.toFixed(5)}</p>
          ${isDesktopMode ? `<p class="text-[10px] text-blue-600 font-semibold mt-1.5">💡 Arrastra el pin para ajustar sobre la banqueta</p>` : ''}
        </div>
      `;

      marker.bindPopup(popupContent, { className: 'custom-transit-popup' });
      stopsGroup.addLayer(marker);
    });
  }, [stops, isDesktopMode, onStopDragEnd]);

  // Update Live GPS Location Marker & Accuracy Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

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
  }, [currentPosition]);

  // Re-center on centerTrigger change
  useEffect(() => {
    if (!mapInstanceRef.current || centerTrigger === undefined) return;
    mapInstanceRef.current.panTo([currentPosition.lat, currentPosition.lng], {
      animate: true,
      duration: 0.6,
    });
  }, [centerTrigger]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Basemap Selector */}
      <div className="absolute top-4 left-4 z-[400] flex bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1 shadow-2xl text-xs font-semibold text-slate-300">
        <button
          onClick={() => setBasemap('dark')}
          className={`px-2.5 py-1 rounded-lg transition-all ${basemap === 'dark' ? 'bg-blue-600 text-white shadow' : 'hover:text-white'}`}
        >
          Oscuro
        </button>
        <button
          onClick={() => setBasemap('voyager')}
          className={`px-2.5 py-1 rounded-lg transition-all ${basemap === 'voyager' ? 'bg-blue-600 text-white shadow' : 'hover:text-white'}`}
        >
          Carto
        </button>
        <button
          onClick={() => setBasemap('osm')}
          className={`px-2.5 py-1 rounded-lg transition-all ${basemap === 'osm' ? 'bg-blue-600 text-white shadow' : 'hover:text-white'}`}
        >
          OSM
        </button>
      </div>
    </div>
  );
};
