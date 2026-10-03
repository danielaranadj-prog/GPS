import React, { useState } from 'react';
import { X, Eye, EyeOff, Trash2 } from 'lucide-react';
import type { RouteItem } from '../types';

interface RouteManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes: RouteItem[];
  visibleRouteIds: string[];
  setVisibleRouteIds: (ids: string[]) => void;
  onDeleteRoutes: (ids: string[]) => Promise<void>;
}

export const RouteManagerModal: React.FC<RouteManagerModalProps> = ({
  isOpen,
  onClose,
  routes,
  visibleRouteIds,
  setVisibleRouteIds,
  onDeleteRoutes,
}) => {
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const toggleVisibility = (id: string) => {
    if (visibleRouteIds.includes(id)) {
      setVisibleRouteIds(visibleRouteIds.filter(v => v !== id));
    } else {
      setVisibleRouteIds([...visibleRouteIds, id]);
    }
  };

  const toggleSelectAllVisibility = () => {
    if (visibleRouteIds.length === routes.length) {
      setVisibleRouteIds([]);
    } else {
      setVisibleRouteIds(routes.map(r => r.id));
    }
  };

  const toggleForDeletion = (id: string) => {
    const newSet = new Set(selectedForDeletion);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedForDeletion(newSet);
  };

  const handleDelete = async () => {
    if (selectedForDeletion.size === 0) return;
    if (window.confirm(`¿Seguro que deseas eliminar las ${selectedForDeletion.size} rutas seleccionadas? Esto no se puede deshacer.`)) {
      await onDeleteRoutes(Array.from(selectedForDeletion));
      setSelectedForDeletion(new Set());
    }
  };

  return (
    <div className="w-full md:w-80 bg-slate-900/95 backdrop-blur-md border-r border-slate-800 flex flex-col z-[600] shadow-2xl relative shrink-0">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Gestor de Rutas Multicapa
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex justify-between items-center mb-4">
             <button onClick={toggleSelectAllVisibility} className="text-xs font-semibold text-blue-400 hover:text-blue-300">
               {visibleRouteIds.length === routes.length ? 'Ocultar Todas' : 'Mostrar Todas'}
             </button>
             <span className="text-xs text-slate-400">Total: {routes.length}</span>
          </div>

          {routes.map(route => {
            const isVisible = visibleRouteIds.includes(route.id);
            const isSelectedForDeletion = selectedForDeletion.has(route.id);
            return (
              <div key={route.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    checked={isSelectedForDeletion}
                    onChange={() => toggleForDeletion(route.id)}
                    className="w-4 h-4 rounded border-slate-600 text-rose-500 focus:ring-rose-500 bg-slate-900"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-200">
                      {route.name} {route.status === 'coming_soon' && <span className="text-xs text-slate-500 font-normal ml-1">(Próximamente)</span>}
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => toggleVisibility(route.id)}
                  className={`p-2 rounded-lg transition-all ${isVisible ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-500 hover:text-slate-300'}`}
                  title={isVisible ? 'Ocultar del mapa' : 'Mostrar en el mapa'}
                >
                  {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
          <button
            onClick={handleDelete}
            disabled={selectedForDeletion.size === 0}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center gap-2 transition-all shadow-md shadow-rose-900/20"
          >
            <Trash2 className="w-4 h-4" />
            <span>Eliminar Seleccionadas ({selectedForDeletion.size})</span>
          </button>
          
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm transition-all"
          >
            Cerrar
          </button>
        </div>

      </div>
  );
};
