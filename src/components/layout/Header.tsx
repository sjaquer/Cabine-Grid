import { Button } from "@/components/ui/button";
import { Cpu, History, CircleUser, Monitor, MonitorCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type HeaderProps = {
  dailySales: number;
  availableMachines: number;
  occupiedMachines: number;
  onHistoryClick: () => void;
};

export default function Header({ dailySales, availableMachines, occupiedMachines, onHistoryClick }: HeaderProps) {
  return (
    <header className="px-4 lg:px-6 h-16 flex items-center border-b shrink-0 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-2 mr-auto sm:mr-6">
        <Cpu className="h-8 w-8 text-primary" />
      </div>

       <div className="hidden sm:flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <MonitorCheck className="h-5 w-5 text-status-available" />
            <span className="font-semibold">
              Libres: <span className="text-foreground font-bold">{availableMachines}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-status-occupied" />
            <span className="font-semibold">
              Ocupadas: <span className="text-foreground font-bold">{occupiedMachines}</span>
            </span>
          </div>
       </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2 p-2 rounded-md bg-secondary">
           <span className="font-semibold text-sm">
             Ventas: <span className="text-primary font-bold">{formatCurrency(dailySales)}</span>
           </span>
        </div>
        
        <Button variant="ghost" size="sm" onClick={onHistoryClick}>
          <History className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Historial</span>
        </Button>

        <Button variant="ghost" size="icon">
          <CircleUser className="h-5 w-5" />
          <span className="sr-only">User Profile</span>
        </Button>
      </div>
    </header>
  );
}
