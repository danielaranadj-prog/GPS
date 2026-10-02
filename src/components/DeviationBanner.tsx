import React from 'react';
import { AlertTriangle, GitFork, Check, X } from 'lucide-react';
import type { DeviationStatus } from '../types';

interface DeviationBannerProps {
  deviationStatus: DeviationStatus;
  routeName: string;
  isDismissed?: boolean;
  onSaveAsVariant: () => void;
  onAcceptTrace: () => void;
  onDismiss: () => void;
  onReopen?: () => void;
}

export const DeviationBanner: React.FC<DeviationBannerProps> = ({
  deviationStatus,
  routeName,
  isDismissed = false,
  onSaveAsVariant,
  onAcceptTrace,
  onDismiss,
  onReopen,
}) => {
  if (!deviationStatus.isDeviated) return null;

  const distanceText =
    deviationStatus.accumulatedDistanceMeters >= 1000
      ? `+${(deviationStatus.accumulatedDistanceMeters / 1000).toFixed(2)} km`
      : `+${deviationStatus.accumulatedDistanceMeters || deviationStatus.currentDistanceMeters}m`;

  // If dismissed, render a small, unobtrusive badge that can be tapped to expand again
  if (isDismissed) {
    return (
      <div className="absolute top-16 right-4 z-[500] animate-in fade-in duration-200">
        <button
          onClick={onReopen}
          title="Toca para ver detalles del desvío detectado"
          className="px-2.5 py-1.5 bg-rose-950/90 border border-rose-500/70 hover:border-rose-400 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-md hover:bg-rose-900 transition-all active:scale-95"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          <span>Desvío ({distanceText})</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-16 left-3 right-3 md:left-auto md:right-4 md:max-w-md z-[600] animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-gradient-to-r from-rose-950/95 via-rose-900/90 to-red-950/95 border-2 border-rose-500/80 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-400 animate-bounce" />
            </div>
            <div>
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-rose-300">
                Alerta de Auditoría SEMOVI
              </h4>
              <p className="font-bold text-sm text-white leading-tight mt-0.5">
                ⚠️ Desvío de ruta detectado ({distanceText} fuera del trazo oficial)
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 text-rose-300 hover:text-white rounded-lg hover:bg-rose-800/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-rose-200/80 mt-2">
          El camión ha cambiado de calle o ingresó a un nuevo sector no registrado en el trazo de {routeName}.
        </p>

        {/* Quick actions for auditor */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-rose-800/60">
          <button
            onClick={onDismiss}
            className="py-1.5 px-3 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 rounded-xl text-xs font-semibold text-rose-300 transition-all active:scale-95"
          >
            Descartar
          </button>
          <button
            onClick={onSaveAsVariant}
            className="flex-1 py-1.5 px-2 bg-rose-500/30 hover:bg-rose-500/50 border border-rose-400/40 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <GitFork className="w-3.5 h-3.5 text-rose-300" />
            <span>Guardar Ramal</span>
          </button>
          <button
            onClick={onAcceptTrace}
            className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Aceptar Trazo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
