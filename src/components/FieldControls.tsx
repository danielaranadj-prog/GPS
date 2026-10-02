import React, { useState } from 'react';
import {
  MapPin,
  Radio,
  Square,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  Loader2
} from 'lucide-react';
import type { StopType, Coordinates, Stop } from '../types';

interface FieldControlsProps {
  currentPosition: Coordinates & { accuracy: number };
  onMarkStop: (type: StopType) => Promise<Stop | null>;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  recordedPointsCount: number;
  recordedDistanceMeters: number;
  lastMarkedStop: Stop | null;
  onUndoLastStop?: () => void;
}

export const FieldControls: React.FC<FieldControlsProps> = ({
  currentPosition,
  onMarkStop,
  isRecording,
  onStartRecording,
  onStopRecording,
  recordedPointsCount,
  recordedDistanceMeters,
  lastMarkedStop,
  onUndoLastStop,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<StopType>('costumbre');
  const [isMarking, setIsMarking] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleMark = async () => {
    if (isMarking) return;
    setIsMarking(true);
    try {
      await onMarkStop(selectedCategory);
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 2000);
    } finally {
      setIsMarking(false);
    }
  };

  const formattedDistance =
    recordedDistanceMeters >= 1000
      ? `${(recordedDistanceMeters / 1000).toFixed(2)} km`
      : `${recordedDistanceMeters} m`;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[500] p-3 md:p-4 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none pb-[calc(env(safe-area-inset-bottom,16px)+12px)]">
      <div className="max-w-md mx-auto pointer-events-auto flex flex-col gap-2.5">
        
        {/* Undo notification banner if recently marked */}
        {showFeedback && lastMarkedStop && (
          <div className="flex items-center justify-between bg-emerald-950/95 border border-emerald-500/50 text-emerald-200 px-3 py-2 rounded-2xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2 overflow-hidden">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-xs truncate">
                <span className="font-bold text-white">#{lastMarkedStop.sequence}</span> {lastMarkedStop.name}
              </div>
            </div>
            {onUndoLastStop && (
              <button
                onClick={onUndoLastStop}
                className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-white bg-emerald-900/60 hover:bg-emerald-800 px-2 py-1 rounded-lg transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                Deshacer
              </button>
            )}
          </div>
        )}

        {/* 1-Tap Category Selector */}
        <div className="grid grid-cols-3 gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 shadow-xl">
          {/* Oficial */}
          <button
            onClick={() => setSelectedCategory('oficial')}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
              selectedCategory === 'oficial'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 scale-[1.02]'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span>Oficial</span>
            </div>
            <span className="text-[9px] opacity-75 font-normal">Caseta / Poste</span>
          </button>

          {/* Costumbre */}
          <button
            onClick={() => setSelectedCategory('costumbre')}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
              selectedCategory === 'costumbre'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30 scale-[1.02]'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span>Costumbre</span>
            </div>
            <span className="text-[9px] opacity-75 font-normal">Esquina común</span>
          </button>

          {/* Base */}
          <button
            onClick={() => setSelectedCategory('base')}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
              selectedCategory === 'base'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-[1.02]'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
              <span>Base</span>
            </div>
            <span className="text-[9px] opacity-75 font-normal">Terminal / Fin</span>
          </button>
        </div>

        {/* Action Buttons: Giant High-Impact Thumb Mark + GPS Recording */}
        <div className="flex items-stretch gap-2.5">
          
          {/* Continuous Recording Toggle */}
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            className={`px-4 py-3.5 rounded-2xl flex flex-col items-center justify-center border font-bold text-xs transition-all active:scale-95 shadow-xl shrink-0 ${
              isRecording
                ? 'bg-rose-600/20 text-rose-300 border-rose-500/60 shadow-rose-950/40'
                : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              {isRecording ? (
                <>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                  </span>
                  <Square className="w-4 h-4 text-rose-400 fill-current" />
                </>
              ) : (
                <Radio className="w-4 h-4 text-rose-500" />
              )}
            </div>
            <span className="leading-tight text-[11px] whitespace-nowrap">
              {isRecording ? 'Detener' : 'Grabar GPS'}
            </span>
            {isRecording && (
              <span className="text-[9px] font-mono text-rose-300/80 mt-0.5">
                {recordedPointsCount} pts · {formattedDistance}
              </span>
            )}
          </button>

          {/* Giant Thumb Button: Marcar Parada Aquí */}
          <button
            onClick={handleMark}
            disabled={isMarking}
            className={`flex-1 py-4 px-4 rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-2.5 text-white transition-all transform active:scale-95 shadow-2xl relative overflow-hidden select-none ${
              selectedCategory === 'oficial'
                ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 shadow-emerald-900/50 hover:from-emerald-500 hover:to-teal-500'
                : selectedCategory === 'costumbre'
                ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 shadow-amber-900/50 hover:from-amber-500 hover:to-orange-500'
                : 'bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 shadow-purple-900/50 hover:from-purple-500 hover:to-indigo-500'
            }`}
          >
            {isMarking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Geocodificando cruce...</span>
              </>
            ) : (
              <>
                <MapPin className="w-5 h-5 fill-white/20" />
                <span className="tracking-wide uppercase">📍 Marcar Parada Aquí</span>
                <Sparkles className="w-4 h-4 opacity-75 hidden sm:inline" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
