"use client";

import type { Station } from "@/lib/types";
import { rates } from "@/lib/data";
import { sanitizeString } from "@/lib/sanitize";
import { useTimer } from "@/hooks/useTimer";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Monitor, Gamepad2, User } from "lucide-react";

type PCCardProps = {
  machine: Station;
  onAction: (station: Station) => void;
};

export default function PCCard({ machine: station, onAction }: PCCardProps) {
  const { session, status, type, name } = station;
  const rate = rates.find(r => r.id === (session?.rateId || station.rateId));
  const prepaidSeconds = session?.usageMode === 'prepaid' ? (session.prepaidHours || 0) * 3600 : undefined;
  
  const { elapsedSeconds, remainingSeconds } = useTimer(session?.startTime, prepaidSeconds);

  const isPrepaid = session?.usageMode === 'prepaid';
  const timeIsUp = isPrepaid && remainingSeconds !== undefined && remainingSeconds <= 0;
  const timeToShow = isPrepaid ? (timeIsUp ? elapsedSeconds - prepaidSeconds! : remainingSeconds!) : elapsedSeconds;
  const isWarning = remainingSeconds !== undefined && remainingSeconds > 0 && remainingSeconds <= 300;

  // 1. Lógica de Colores de Estado (Glow Effect - True Dark Mode)
  const stateStyle = {
    available: "border-zinc-800 bg-zinc-950 hover:border-zinc-700 text-zinc-500 hover:text-zinc-400",
    occupied: "border-emerald-500/40 bg-zinc-900/90 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:border-emerald-500",
    warning: "border-amber-500 bg-zinc-900/90 text-amber-400 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.2)]",
    maintenance: "border-zinc-800/80 bg-zinc-950/40 opacity-40 cursor-not-allowed text-zinc-600",
  }[status === 'maintenance' ? 'maintenance' : (isWarning ? 'warning' : status)];

  // LED indicador de estado
  const ledColor = {
    available: "bg-zinc-700",
    occupied: "bg-emerald-500 animate-pulse",
    warning: "bg-amber-500 animate-pulse",
    maintenance: "bg-red-500",
  }[status === 'maintenance' ? 'maintenance' : (isWarning ? 'warning' : status)];

  const isPC = type === 'PC' || !type;

  return (
    <div
      tabIndex={0}
      className={cn(
        "aspect-square flex flex-col justify-between p-3 rounded-xl border transition-all duration-200 select-none cursor-pointer overflow-hidden font-body focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none",
        stateStyle
      )}
      onClick={() => status !== "maintenance" && onAction(station)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && status !== "maintenance") {
          onAction(station);
        }
      }}
    >
      {/* Cabecera (Top) */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-1.5">
          {isPC ? <Monitor size={14} /> : <Gamepad2 size={14} />}
          <span className="text-xs md:text-sm font-bold tracking-wide text-zinc-200">{name}</span>
        </div>
        <div className={cn("w-2 h-2 rounded-full", ledColor)} />
      </div>

      {/* Centro (Middle) */}
      <div className="flex flex-1 flex-col items-center justify-center">
        {status === 'occupied' || status === 'warning' ? (
          <span className="text-xl md:text-2xl font-black font-mono tracking-tighter leading-none text-slate-100">
            {formatTime(Math.floor(timeToShow))}
          </span>
        ) : status === 'maintenance' ? (
          <span className="text-[10px] md:text-xs font-bold tracking-wider uppercase text-zinc-600">OFF</span>
        ) : (
          <span className="text-[11px] md:text-xs font-black tracking-wider text-zinc-600">LIBRE</span>
        )}
      </div>

      {/* Pie (Bottom) */}
      <div className="w-full bg-zinc-900/60 border border-zinc-800/40 rounded-lg px-2 py-1 flex items-center gap-1.5 mt-1">
        <User size={12} className="text-zinc-500 flex-shrink-0" />
        <span className="text-[10px] md:text-xs text-zinc-400 truncate font-medium">
          {status === 'occupied' || status === 'warning' 
            ? (sanitizeString(session?.client) || 'Invitado') 
            : '---'}
        </span>
      </div>
    </div>
  );
}