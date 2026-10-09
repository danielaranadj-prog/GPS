import React, { useRef, useEffect } from 'react';
import { Trash2, MapPin, Download, UploadCloud, Lock, Unlock, Edit2 } from 'lucide-react';
import type { Stop, StopType } from '../types';
import { db } from '../db';

interface StopsManagerProps {
  stops: Stop[];
  selectedStopId?: string | null;
  onDeleteStop: (id: string) => Promise<void>;
  onUpdateStop: (id: string, updates: Partial<Stop>) => Promise<void>;
}

export const StopsManager: React.FC<StopsManagerProps> = ({
  stops,
  selectedStopId,
  onDeleteStop,
  onUpdateStop,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedStopId && scrollContainerRef.current) {
      const el = document.getElementById(`stop-row-${selectedStopId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedStopId]);

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(stops, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `stops_export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          const confirmOverwrite = window.confirm('¿Deseas sobreescribir las paradas actuales?');
          if (confirmOverwrite) {
            await db.stops.clear();
            await db.stops.bulkPut(parsed);
            alert(`¡Se importaron ${parsed.length} paradas!`);
          }
        } else if (parsed.stops && Array.isArray(parsed.stops)) {
          const confirmOverwrite = window.confirm('¿Deseas sobreescribir las paradas actuales?');
          if (confirmOverwrite) {
            await db.stops.clear();
            await db.stops.bulkPut(parsed.stops);
            alert(`¡Se importaron ${parsed.stops.length} paradas!`);
          }
        }
      } catch (err) {
        console.error(err);
        alert('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleLock = (stop: Stop) => {
    onUpdateStop(stop.id, { isLocked: !stop.isLocked });
  };

  const handleDelete = (stop: Stop) => {
    if (stop.isLocked) {
      alert('Esta parada está bloqueada. Desbloquéala para eliminarla.');
      return;
    }
    if (window.confirm(`¿Seguro que deseas eliminar la parada "${stop.name}"?`)) {
      onDeleteStop(stop.id);
    }
  };

  const cycleType = (stop: Stop) => {
    if (stop.isLocked) {
      alert('Esta parada está bloqueada.');
      return;
    }
    const types: StopType[] = ['oficial', 'costumbre', 'base'];
    const nextType = types[(types.indexOf(stop.type) + 1) % types.length];
    onUpdateStop(stop.id, { type: nextType });
  };

  const editName = (stop: Stop) => {
    if (stop.isLocked) {
      alert('Esta parada está bloqueada.');
      return;
    }
    const newName = window.prompt('Editar nombre de la parada:', stop.name);
    if (newName !== null && newName.trim() !== '') {
      onUpdateStop(stop.id, { name: newName.trim() });
    }
  };

  return (
    <aside className="w-full h-[50%] md:h-full md:w-96 bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 flex flex-col z-40 shadow-2xl text-slate-800 dark:text-slate-100 overflow-hidden">
      <div className="p-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-500" />
          <h3 className="font-bold text-sm">Gestor de Paradas ({stops.length})</h3>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleExport}
            className="p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
            title="Exportar Paradas (JSON)"
          >
            <Download className="w-4 h-4" />
          </button>
          <label className="p-1.5 cursor-pointer text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors" title="Importar Paradas (Sobreescribir)">
            <UploadCloud className="w-4 h-4" />
            <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleImport} />
          </label>
        </div>
      </div>
      
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2 pb-safe">
        {stops.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-500">
            <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm font-semibold">No hay paradas registradas.</p>
            <p className="text-xs mt-1">Haz click en el mapa para agregar paradas en este modo.</p>
          </div>
        ) : (
          stops.map(stop => {
            const isSelected = stop.id === selectedStopId;
            return (
              <div 
                id={`stop-row-${stop.id}`}
                key={stop.id} 
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md ring-2 ring-blue-500/20' 
                    : stop.isLocked 
                      ? 'border-amber-200 bg-amber-50/30 dark:bg-amber-900/10' 
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-xs font-bold truncate flex items-center gap-1.5">
                    {stop.isLocked && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                    <span 
                      onClick={() => editName(stop)}
                      className={`cursor-pointer ${stop.isLocked ? '' : 'hover:text-blue-500 hover:underline'}`}
                      title={stop.isLocked ? 'Desbloquea para editar' : 'Click para editar nombre'}
                    >
                      {stop.name}
                    </span>
                    {!stop.isLocked && (
                      <button onClick={() => editName(stop)} className="text-slate-400 hover:text-blue-500 ml-1">
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <button 
                      onClick={() => cycleType(stop)}
                      title={stop.isLocked ? 'Desbloquea para cambiar tipo' : 'Click para cambiar (oficial, costumbre, base)'}
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border transition-colors ${
                        stop.type === 'oficial' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' :
                        stop.type === 'base' ? 'bg-purple-100 text-purple-600 border-purple-200' :
                        'bg-amber-100 text-amber-600 border-amber-200'
                      }`}
                    >
                      {stop.type}
                    </button>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {stop.coordinates.lat.toFixed(4)}, {stop.coordinates.lng.toFixed(4)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    onClick={() => toggleLock(stop)}
                    className={`p-2 rounded-lg transition-colors ${stop.isLocked ? 'text-amber-500 hover:bg-amber-100' : 'text-slate-400 hover:bg-slate-200'}`}
                    title={stop.isLocked ? "Desbloquear" : "Bloquear para proteger"}
                  >
                    {stop.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => handleDelete(stop)}
                    disabled={stop.isLocked}
                    className="p-2 rounded-lg text-slate-400 hover:bg-rose-100 hover:text-rose-500 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                    title="Eliminar Parada"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      
      <div className="p-3 bg-blue-50/50 border-t border-blue-100 text-[11px] text-blue-600 font-medium">
        Modo exclusivo: Toca una parada en el mapa para seleccionarla. Haz click en su nombre o tipo para editar.
      </div>
    </aside>
  );
};
