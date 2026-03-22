import type { Machine } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";
import PCCard from "./PCCard";
import { AlertCircle } from "lucide-react";

type PCGridProps = {
  machines: Machine[];
  onCardAction: (machine: Machine) => void;
  isLoading: boolean;
};

export default function PCGrid({ machines, onCardAction, isLoading }: PCGridProps) {
  if (isLoading) {
    return (
      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="space-y-4">
          <div className="h-10 bg-background/50 rounded-lg animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4 md:gap-5">
            {Array.from({length: 12}).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
          </div>
        </div>
      </div>
    )
  }

  if (machines.length === 0) {
    return (
      <div className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="max-w-sm text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Sin cabinas disponibles</h3>
          <p className="text-sm text-muted-foreground">
            No hay cabinas configuradas para este local en este momento. Crea nuevas cabinas en el panel de administración.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="space-y-4">
        {/* Encabezado con contador */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Cabinas de Internet</h2>
            <p className="text-sm text-muted-foreground">{machines.length} {machines.length === 1 ? 'cabina' : 'cabinas'} disponibles</p>
          </div>
        </div>
        
        {/* Grid de máquinas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4 md:gap-5">
          {machines.map((machine) => (
            <PCCard
              key={machine.id}
              machine={machine}
              onAction={onCardAction}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
