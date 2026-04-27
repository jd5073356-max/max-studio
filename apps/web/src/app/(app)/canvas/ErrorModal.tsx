"use client";

import { X } from "lucide-react";

interface NodeInfo {
  label: string;
  status: "green" | "yellow" | "red";
  detail: string;
  error?: string;
}

interface Props {
  node: NodeInfo;
  onClose: () => void;
}

export function ErrorModal({ node, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#131316] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-400" />
            <h2 className="text-sm font-semibold text-[#FAFAFA]">
              {node.label} — Error
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#A1A1AA] transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
          <span className="text-xs font-medium text-red-400">Estado:</span>
          <span className="text-xs text-red-300">{node.detail}</span>
        </div>

        {node.error && (
          <div className="rounded-lg bg-[#1C1C21] p-3">
            <p className="mb-1 text-xs font-medium text-[#A1A1AA]">Detalle del error:</p>
            <pre className="whitespace-pre-wrap break-all font-mono text-xs text-red-300">
              {node.error}
            </pre>
          </div>
        )}

        {!node.error && (
          <p className="text-xs text-[#A1A1AA]">
            El servicio no está respondiendo. Verifica que esté corriendo en el servidor EC2.
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-white/5 px-4 py-2 text-xs font-medium text-[#A1A1AA] transition-colors hover:bg-white/10 hover:text-white"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
