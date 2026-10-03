import React, { useEffect, useState } from 'react';
import { Activity, Navigation2, Clock, Crosshair } from 'lucide-react';

interface TelemetryHUDProps {
  speed: number | null; // meters per second
  accuracy: number;
  recordedDistance: number;
  isRecording: boolean;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  speed,
  accuracy,
  recordedDistance,
  isRecording,
}) => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setElapsedMs(prev => prev + 1000);
      }, 1000);
    } else {
      setElapsedMs(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const speedKmh = speed ? (speed * 3.6).toFixed(1) : '0.0';
  const distStr = recordedDistance >= 1000 ? `${(recordedDistance / 1000).toFixed(2)} km` : `${Math.round(recordedDistance)} m`;

  const accuracyColor = accuracy <= 10 ? 'text-emerald-400' : accuracy <= 20 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2 pointer-events-none">
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-3 shadow-2xl flex flex-col gap-3 min-w-[140px]">
        
        {/* Speed */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 opacity-70">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Velocidad</span>
          </div>
          <div className="text-right">
            <span className="text-xl font-black text-white leading-none font-mono">{speedKmh}</span>
            <span className="text-[10px] text-slate-400 ml-1">km/h</span>
          </div>
        </div>

        <div className="h-px bg-slate-800/60 w-full" />

        {/* GPS Health */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 opacity-70">
            <Crosshair className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Señal</span>
          </div>
          <div className="text-right">
            <span className={`text-sm font-black leading-none font-mono ${accuracyColor}`}>±{Math.round(accuracy)}</span>
            <span className="text-[10px] text-slate-400 ml-1">m</span>
          </div>
        </div>

        {isRecording && (
          <>
            <div className="h-px bg-slate-800/60 w-full" />
            
            {/* Mission Stats */}
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1"><Navigation2 className="w-3 h-3" /> Dist</span>
                <span className="text-emerald-300 font-bold font-mono">{distStr}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Tmp</span>
                <span className="text-amber-300 font-bold font-mono">{formatTime(elapsedMs)}</span>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};
