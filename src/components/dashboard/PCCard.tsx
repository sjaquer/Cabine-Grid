"use client";

import type { Station } from "@/lib/types";
import { rates } from "@/lib/data";
import { sanitizeString } from "@/lib/sanitize";
import { useTimer } from "@/hooks/useTimer";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Monitor, Gamepad2, User, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type PCCardProps = {
  machine: Station;
  onAction: (station: Station) => void;
  onMove?: (station: Station) => void;
};

export default function PCCard({ machine: station, onAction, onMove }: PCCardProps) {
  const { session, status, type, name } = station;
  const rate = rates.find(r => r.id === (session?.rateId || station.rateId));
  const prepaidSeconds = session?.usageMode === 'prepaid' ? (session.prepaidHours || 0) * 3600 : undefined;
  
  const { elapsedSeconds, remainingSeconds } = useTimer(session?.startTime, prepaidSeconds);

  const isPrepaid = session?.usageMode === 'prepaid';
  const timeIsUp = isPrepaid && remainingSeconds !== undefined && remainingSeconds <= 0;
  const timeToShow = isPrepaid ? (timeIsUp ? elapsedSeconds - prepaidSeconds! : remainingSeconds!) : elapsedSeconds;
  const isWarning = remainingSeconds !== undefined && remainingSeconds > 0 && remainingSeconds <= 300;
  const visualState = status === "maintenance" ? "maintenance" : isWarning ? "warning" : status;

  const stateStyle = {
    available: "border-border bg-card/70 hover:border-border/90",
    occupied: "border-2 border-success/50 bg-card/85 shadow-[0_0_14px_hsl(var(--success)/0.12)]",
    warning: "border-2 border-status-warning/70 bg-card/85 shadow-[0_0_14px_hsl(var(--status-warning)/0.15)]",
    maintenance: "border-border/50 bg-muted/30 opacity-60 cursor-not-allowed",
  }[visualState];

  const stateRail = {
    available: "bg-transparent",
    occupied: "bg-success",
    warning: "bg-status-warning",
    maintenance: "bg-destructive",
  }[visualState];

  const ledColor = {
    available: "bg-muted-foreground/60",
    occupied: "bg-success animate-pulse-glow",
    warning: "bg-status-warning animate-pulse",
    maintenance: "bg-destructive",
  }[visualState];

  const isPC = type === 'PC' || !type;

  return (
    <div
      tabIndex={0}
      title={`${name} - ${status === 'occupied' || status === 'warning' ? sanitizeString(session?.client) || 'Invitado' : 'Sin sesión'} - ${status === 'occupied' || status === 'warning' ? formatTime(Math.floor(timeToShow)) : 'Sin tiempo activo'} - ${rate?.name || 'Tarifa estándar'}`}
      className={cn(
        "relative aspect-[4/3] md:aspect-auto md:min-h-[140px] flex flex-col justify-between p-3.5 sm:p-4 rounded-xl transition-all duration-200 select-none cursor-pointer overflow-hidden font-body focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        stateStyle
      )}
      onClick={() => status !== "maintenance" && onAction(station)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && status !== "maintenance") {
          onAction(station);
        }
      }}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", stateRail)} aria-hidden="true" />

      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 pl-1">
          {isPC ? <Monitor size={16} /> : <Gamepad2 size={16} />}
          <span className="text-sm font-bold tracking-normal text-foreground">{name}</span>
        </div>
        <div className={cn("h-2.5 w-2.5 rounded-full", ledColor)} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        {status === 'occupied' || status === 'warning' ? (
          <span className="text-2xl md:text-3xl font-black font-mono tracking-tight leading-none text-foreground">
            {formatTime(Math.floor(timeToShow))}
          </span>
        ) : status === 'maintenance' ? (
          <span className="text-xs font-bold tracking-wide uppercase text-muted-foreground">OFF</span>
        ) : (
          <span className="text-xs font-black tracking-wide text-muted-foreground">LIBRE</span>
        )}
      </div>

      <div className="mt-1 flex w-full items-center gap-1.5 rounded-lg border border-border/50 bg-secondary/40 px-2.5 py-1.5">
        <User size={13} className="flex-shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium text-muted-foreground">
          {status === 'occupied' || status === 'warning' 
            ? (sanitizeString(session?.client) || 'Invitado') 
            : '---'}
        </span>
      </div>

      {(status === 'occupied' || status === 'warning') && onMove && (
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs md:px-3"
            onClick={(e) => {
              e.stopPropagation();
              onMove(station);
            }}
            aria-label={`Mover sesión de ${name}`}
          >
            <ArrowLeftRight className="mr-0 h-3.5 w-3.5 md:mr-1" />
            <span className="hidden md:inline">Mover</span>
          </Button>
        </div>
      )}
    </div>
  );
}