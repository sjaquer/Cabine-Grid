"use client";

import type { Machine } from "@/lib/types";
import { rates } from "@/lib/data";
import { useTimer } from "@/hooks/useTimer";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Computer, Clock, User, PlusCircle, DollarSign } from "lucide-react";

type PCCardProps = {
  machine: Machine;
  onAction: (machine: Machine) => void;
};

const statusColors = {
  available: "border-status-available/30 hover:border-status-available",
  occupied: "border-status-occupied/40 hover:border-status-occupied",
  warning: "border-status-warning/40 hover:border-status-warning animate-pulse",
};

const statusBg = {
  available: "bg-status-available",
  occupied: "bg-status-occupied",
  warning: "bg-status-warning",
};

export default function PCCard({ machine, onAction }: PCCardProps) {
  const { session, status } = machine;
  const rate = rates.find(r => r.id === (session?.rateId || machine.rateId));
  const prepaidSeconds = session?.usageMode === 'prepaid' ? (session.prepaidHours || 0) * 3600 : undefined;
  
  const { elapsedSeconds, remainingSeconds } = useTimer(session?.startTime, prepaidSeconds);

  const isPrepaid = session?.usageMode === 'prepaid';
  const timeIsUp = isPrepaid && remainingSeconds !== undefined && remainingSeconds <= 0;
  
  // If time is up on a prepaid session, show the "extra" time as a positive number
  const timeToShow = isPrepaid ? (timeIsUp ? elapsedSeconds - prepaidSeconds! : remainingSeconds!) : elapsedSeconds;

  return (
    <Card className={cn(
      "flex flex-col transition-all duration-300 bg-card shadow-lg",
      statusColors[status]
    )}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-headline font-bold">{machine.name}</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{rate?.name}</span>
          <div className="relative flex h-3 w-3">
             <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", statusBg[status], status !== 'available' && 'animate-ping')}></span>
             <span className={cn("relative inline-flex rounded-full h-3 w-3", statusBg[status])}></span>
          </div>
        </div>
      </CardHeader>
      
      {status === 'available' ? (
        <>
          <CardContent className="flex-1 flex flex-col items-center justify-center text-center gap-2">
              <Computer className="w-16 h-16 text-status-available/60" />
              <p className="text-xl font-bold text-status-available">Disponible</p>
          </CardContent>
          <CardFooter>
            <Button variant="secondary" className="w-full font-bold" size="sm" onClick={() => onAction(machine)}>
              <PlusCircle /> Asignar PC
            </Button>
          </CardFooter>
        </>
      ) : (
        <>
          <CardContent className="flex-1 flex flex-col justify-center gap-3 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="text-accent"/>
              <span className="font-semibold truncate">{session?.client || 'Cliente Ocasional'}</span>
            </div>
            <div className="text-center">
              <div className="text-xs font-semibold text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="w-3 h-3"/>
                <span>{isPrepaid ? (timeIsUp ? "Tiempo Extra" : "Tiempo Restante") : "Tiempo Transcurrido"}</span>
              </div>
              <p className={cn(
                  "text-3xl font-bold font-mono tracking-tighter",
                  status === 'warning' && 'text-status-warning',
                  timeIsUp && 'text-destructive animate-pulse'
                )}>
                {timeIsUp && '+'}{formatTime(timeToShow)}
              </p>
            </div>
          </CardContent>
          <CardFooter className="pt-4">
            <Button className="w-full font-bold" size="sm" onClick={() => onAction(machine)} variant={status === 'warning' || timeIsUp ? 'destructive' : 'default'}>
              <DollarSign /> Finalizar y Cobrar
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
