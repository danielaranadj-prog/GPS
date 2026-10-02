import React, { useState } from 'react';
import { PlusCircle, GitFork, X } from 'lucide-react';
import type { RouteCategory } from '../types';

interface NewRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'new' | 'variant';
  initialRouteName?: string;
  onCreateRoute: (name: string, code: string, category: RouteCategory) => void;
  onSaveVariant: (variantName: string) => void;
}

export const NewRouteModal: React.FC<NewRouteModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialRouteName = '',
  onCreateRoute,
  onSaveVariant,
}) => {
  const [name, setName] = useState(
    mode === 'variant' ? `${initialRouteName} (Ramal Cantera)` : ''
  );
  const [code, setCode] = useState(mode === 'variant' ? 'RAMAL-1' : 'XAL-01');
  const [category, setCategory] = useState<RouteCategory>(mode === 'variant' ? 'ramal' : 'xalisco');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (mode === 'variant') {
      onSaveVariant(name.trim());
    } else {
      onCreateRoute(name.trim(), code.trim() || 'R-NUEVA', category);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[700] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-5 shadow-2xl text-slate-100">
        
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            {mode === 'variant' ? (
              <GitFork className="w-5 h-5 text-pink-400" />
            ) : (
              <PlusCircle className="w-5 h-5 text-blue-400" />
            )}
            <h3 className="font-bold text-base text-white">
              {mode === 'variant' ? 'Guardar como Ramal / Variante' : 'Crear Nueva Ruta (ej. Xalisco)'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nombre de la Ruta / Ramal
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Xalisco - Prepa 2 - Villas de San Cayetano"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {mode === 'new' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Código (ej. XAL-01)
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="R-40"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Categoría
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RouteCategory)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="xalisco">Xalisco</option>
                  <option value="troncal">Troncal</option>
                  <option value="alimentadora">Alimentadora</option>
                  <option value="suburbana">Suburbana</option>
                  <option value="ramal">Ramal / Variante</option>
                </select>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all active:scale-95"
            >
              {mode === 'variant' ? 'Guardar Ramal' : 'Crear Ruta'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
