import type { Station } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";
import PCCard from "./PCCard";
import { AlertCircle } from "lucide-react";

type PCGridProps = {
  machines: Station[]; // renamed for component backward compatibility
  onCardAction: (station: Station) => void;
  isLoading: boolean;
};

export default function PCGrid({ machines: stations, onCardAction, isLoading }: PCGridProps) {
  if (isLoading) {
    return (
      <div className="flex-1 p-3 sm:p-4 lg:p-6">
        <div className="space-y-4">
          <div className="h-11 bg-background/50 rounded-lg animate-pulse" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] md:gap-4 xl:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {Array.from({length: 12}).map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  if (stations.length === 0) {
    return (
      <div className="flex-1 p-3 sm:p-4 lg:p-6 flex items-center justify-center">
        <div className="max-w-sm text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Sin estaciones disponibles</h3>
          <p className="text-sm text-muted-foreground">
            No hay estaciones configuradas en este momento. Crea nuevas estaciones en el panel de administración.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-6">
      <div className="space-y-4">
        {/* Encabezado con contador */}
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2">
          <div>
            <h2 className="text-sm font-semibold md:text-base">Disponibles en pantalla</h2>
            <p className="text-xs text-muted-foreground">{stations.length} {stations.length === 1 ? 'estación' : 'estaciones'} en esta vista</p>
          </div>
        </div>
        
        {/* Grid de estaciones */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] md:gap-4 xl:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
          {stations.map((station) => (
            <PCCard
              key={station.id}
              machine={station}
              onAction={onCardAction}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
