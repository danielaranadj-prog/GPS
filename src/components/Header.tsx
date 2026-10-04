import React from 'react';
import {
  Navigation,
  List,
  Sun,
  SunDim,
  PlusCircle,
  Download,
  Laptop,
  Smartphone,
  Play,
  Square,
  Crosshair
} from 'lucide-react';
import type { RouteItem, DirectionType } from '../types';

interface HeaderProps {
  mappingMode: 'zone' | 'route';
  onToggleMappingMode: (mode: 'zone' | 'route') => void;
  routes: RouteItem[];
  selectedRoute: RouteItem | null;
  selectedRouteId: string;
  onSelectRouteId: (id: string) => void;
  visibleRouteIds: string[];
  onOpenRouteManager: () => void;
  direction: DirectionType;
  onChangeDirection: (dir: DirectionType) => void;
  gpsAccuracy: number;
  hasRealGps: boolean;
  wakeLockActive: boolean;
  onToggleWakeLock: () => void;
  isDesktopMode: boolean;
  onToggleDesktopMode: () => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  onOpenNewRouteModal: () => void;
  onOpenExportModal: () => void;
  onCenterGps: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mappingMode,
  onToggleMappingMode,
  routes,
  selectedRoute,
  selectedRouteId,
  onSelectRouteId,
  visibleRouteIds,
  onOpenRouteManager,
  direction,
  onChangeDirection,
  gpsAccuracy,
  hasRealGps,
  wakeLockActive,
  onToggleWakeLock,
  isDesktopMode,
  onToggleDesktopMode,
  isSimulating,
  onToggleSimulation,
  onOpenNewRouteModal,
  onOpenExportModal,
  onCenterGps,
}) => {
  return (
    
    <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2.5 z-30 shadow-sm select-none absolute top-0 left-0 right-0">
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-between gap-3 relative">
        
        {/* Branding Row */}
        <div className="w-full flex justify-between items-center px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-sm tracking-tight text-slate-800 dark:text-slate-100">
                  PorDóndePasa
                </h1>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                  Studio
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Herramienta oficial de mapeo</p>
            </div>
          </div>

          {/* Utility Actions */}
          <div className="flex items-center gap-1.5">
            <button 
              onClick={onToggleDesktopMode} 
              className={`p-2 transition-colors rounded-full border ${isDesktopMode ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/50 hover:text-blue-600 border-slate-100 dark:border-slate-700'}`}
              title="Abrir editor de paradas"
            >
              <List className="w-4 h-4" />
            </button>
            <button onClick={onOpenExportModal} className="p-2 text-slate-400 hover:text-blue-600 transition-colors bg-slate-50 hover:bg-blue-50 rounded-full border border-slate-100">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top Floating Toggle: Master Mapping Mode */}
        <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200 w-full sm:w-[320px] mx-auto shadow-inner relative z-10">
          <button
            onClick={() => onToggleMappingMode('zone')}
            className={`flex-1 py-1.5 px-3 rounded-full text-[13px] font-bold transition-all ${
              mappingMode === 'zone'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            📍 Zona Libre
          </button>
          <button
            onClick={() => onToggleMappingMode('route')}
            className={`flex-1 py-1.5 px-3 rounded-full text-[13px] font-bold transition-all ${
              mappingMode === 'route'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            🚌 Por Ruta
          </button>
        </div>

        {/* Central Controls (Only visible in Route Mode) */}
        {mappingMode === 'route' && (
          <div className="w-full flex items-center gap-2 max-w-xl">
            <div className="flex-1 min-w-[150px] relative">
              <select
                value={selectedRouteId}
                onChange={(e) => {
                  if (e.target.value === '__NEW__') {
                    onOpenNewRouteModal();
                  } else {
                    onSelectRouteId(e.target.value);
                  }
                }}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
              >
                <option value="">Seleccionar ruta...</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.status === 'coming_soon' ? '(Próximamente)' : ''}
                  </option>
                ))}
              </select>
            </div>

            
          </div>
        )}
      </div>
    </header>

  );
};
