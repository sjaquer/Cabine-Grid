"use client";

import type { Station } from "@/lib/types";
import { rates } from "@/lib/data";
import { sanitizeString } from "@/lib/sanitize";
import { useTimer } from "@/hooks/useTimer";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Computer, User, AlertTriangle, Wrench, Gamepad } from "lucide-react";

type PCCardProps = {
  machine: Station;
  onAction: (station: Station) => void;
};

export default function PCCard({ machine: station, onAction }: PCCardProps) {
  const { session, status, type } = station;
  const rate = rates.find(r => r.id === (session?.rateId || station.rateId));
  const hourlyRate = session?.hourlyRate || station.hourlyRate || rate?.pricePerHour || 3.00;
  const prepaidSeconds = session?.usageMode === 'prepaid' ? (session.prepaidHours || 0) * 3600 : undefined;
  
  const { elapsedSeconds, remainingSeconds } = useTimer(session?.startTime, prepaidSeconds);

  const isPrepaid = session?.usageMode === 'prepaid';
  const timeIsUp = isPrepaid && remainingSeconds !== undefined && remainingSeconds <= 0;
  const timeToShow = isPrepaid ? (timeIsUp ? elapsedSeconds - prepaidSeconds! : remainingSeconds!) : elapsedSeconds;
  const isWarning = remainingSeconds !== undefined && remainingSeconds > 0 && remainingSeconds <= 300;

  // 1. Color de acento según tipo de estación (Cyber Premium)
  const typeStyle = {
    PC: "border-blue-500/30 hover:border-blue-400 text-blue-400 bg-blue-950/20 shadow-blue-500/5",
    PS5: "border-cyan-500/30 hover:border-cyan-400 text-cyan-400 bg-cyan-950/20 shadow-cyan-500/5",
    PS4: "border-indigo-500/30 hover:border-indigo-400 text-indigo-400 bg-indigo-950/20 shadow-indigo-500/5",
    PS3: "border-indigo-500/30 hover:border-indigo-400 text-indigo-400 bg-indigo-950/20 shadow-indigo-500/5",
    XBOX: "border-emerald-500/30 hover:border-emerald-400 text-emerald-400 bg-emerald-950/20 shadow-emerald-500/5",
    NINTENDO: "border-rose-500/30 hover:border-rose-400 text-rose-400 bg-rose-950/20 shadow-rose-500/5",
    VR: "border-violet-500/30 hover:border-violet-400 text-violet-400 bg-violet-950/20 shadow-violet-500/5",
    SIMULADOR: "border-amber-500/30 hover:border-amber-400 text-amber-400 bg-amber-950/20 shadow-amber-500/5",
  }[type || 'PC'] || "border-slate-800 text-slate-400 bg-slate-950";

  // 2. Modificador de estado (Efectos Neón)
  const stateStyle = {
    available: "border-dashed opacity-50 hover:opacity-100 hover:border-solid",
    occupied: cn(
      "border-solid border-2 opacity-100",
      type === "PC" && "shadow-[0_0_20px_rgba(59,130,246,0.3)] border-blue-500",
      type === "XBOX" && "shadow-[0_0_20px_rgba(16,185,129,0.3)] border-emerald-500",
      type === "NINTENDO" && "shadow-[0_0_20px_rgba(244,63,94,0.3)] border-rose-500",
      (type === "PS5" || type === "PS4" || type === "PS3") && "shadow-[0_0_20px_rgba(6,182,212,0.3)] border-cyan-500",
      type === "VR" && "shadow-[0_0_20px_rgba(139,92,246,0.3)] border-violet-500",
      type === "SIMULADOR" && "shadow-[0_0_20px_rgba(245,158,11,0.3)] border-amber-500"
    ),
    warning: "border-amber-500 border-2 animate-pulse shadow-[0_0_25px_rgba(245,158,11,0.4)]",
    maintenance: "border-yellow-600 bg-[repeating-linear-gradient(45deg,#ca8a04_0,#ca8a04_10px,#0f172a_10px,#0f172a_20px)] opacity-30 cursor-not-allowed",
  }[isWarning ? 'warning' : status];

  const getStationIcon = () => {
    if (status === 'maintenance') return <Wrench className="w-12 h-12" />;
    if (status === 'warning' || isWarning) return <AlertTriangle className="w-12 h-12 text-amber-500 animate-bounce" />;
    
    if (type === 'PC') return <Computer className="w-14 h-14 text-current" />;
    return <Gamepad className="w-14 h-14 text-current" />;
  };

  return (
    <Card
      className={cn(
        "relative flex aspect-square flex-col items-center justify-between p-4 rounded-2xl border transition-all duration-300 select-none cursor-pointer overflow-hidden font-body",
        typeStyle,
        stateStyle
      )}
      onClick={() => status !== "maintenance" && onAction(station)}
    >
      {/* Alias del jugador arriba */}
      <div className="w-full text-center text-xs font-bold tracking-wide truncate pt-1 flex items-center justify-center gap-1 text-slate-200">
        {status === 'occupied' ? (
          <>
            <User className="w-3 h-3 opacity-70 text-primary" />
            <span className="truncate font-semibold">{sanitizeString(session?.client) || 'Invitado'}</span>
          </>
        ) : status === 'maintenance' ? (
          <span className="text-yellow-500 font-headline">Fuera de Servicio</span>
        ) : (
          <span className="text-slate-400 opacity-80">{station.name}</span>
        )}
      </div>

      {/* Ícono Central Grande */}
      <div className="flex flex-1 items-center justify-center scale-100 group-hover:scale-110 transition-transform duration-300 py-2">
        {getStationIcon()}
      </div>

      {/* Tiempo abajo */}
      <div className="w-full flex flex-col items-center gap-0.5 pb-1">
        {status === 'occupied' ? (
          <>
            <span className="text-lg font-black font-mono text-slate-50 tracking-tight leading-none">
              {formatTime(Math.floor(timeToShow))}
            </span>
            <span className="text-[9px] font-bold tracking-wider uppercase text-slate-400">
              {isPrepaid ? (timeIsUp ? "TIEMPO EXTRA" : "RESTANTE") : "TIEMPO"}
            </span>
          </>
        ) : status === 'available' ? (
          <span className="text-xs font-headline text-slate-400 font-bold uppercase tracking-wider">
            {station.name}
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-yellow-500 uppercase tracking-wide">
            Mantenimiento
          </span>
        )}
      </div>

      {/* Badge de tipo absoluto */}
      <div className="absolute top-2 right-2 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950/50 border border-slate-800 text-muted-foreground">
        {station.type || 'PC'}
      </div>
    </Card>
  );
}