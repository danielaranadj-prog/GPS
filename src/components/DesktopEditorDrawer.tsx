import React, { useState } from 'react';
import {
  ListOrdered,
  ChevronUp,
  ChevronDown,
  Trash2,
  Edit2,
  Check,
  X,
  GitMerge,
  GitFork,
  MapPin,
  Sparkles,
  Info
} from 'lucide-react';
import type { Stop, RouteItem, DirectionType, StopType } from '../types';

interface DesktopEditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRoute: RouteItem | null;
  direction: DirectionType;
  stops: Stop[];
  onUpdateStop: (id: string, updates: Partial<Stop>) => Promise<void>;
  onDeleteStop: (id: string) => Promise<void>;
  onReorderStop: (id: string, targetIndex: number) => Promise<void>;
  recordedPointsLength: number;
  onAcceptTrace: () => void;
  onOpenVariantModal: () => void;
}

export const DesktopEditorDrawer: React.FC<DesktopEditorDrawerProps> = ({
  isOpen,
  onClose,
  selectedRoute,
  direction,
  stops,
  onUpdateStop,
  onDeleteStop,
  onReorderStop,
  recordedPointsLength,
  onAcceptTrace,
  onOpenVariantModal,
}) => {
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<StopType>('costumbre');

  if (!isOpen) return null;

  const startEditing = (stop: Stop) => {
    setEditingStopId(stop.id);
    setEditName(stop.name);
    setEditType(stop.type);
  };

  const saveEdit = async (stopId: string) => {
    await onUpdateStop(stopId, {
      name: editName.trim() || 'Parada sin nombre',
      type: editType,
    });
    setEditingStopId(null);
  };

  const cancelEdit = () => {
    setEditingStopId(null);
  };

  return (
    <aside className="w-full md:w-96 bg-slate-900/98 backdrop-blur-xl border-l border-slate-800 flex flex-col h-full z-40 shadow-2xl text-slate-100 overflow-hidden">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListOrdered className="w-5 h-5 text-blue-400" />
          <div>
            <h3 className="font-bold text-sm text-white">Editor de Calidad (QA)</h3>
            <p className="text-[11px] text-slate-400">
              {selectedRoute?.name} ({direction.toUpperCase()})
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Route Merging Panel */}
      <div className="p-3.5 bg-slate-950/70 border-b border-slate-800">
        <div className="flex items-center gap-1.5 mb-2">
          <GitMerge className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Fusión de Trazos GPS
          </h4>
        </div>
        <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
          {recordedPointsLength > 1
            ? `Se han registrado ${recordedPointsLength} puntos en vivo sobre la calle.`
            : 'Graba o simula un recorrido para comparar el trazo de calle contra SEMOVI.'}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onAcceptTrace}
            disabled={recordedPointsLength < 2}
            className="px-2.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-center">Aceptar Trazo 2026</span>
          </button>
          
          <button
            onClick={onOpenVariantModal}
            className="px-2.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-300 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all"
          >
            <GitFork className="w-4 h-4 text-blue-400" />
            <span className="text-center">Guardar como Ramal</span>
          </button>
        </div>
      </div>

      {/* Stops Sequential List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
          <span>Paradas Registradas ({stops.length})</span>
          <span className="text-[10px] text-blue-400">Pines arrastrables en mapa</span>
        </div>

        {stops.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl text-slate-500">
            <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
            <p className="text-sm font-semibold">No hay paradas en este sentido</p>
            <p className="text-xs mt-1">Usa el botón de campo o haz click en el mapa para marcar la primera.</p>
          </div>
        ) : (
          stops.map((stop, index) => {
            const isEditing = editingStopId === stop.id;
            let badgeBg = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
            if (stop.type === 'costumbre') badgeBg = 'bg-amber-500/20 text-amber-400 border-amber-500/40';
            if (stop.type === 'base') badgeBg = 'bg-purple-500/20 text-purple-400 border-purple-500/40';

            return (
              <div
                key={stop.id}
                className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-2.5 shadow-sm hover:border-slate-600 transition-all"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Nombre del cruce..."
                    />
                    <div className="flex items-center gap-1.5">
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as StopType)}
                        className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white"
                      >
                        <option value="oficial">🟢 Oficial</option>
                        <option value="costumbre">🟡 Costumbre</option>
                        <option value="base">🟣 Base</option>
                      </select>
                      <button
                        onClick={() => saveEdit(stop.id)}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 ml-auto"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {/* Sequence Badge */}
                    <div className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-xs text-blue-400 shrink-0">
                      {stop.sequence}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs text-white truncate">
                        {stop.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${badgeBg}`}>
                          {stop.type}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {stop.coordinates.lat.toFixed(4)}, {stop.coordinates.lng.toFixed(4)}
                        </span>
                      </div>
                    </div>

                    {/* Up / Down reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        disabled={index === 0}
                        onClick={() => onReorderStop(stop.id, index - 1)}
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-20"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={index === stops.length - 1}
                        onClick={() => onReorderStop(stop.id, index + 1)}
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-20"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Edit and Delete */}
                    <button
                      onClick={() => startEditing(stop)}
                      className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-300"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteStop(stop.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer tip */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400 flex items-center gap-2">
        <Info className="w-4 h-4 text-blue-400 shrink-0" />
        <span>En el mapa puedes arrastrar cualquier pin directamente a la banqueta deseada.</span>
      </div>
    </aside>
  );
};
