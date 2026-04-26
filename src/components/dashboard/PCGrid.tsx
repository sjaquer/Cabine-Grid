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
          <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 md:gap-3">
            {Array.from({length: 12}).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
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

  const pcStations = stations.filter((s) => s.type === 'PC' || !s.type);
  const consoleStations = stations.filter((s) => ['PS5', 'PS4', 'PS3', 'XBOX', 'NINTENDO'].includes(s.type));
  const experienceStations = stations.filter((s) => ['VR', 'SIMULADOR'].includes(s.type));

  const renderSection = (title: string, icon: string, list: Station[]) => {
    if (list.length === 0) return null;
    
    return (
      <div className="space-y-3 border-b border-border/30 pb-6 last:border-b-0">
        <div className="flex items-center gap-2 px-1">
          <span className="text-xl">{icon}</span>
          <h3 className="text-base font-bold tracking-tight font-headline text-foreground">{title}</h3>
          <span className="text-xs font-mono bg-secondary/70 text-muted-foreground px-1.5 py-0.5 rounded">
            {list.length}
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 md:gap-3">
          {list.map((station) => (
            <PCCard
              key={station.id}
              machine={station}
              onAction={onCardAction}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-6">
      <div className="space-y-6">
        {renderSection("Zona PC Gamer", "🖥️", pcStations)}
        {renderSection("Zona de Consolas", "🎮", consoleStations)}
        {renderSection("Experiencia VR / Simuladores", "🥽", experienceStations)}
      </div>
    </div>
  );
}
