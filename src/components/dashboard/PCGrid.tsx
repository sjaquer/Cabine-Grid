import type { Station } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";
import PCCard from "./PCCard";
import { AlertCircle } from "lucide-react";

type PCGridProps = {
  machines: Station[]; // renamed for component backward compatibility
  onCardAction: (station: Station) => void;
  onMoveSession?: (station: Station) => void;
  isLoading: boolean;
};

export default function PCGrid({ machines: stations, onCardAction, onMoveSession, isLoading }: PCGridProps) {
  if (isLoading) {
    return (
      <div className="flex-1 p-3 sm:p-4 lg:p-6">
        <div className="space-y-4">
          <div className="h-11 bg-background/50 rounded-lg animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 w-full pb-10">
            {Array.from({length: 12}).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl bg-card/50 border border-border/40" />)}
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
      <div className="space-y-3 border-b border-border/50 pb-6 last:border-b-0">
        <div className="flex items-center gap-2 px-1">
          <span className="text-xl">{icon}</span>
          <h3 className="text-base font-bold tracking-tight font-headline text-foreground">{title}</h3>
          <span className="rounded-full border border-border/50 bg-secondary/70 px-2 py-0.5 text-xs font-mono text-muted-foreground">
            {list.length}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 w-full pb-10">
          {list.map((station) => (
            <PCCard
              key={station.id}
              machine={station}
              onAction={onCardAction}
              onMove={onMoveSession}
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
