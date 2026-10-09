import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  X,
  FileJson,
  Upload,
  Code,
  FileDown,
  Share2
} from 'lucide-react';
import type { Stop, RouteItem, ExportStopsFile } from '../types';
import { db } from '../db';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allStops: Stop[];
  allRoutes: RouteItem[];
  selectedRouteId?: string | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  allStops,
  allRoutes,
  selectedRouteId,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'stops' | 'routes'>('stops');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [exportOnlySelected, setExportOnlySelected] = useState(true);

  if (!isOpen) return null;

  const stopsToExport = selectedRouteId && exportOnlySelected
    ? allStops.filter(s => s.routeIds?.includes(selectedRouteId))
    : allStops;

  const routesToExport = selectedRouteId && exportOnlySelected
    ? allRoutes.filter(r => r.id === selectedRouteId)
    : allRoutes;

  // Generate official stops.json format
  const exportStopsData: ExportStopsFile = {
    cityId: "tepic",
    exportDate: new Date().toISOString(),
    version: "2026.1",
    stops: stopsToExport.map(s => ({
      id: s.id,
      name: s.name,
      coordinates: {
        lat: Number(s.coordinates.lat.toFixed(6)),
        lng: Number(s.coordinates.lng.toFixed(6)),
      },
      type: s.type,
      routeIds: s.routeIds || [],
      direction: s.direction,
      sequence: s.sequence,
      ...(s.accuracy ? { accuracy: s.accuracy } : {}),
    })),
  };

  const stopsJsonString = JSON.stringify(exportStopsData, null, 2);
  const formattedRoutes = routesToExport.map(r => ({
    id: r.id,
    name: r.name,
    color: r.color,
    groupName: r.notes || 'Rutas Tepic',
    coordinates: r.ida ? r.ida.map(pt => ({ lat: pt[0], lng: pt[1] })) : []
  }));

  const routesJsonString = JSON.stringify({
    routes: formattedRoutes
  }, null, 2);

  const currentJsonString = activeTab === 'stops' ? stopsJsonString : routesJsonString;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentJsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = activeTab === 'stops' ? 'stops.json' : 'routes.json';
    const blob = new Blob([currentJsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  
  const handleShare = async () => {
    const filename = activeTab === 'stops' ? 'stops.json' : 'routes.json';
    const blob = new Blob([currentJsonString], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });
    
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Tepic Transit - ${filename}`,
          text: `Base de datos exportada de ${activeTab}`,
          files: [file]
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      alert('Tu navegador no soporta compartir archivos nativamente. Usa el botón de descargar.');
    }
  };

  const handleDownloadGeoJSON = () => {
    let geojson;
    if (activeTab === 'stops') {
      geojson = {
        type: "FeatureCollection",
        features: stopsToExport.map(s => ({
          type: "Feature",
          properties: { id: s.id, name: s.name, type: s.type, routeIds: s.routeIds },
          geometry: { type: "Point", coordinates: [s.coordinates.lng, s.coordinates.lat] }
        }))
      };
    } else {
      geojson = {
        type: "FeatureCollection",
        features: routesToExport.filter(r => r.ida && r.ida.length > 0).map(r => ({
          type: "Feature",
          properties: { id: r.id, name: r.name, code: r.code, status: r.status || 'active' },
          geometry: { type: "LineString", coordinates: r.ida.map(p => [p[1], p[0]]) }
        }))
      };
    }

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeTab === 'stops' ? 'tepic_stops.geojson' : 'tepic_routes.geojson';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.stops && Array.isArray(parsed.stops)) {
          await db.stops.bulkPut(parsed.stops);
          setImportStatus(`¡Importadas con éxito ${parsed.stops.length} paradas!`);
        } else {
          setImportStatus('Formato no reconocido. Debe contener el arreglo "stops".');
        }
      } catch (err) {
        setImportStatus('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-[700] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <FileJson className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Exportador Oficial Tepic Transit</h3>
              <p className="text-xs text-slate-400">Data estandarizada para la App Móvil del sistema</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-4 pt-3 pb-1 flex items-center justify-between border-b border-slate-800 bg-slate-950/40">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('stops')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'stops'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              stops.json ({stopsToExport.length})
            </button>
            <button
              onClick={() => setActiveTab('routes')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'routes'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              routes.json ({routesToExport.length})
            </button>
          </div>

          <div className="flex items-center gap-4">
            {selectedRouteId && (
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
                <input 
                  type="checkbox" 
                  checked={exportOnlySelected}
                  onChange={(e) => setExportOnlySelected(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800"
                />
                Solo ruta seleccionada
              </label>
            )}

            {/* Import option */}
            <label className="cursor-pointer text-xs text-slate-400 hover:text-blue-300 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>Importar JSON</span>
              <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
            </label>
          </div>
        </div>

        {importStatus && (
          <div className="px-4 py-2 bg-blue-900/40 border-b border-blue-700/50 text-xs text-blue-200">
            {importStatus}
          </div>
        )}

        {/* JSON Code Viewer */}
        <div className="flex-1 p-4 overflow-y-auto bg-slate-950 font-mono text-xs text-slate-300">
          <pre className="whitespace-pre overflow-x-auto leading-relaxed">
            {currentJsonString}
          </pre>
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {activeTab === 'stops' ? `${stopsToExport.length} paradas listas para exportar` : `${routesToExport.length} rutas en sistema`}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 flex items-center justify-center transition-all"
              title="Compartir por WhatsApp/AirDrop"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '¡Copiado!' : 'Copiar JSON'}</span>
            </button>
            
            <button
              onClick={handleDownloadGeoJSON}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-700/30 transition-all active:scale-95"
            >
              <FileDown className="w-4 h-4" />
              <span>GeoJSON</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-700/30 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>JSON App</span>
            </button>

          </div>
        </div>

      </div>
    </div>
  );
};
