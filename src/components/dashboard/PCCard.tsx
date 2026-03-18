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
  available: "border-status-available/40 hover:border-status-available/80 bg-gradient-to-br from-status-available/5 to-transparent",
  occupied: "border-status-occupied/40 hover:border-status-occupied/80 bg-gradient-to-br from-status-occupied/5 to-transparent",
  warning: "border-status-warning/60 hover:border-status-warning bg-gradient-to-br from-status-warning/10 to-transparent animate-pulse",
  maintenance: "border-muted/40 hover:border-muted/60 bg-gradient-to-br from-muted/5 to-transparent",
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
        "flex flex-col transition-all duration-300 border-2 hover:shadow-xl hover:scale-105 cursor-pointer overflow-hidden",
        statusColors[status]
      )}
      onClick={() => status !== "maintenance" && onAction(machine)}
    >
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3 pt-4 px-4">
        <div className="flex flex-col gap-2 flex-1">
          <CardTitle className="text-lg font-headline font-bold">{machine.name}</CardTitle>
          <Badge className={`w-fit text-xs font-semibold ${statusBadge[status].color}`}>
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
          <CardContent className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-6">
            {getStatusIcon()}
            <p className="text-sm font-medium text-muted-foreground">
              {rate?.name || `S/. ${hourlyRate.toFixed(2)}/hr`}
            </p>
            <p className="text-xs text-muted-foreground">Haz clic para asignar</p>
          </CardContent>
          <CardFooter className="p-3 pt-0">
            <Button 
              variant="default" 
              className="w-full font-semibold" 
              size="sm" 
              onClick={(event) => {
                event.stopPropagation();
                onAction(machine);
              }}
            >
              <PlusCircle className="w-4 h-4 mr-2" /> 
              Asignar
            </Button>
          </CardFooter>
        </>
      ) : status === 'maintenance' ? (
        <>
          <CardContent className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-6">
            {getStatusIcon()}
            <p className="text-sm font-semibold text-muted-foreground">En Mantenimiento</p>
          </CardContent>
          <CardFooter className="p-3 pt-0">
            <Button 
              variant="outline" 
              className="w-full" 
              size="sm" 
              disabled
            >
              No disponible
            </Button>
          </CardFooter>
        </>
      ) : (
        <>
          <CardContent className="flex-1 flex flex-col justify-between gap-3 py-4 px-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="text-accent w-4 h-4"/>
                <span className="font-semibold truncate text-foreground">{sanitizeString(session?.client) || 'Cliente Ocasional'}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Clock className="text-primary w-4 h-4"/>
                <span className="text-xs text-muted-foreground flex-1">
                  {isPrepaid ? (timeIsUp ? "Tiempo Extra" : "Tiempo Restante") : "Tiempo Transcurrido"}
                </span>
              </div>
            </div>

            <div className={cn(
              "bg-secondary/60 rounded-lg p-3 text-center",
              isWarning && "bg-status-warning/20 border border-status-warning/50"
            )}>
              <div className="text-2xl font-mono font-bold text-primary">
                {formatTime(Math.floor(timeToShow))}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {rate?.name || `S/. ${hourlyRate.toFixed(2)}/hr`}
              </div>
            </div>

            {isWarning && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-status-warning/15 border border-status-warning/40">
                <AlertTriangle className="w-4 h-4 text-status-warning flex-shrink-0" />
                <span className="text-xs font-semibold text-status-warning">{isPrepaid ? "Tiempo prepagado por terminar" : "Tiempo por terminar"}</span>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="p-3 pt-0">
            <Button 
              variant={isWarning ? "destructive" : "secondary"}
              className="w-full font-semibold" 
              size="sm" 
              onClick={(event) => {
                event.stopPropagation();
                onAction(machine);
              }}
            >
              {isWarning ? "Abrir TPV" : "Abrir TPV"}
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
        