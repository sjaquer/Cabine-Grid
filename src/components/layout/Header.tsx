import { Button } from "@/components/ui/button";
import { Cpu, History, PlusCircle, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type HeaderProps = {
  dailySales: number;
  onAssignClick: () => void;
  onHistoryClick: () => void;
};

export default function Header({ dailySales, onAssignClick, onHistoryClick }: HeaderProps) {
  return (
    <header className="px-4 lg:px-6 h-16 flex items-center border-b shrink-0 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <Cpu className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-bold font-headline tracking-wider text-primary-foreground">
          CyberGrid Console
        </h1>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center gap-2 p-2 rounded-md bg-secondary/50">
           <DollarSign className="h-5 w-5 text-status-available" />
           <span className="font-semibold text-sm">
             Recaudado Hoy: <span className="text-status-available font-bold">{formatCurrency(dailySales)}</span>
           </span>
        </div>
        
        <Button variant="outline" size="sm" onClick={onHistoryClick}>
          <History className="mr-2 h-4 w-4" />
          Historial
        </Button>
        
        <Button size="sm" onClick={onAssignClick}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Asignar PC
        </Button>
      </div>
    </header>
  );
}
