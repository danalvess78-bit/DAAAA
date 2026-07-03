import React from "react";
import { ShieldAlert, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  isDanger?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmar",
  isDanger = true
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className={`w-full max-w-md bg-fmb-slate border ${
        isDanger ? "border-red-500/40" : "border-fmb-gold/40"
      } rounded-lg shadow-2xl overflow-hidden font-mono text-left`}>
        {/* Header */}
        <div className={`${
          isDanger ? "bg-red-950/20 border-red-900/30" : "bg-fmb-army/20 border-fmb-army/30"
        } border-b px-4 py-3 flex items-center justify-between`}>
          <div className="flex items-center space-x-2">
            <ShieldAlert className={`w-5 h-5 ${isDanger ? "text-red-400 animate-pulse" : "text-fmb-gold"}`} />
            <span className={`text-[10px] uppercase font-bold tracking-wider ${
              isDanger ? "text-red-400" : "text-fmb-gold"
            }`}>{title}</span>
          </div>
          <button 
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 text-gray-300 text-xs leading-relaxed border-b border-fmb-army/10 bg-fmb-black/40">
          {message}
        </div>

        {/* Footer Actions */}
        <div className="bg-fmb-black/80 px-4 py-3 flex justify-end space-x-2">
          <button
            onClick={onCancel}
            className="bg-fmb-slate hover:bg-fmb-slate/80 text-gray-300 border border-fmb-army/25 px-4 py-2 rounded text-[10px] uppercase font-bold transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`${
              isDanger 
                ? "bg-red-700/95 hover:bg-red-600/95 text-white border-red-500/35" 
                : "bg-fmb-army hover:bg-fmb-olive text-white border-fmb-gold/35"
            } border px-4 py-2 rounded text-[10px] uppercase font-bold transition-all shadow-lg cursor-pointer`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
