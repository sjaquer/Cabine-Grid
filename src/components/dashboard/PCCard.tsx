"use client";

import type { Machine } from "@/lib/types";
import { rates } from "@/lib/data";
import { sanitizeString } from "@/lib/sanitize";
import { useTimer } from "@/hooks/useTimer";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Computer, Clock, User, PlusCircle, Zap, AlertTriangle, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type PCCardProps = {
  machine: Machine;
  onAction: (machine: Machine) => void;
};

const statusColors = {
  available: "border-status-available/45 hover:border-status-available/80 bg-gradient-to-b from-status-available/5 to-transparent",
  occupied: "border-status-occupied/45 hover:border-status-occupied/80 bg-gradient-to-b from-status-occupied/5 to-transparent",
  warning: "border-status-warning/70 hover:border-status-warning bg-gradient-to-b from-status-warning/15 to-transparent",
  maintenance: "border-muted/45 hover:border-muted/70 bg-gradient-to-b from-muted/5 to-transparent",
};

const statusBg = {
  available: "bg-status-available",
  occupied: "bg-status-occupied",
  warning: "bg-status-warning",
  maintenance: "bg-muted",
};

const statusBadge = {
  available: { label: "Disponible", color: "bg-status-available text-black" },
  occupied: { label: "En Uso", color: "bg-status-occupied text-white" },
  warning: { label: "Alertas", color: "bg-status-warning text-black" },
  maintenance: { label: "Mantenimiento", color: "bg-muted text-foreground" },
};

export default function PCCard({ machine, onAction }: PCCardProps) {
  const { session, status } = machine;
  const rate = rates.find(r => r.id === (session?.rateId || machine.rateId));
  const hourlyRate = session?.hourlyRate || machine.hourlyRate || rate?.pricePerHour || 3.00;
  const prepaidSeconds = session?.usageMode === 'prepaid' ? (session.prepaidHours || 0) * 3600 : undefined;
  
  const { elapsedSeconds, remainingSeconds } = useTimer(session?.startTime, prepaidSeconds);

  const isPrepaid = session?.usageMode === 'prepaid';
  const timeIsUp = isPrepaid && remainingSeconds !== undefined && remainingSeconds <= 0;
  
  const timeToShow = isPrepaid ? (timeIsUp ? elapsedSeconds - prepaidSeconds! : remainingSeconds!) : elapsedSeconds;
  const isWarning = remainingSeconds !== undefined && remainingSeconds > 0 && remainingSeconds <= 300;

  const getStatusIcon = () => {
    switch (status) {
      case 'available':
        return <Computer className="w-12 h-12 text-status-available/80" />;
      case 'occupied':
        return <Zap className="w-12 h-12 text-status-occupied/80 animate-pulse" />;
      case 'warning':
        return <AlertTriangle className="w-12 h-12 text-status-warning/80 animate-bounce" />;
      case 'maintenance':
        return <Wrench className="w-12 h-12 text-muted-foreground/80" />;
    }
  };

  return (
    <Card
      className={cn(
        "group flex min-h-[230px] flex-col overflow-hidden border-2 transition-all duration-300 hover:shadow-xl cursor-pointer",
        statusColors[status]
      )}
      onClick={() => status !== "maintenance" && onAction(machine)}
    >
      <CardHeader className="flex-row items-start justify-between space-y-0 px-3 pb-2.5 pt-3.5">
        <div className="flex flex-col gap-2 flex-1">
          <CardTitle className="text-xl font-headline font-bold tracking-tight">{machine.name}</CardTitle>
          <Badge className={`w-fit px-2.5 py-0.5 text-xs font-semibold ${statusBadge[status].color}`}>
            {statusBadge[status].label}
          </Badge>
        </div>
        <div className="relative flex h-4 w-4">
          {status !== 'available' && (
            <>
              <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", statusBg[status], status === 'warning' && 'animate-ping')}></span>
              <span className={cn("relative inline-flex rounded-full h-4 w-4", statusBg[status])}></span>
            </>
          )}
        </div>
      </CardHeader>
      
      {status === 'available' ? (
        <>
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-3 text-center">
            <div className="scale-90 transition-transform duration-300 group-hover:scale-100">{getStatusIcon()}</div>
            <p className="text-sm font-medium text-muted-foreground">
              {rate?.name || `S/. ${hourlyRate.toFixed(2)}/hr`}
            </p>
            <p className="text-xs text-muted-foreground">Lista para nueva sesion</p>
          </CardContent>
          <CardFooter className="p-3 pt-0">
            <Button 
              variant="default" 
              className="h-10 w-full font-semibold text-sm" 
              size="sm" 
              onClick={(event) => {
                event.stopPropagation();
                onAction(machine);
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> 
              Asignar
            </Button>
          </CardFooter>
        </>
      ) : status === 'maintenance' ? (
        <>
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 py-3 text-center">
            <div className="scale-90">{getStatusIcon()}</div>
            <p className="text-sm font-semibold text-muted-foreground">En Mantenimiento</p>
          </CardContent>
          <CardFooter className="p-3 pt-0">
            <Button 
              variant="outline" 
              className="h-10 w-full text-sm" 
              size="sm" 
              disabled
            >
              No disponible
            </Button>
          </CardFooter>
        </>
      ) : (
        <>
          <CardContent className="flex flex-1 flex-col justify-between gap-3 px-3 py-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4 text-accent"/>
                <span className="truncate font-semibold text-foreground">{sanitizeString(session?.client) || 'Cliente Ocasional'}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-primary"/>
                <span className="flex-1 text-xs text-muted-foreground">
                  {isPrepaid ? (timeIsUp ? "Tiempo Extra" : "Tiempo Restante") : "Tiempo Transcurrido"}
                </span>
              </div>
            </div>

            <div className={cn(
              "rounded-lg bg-secondary/60 p-3 text-center",
              isWarning && "bg-status-warning/20 border border-status-warning/50"
            )}>
              <div className="text-2xl font-mono font-bold leading-none text-primary">
                {formatTime(Math.floor(timeToShow))}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">
                {rate?.name || `S/. ${hourlyRate.toFixed(2)}/hr`}
              </div>
            </div>

            {isWarning && (
              <div className="flex items-center gap-2 rounded-lg border border-status-warning/40 bg-status-warning/15 px-2.5 py-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-status-warning" />
                <span className="text-xs font-semibold text-status-warning">{isPrepaid ? "Prepagado por terminar" : "Tiempo por terminar"}</span>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="p-3 pt-0">
            <Button 
              variant={isWarning ? "destructive" : "secondary"}
              className="h-10 w-full font-semibold text-sm" 
              size="sm" 
              onClick={(event) => {
                event.stopPropagation();
                onAction(machine);
              }}
            >
              Abrir TPV
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
        