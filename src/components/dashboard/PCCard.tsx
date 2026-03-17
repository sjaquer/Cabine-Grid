"use client";

import type { Machine } from "@/lib/types";
import { rates } from "@/lib/data";
import { useTimer } from "@/hooks/useTimer";
import { formatTime, formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Computer, Clock, DollarSign, User, Zap } from "lucide-react";

type PCCardProps = {
  machine: Machine;
  onFinishSession: (machine: Machine) => void;
};

const statusColors = {
  available: "border-status-available/50 hover:border-status-available",
  occupied: "border-status-occupied/50 hover:border-status-occupied",
  warning: "border-status-warning/50 hover:border-status-warning",
};

const statusBg = {
  available: "bg-status-available",
  occupied: "bg-status-occupied",
  warning: "bg-status-warning",
};

export default function PCCard({ machine, onFinishSession }: PCCardProps) {
  const { session, status } = machine;
  const rate = rates.find(r => r.id === session?.rateId);
  const prepaidSeconds = session?.usageMode === 'prepaid' ? (session.prepaidHours || 0) * 3600 : undefined;
  
  const { elapsedSeconds, remainingSeconds } = useTimer(session?.startTime, prepaidSeconds);

  const isPrepaid = session?.usageMode === 'prepaid';

  return (
    <Card className={cn(
      "flex flex-col transition-all duration-300",
      statusColors[status],
      "bg-card shadow-md"
    )}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-headline font-bold">{machine.name}</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{rate?.name ?? rates.find(r => r.id === machine.rateId)?.name}</span>
          <span className={cn("h-3 w-3 rounded-full", statusBg[status])}></span>
        </div>
      </CardHeader>
      
      {status === 'available' ? (
        <CardContent className="flex-1 flex flex-col items-center justify-center text-center gap-2">
            <Computer className="w-16 h-16 text-status-available/60" />
            <p className="text-2xl font-bold text-status-available">Libre</p>
        </CardContent>
      ) : (
        <CardContent className="flex-1 flex flex-col justify-center gap-3 pt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4 text-accent"/>
            <span className="font-semibold truncate">{session?.client}</span>
          </div>
          <div className="text-center">
            <div className="text-xs font-semibold text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="w-3 h-3"/>
              <span>{isPrepaid ? "Tiempo Restante" : "Tiempo Transcurrido"}</span>
            </div>
            <p className={cn(
                "text-3xl font-bold font-mono tracking-tighter",
                status === 'warning' && 'text-status-warning animate-pulse'
              )}>
              {formatTime(isPrepaid ? remainingSeconds! : elapsedSeconds)}
            </p>
          </div>
        </CardContent>
      )}

      <CardFooter className="pt-4">
        {status !== 'available' ? (
          <Button className="w-full font-bold" size="sm" onClick={() => onFinishSession(machine)}>
            <DollarSign className="w-4 h-4 mr-2" />
            Finalizar y Cobrar
          </Button>
        ) : (
          <Button variant="outline" className="w-full font-bold" size="sm" disabled>
             <Zap className="w-4 h-4 mr-2" />
             Asignar
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
