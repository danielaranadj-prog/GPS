import React from 'react';
import {
  Navigation,
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
  routes: RouteItem[];
  selectedRoute: RouteItem | null;
  selectedRouteId: string;
  onSelectRouteId: (id: string) => void;
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
  routes,
  selectedRoute,
  selectedRouteId,
  onSelectRouteId,
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
  // GPS accuracy status color
  const accuracyColor =
    gpsAccuracy <= 5
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
      : gpsAccuracy <= 15
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
      : 'bg-rose-500/20 text-rose-400 border-rose-500/40';

  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 px-3 py-2 z-30 shadow-lg select-none">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5">
        
        {/* Top line on mobile: Brand + GPS Chip + WakeLock */}
        <div className="w-full md:w-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center shadow-md shadow-blue-500/30">
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight leading-none text-white flex items-center gap-1.5">
                Tepic Transit <span className="text-[10px] font-semibold uppercase px-1 py-0.5 rounded bg-blue-500/30 text-blue-300 border border-blue-400/30">Studio</span>
              </h1>
              <p className="text-[10px] text-slate-400 leading-tight">Mapeador SEMOVI & Xalisco</p>
            </div>
          </div>

          {/* Quick status chips */}
          <div className="flex items-center gap-1.5">
            {/* GPS Accuracy Chip */}
            <button
              onClick={onCenterGps}
              title="Centrar en ubicación GPS"
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-mono font-semibold border transition-all active:scale-95 ${accuracyColor}`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
              </span>
              <span>GPS ±{gpsAccuracy}m</span>
              <Crosshair className="w-3 h-3 opacity-70" />
            </button>

            {/* Wake Lock indicator */}
            <button
              onClick={onToggleWakeLock}
              title={wakeLockActive ? 'Pantalla siempre activa (Wake Lock ON)' : 'Activar pantalla siempre encendida'}
              className={`p-1.5 rounded-lg border text-xs flex items-center transition-all ${
                wakeLockActive
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              {wakeLockActive ? <Sun className="w-4 h-4" /> : <SunDim className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Central Controls: Route Selector & Direction Pills */}
        <div className="w-full md:w-auto flex-1 flex flex-wrap items-center justify-center md:justify-start gap-2 max-w-xl">
          {/* Route dropdown */}
          <div className="flex-1 min-w-[200px] relative">
            <select
              value={selectedRouteId}
              onChange={(e) => {
                if (e.target.value === '__NEW__') {
                  onOpenNewRouteModal();
                } else {
                  onSelectRouteId(e.target.value);
                }
              }}
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-1.5 text-xs md:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-inner"
            >
              <optgroup label="⭐ Rutas Oficiales SEMOVI Tepic (39)">
                {routes
                  .filter(r => !r.isCustom)
                  .map(r => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.name}
                    </option>
                  ))}
              </optgroup>
              {routes.some(r => r.isCustom) && (
                <optgroup label="🛠️ Rutas y Ramales 2026 (Personalizadas)">
                  {routes
                    .filter(r => r.isCustom)
                    .map(r => (
                      <option key={r.id} value={r.id}>
                        {r.code} - {r.name}
                      </option>
                    ))}
                </optgroup>
              )}
              <option value="__NEW__" className="text-emerald-400 font-bold">
                ➕ + Nueva Ruta (ej. Xalisco)
              </option>
            </select>
          </div>

          {/* Direction 1-tap Pills */}
          <div className="flex bg-slate-800 p-0.5 rounded-xl border border-slate-700/80 shadow-inner">
            <button
              onClick={() => onChangeDirection('ida')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                direction === 'ida'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              [ Ida ]
            </button>
            <button
              onClick={() => onChangeDirection('vuelta')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                direction === 'vuelta'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              [ Vuelta ]
            </button>
          </div>
        </div>

        {/* Right controls: Simulator + Mode Switcher + Export */}
        <div className="w-full md:w-auto flex items-center justify-end gap-2">
          {/* Simulator toggle for Desktop QA */}
          <button
            onClick={onToggleSimulation}
            title={isSimulating ? "Detener simulación de viaje en camión" : "Simular viaje en camión en Tepic (+650m desvío)"}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              isSimulating
                ? 'bg-purple-600/30 text-purple-300 border-purple-500/50 animate-pulse'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            {isSimulating ? <Square className="w-3.5 h-3.5 text-purple-400" /> : <Play className="w-3.5 h-3.5 text-purple-400" />}
            <span className="hidden sm:inline">{isSimulating ? 'Simulando' : 'Simular'}</span>
          </button>

          {/* Desktop / Mobile mode switch */}
          <button
            onClick={onToggleDesktopMode}
            title={isDesktopMode ? "Cambiar a vista de Trabajo de Campo" : "Cambiar a Editor de Escritorio"}
            className={`p-1.5 md:px-2.5 md:py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              isDesktopMode
                ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            {isDesktopMode ? <Laptop className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
            <span className="hidden lg:inline">{isDesktopMode ? 'Editor QA' : 'Campo'}</span>
          </button>

          {/* Export JSON Button */}
          <button
            onClick={onOpenExportModal}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-700/20 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>
        </div>

      </div>
    </header>
  );
};
