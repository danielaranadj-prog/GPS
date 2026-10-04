import React, { useState } from 'react';
import {
  Play,
  MapPin,
  Undo2,
  StopCircle,
  Radio,
  Square,
  CheckCircle2,
  Lock,
  Unlock,
  Clock,
  RotateCcw,
  Sparkles,
  Loader2
} from 'lucide-react';
import type { StopType, Coordinates, Stop } from '../types';

interface FieldControlsProps {
  mappingMode: 'zone' | 'route';
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
  mappingMode,
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

  const handleMark = async () => {
    setIsMarking(true);
    try {
      await onMarkStop(selectedCategory);
      if (navigator.vibrate) {
        navigator.vibrate([150]); // Success haptic feedback
      }
    } finally {
      setIsMarking(false);
    }
  };

  return (
    <>
    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] p-4 pb-8 z-[1000] flex flex-col gap-3 transition-transform">
      {/* Drag Handle */}
      <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2" />

      {!isRecording ? (
        // IDLE STATE
        <button
          onClick={onStartRecording}
          className="w-full py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 text-white transition-all transform active:scale-95 shadow-xl bg-blue-600 hover:bg-blue-700 select-none"
        >
          <Play className="w-6 h-6 fill-white" />
          <span className="tracking-wide">Comenzar a registrar</span>
        </button>
      ) : (
        // ACTIVE CAPTURE STATE
        <>
          {/* Accuracy & Last Stop Header */}
          <div className="flex items-center justify-between px-2 mb-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-slate-600">
                GPS: ±{Math.round(currentPosition.accuracy || 0)}m
              </span>
            </div>
            {lastMarkedStop && (
              <div className="text-[10px] text-slate-400 max-w-[150px] truncate">
                Última: {lastMarkedStop.name}
              </div>
            )}
          </div>

          {/* Giant Thumb Button */}
          <button
            onClick={handleMark}
            disabled={isMarking}
            className="w-full py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 text-white transition-all transform active:scale-95 shadow-xl bg-emerald-600 hover:bg-emerald-700 select-none"
          >
            {isMarking ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <MapPin className="w-6 h-6" />
                <span className="tracking-wide">Registrar parada</span>
              </>
            )}
          </button>

          {/* Action Row */}
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={onUndoLastStop}
              disabled={!lastMarkedStop}
              className={`flex-1 py-3 rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-colors ${
                lastMarkedStop ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Undo2 className="w-4 h-4" />
              Borrar última
            </button>
            <button
              onClick={() => {
                if (window.confirm('¿Seguro que deseas finalizar el mapeo?')) {
                  onStopRecording();
                }
              }}
              className="flex-1 py-3 rounded-xl font-bold text-sm flex justify-center items-center gap-2 bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors"
            >
              <StopCircle className="w-4 h-4" />
              Finalizar
            </button>
          </div>
        </>
      )}
    </div>
    </>
  );
};
