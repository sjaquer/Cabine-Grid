"use client";

import { useState, useEffect } from "react";
import type { Machine, Sale } from "@/lib/types";
import { initialMachines, rates } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import Header from "@/components/layout/Header";
import PCGrid from "./PCGrid";
import AssignPCDialog, { type AssignPCFormValues } from "./AssignPCDialog";
import ChargeDialog from "./ChargeDialog";
import SalesHistorySheet from "./SalesHistorySheet";

export default function Dashboard() {
  const [machines, setMachines] = useState<Machine[]>(initialMachines);
  const [sales, setSales] = useState<Sale[]>([]);
  
  const [isAssignDialogOpen, setAssignDialogOpen] = useState(false);
  const [machineToAssign, setMachineToAssign] = useState<Machine | null>(null);

  const [isChargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [machineToCharge, setMachineToCharge] = useState<Machine | null>(null);

  const [isHistorySheetOpen, setHistorySheetOpen] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    const interval = setInterval(() => {
      setMachines(prevMachines =>
        prevMachines.map(m => {
          if (m.session?.usageMode === 'prepaid') {
            const { startTime, prepaidHours } = m.session;
            const prepaidSeconds = (prepaidHours || 0) * 3600;
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const remainingSeconds = prepaidSeconds - elapsedSeconds;

            if (remainingSeconds <= 300 && m.status !== 'warning' && remainingSeconds > 0) {
              return { ...m, status: 'warning' };
            }
             if (remainingSeconds <= 0 && m.status !== 'occupied') {
               // Optional: Auto-end session when time is up. For now, just change status.
               // For simplicity, we keep it occupied but let the UI show time is up.
            }
          }
          return m;
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCardAction = (machine: Machine) => {
    if (machine.status === 'available') {
      setMachineToAssign(machine);
      setAssignDialogOpen(true);
    } else if (machine.status === 'occupied' || machine.status === 'warning') {
      setMachineToCharge(machine);
      setChargeDialogOpen(true);
    }
  };

  const handleAssignDialogChange = (open: boolean) => {
    setAssignDialogOpen(open);
    if (!open) {
      setMachineToAssign(null);
    }
  }

  const handleChargeDialogChange = (open: boolean) => {
    setChargeDialogOpen(open);
    if (!open) {
      setMachineToCharge(null);
    }
  }

  const handleAssignPC = (values: AssignPCFormValues) => {
    if (!machineToAssign) return;

    setMachines(prev =>
      prev.map(m => {
        if (m.id === machineToAssign.id) {
          return {
            ...m,
            status: "occupied",
            rateId: values.rateId,
            session: {
              id: crypto.randomUUID(),
              client: values.client,
              startTime: Date.now(),
              usageMode: values.usageMode,
              rateId: values.rateId,
              prepaidHours: values.prepaidHours,
            },
          };
        }
        return m;
      })
    );

    toast({
      title: "Sesión Iniciada",
      description: `${machineToAssign.name} asignada a ${values.client}.`,
    });
    handleAssignDialogChange(false);
  };

  const handleConfirmPayment = (machineId: number, amount: number) => {
    const machine = machines.find(m => m.id === machineId);
    if (!machine || !machine.session) return;
    
    const { session } = machine;
    const endTime = Date.now();
    const totalMinutes = Math.ceil((endTime - session.startTime) / (1000 * 60));
    const rate = rates.find(r => r.id === session.rateId)!;
    
    const newSale: Sale = {
      id: crypto.randomUUID(),
      machineName: machine.name,
      clientName: session.client,
      startTime: session.startTime,
      endTime,
      totalMinutes,
      amount,
      rate,
    };
    
    setSales(prev => [newSale, ...prev]);
    
    setMachines(prev =>
      prev.map(m => 
        m.id === machineId 
          ? { ...initialMachines.find(im => im.id === machineId)! }
          : m
      )
    );
    
    toast({
      title: "Pago Confirmado",
      description: `Se cobró ${formatCurrency(amount)} por la sesión en ${machine.name}.`,
    });
    handleChargeDialogChange(false);
  };

  const availableMachines = machines.filter(m => m.status === 'available').length;
  const occupiedMachines = machines.length - availableMachines;
  const dailySales = sales.reduce((sum, sale) => sum + sale.amount, 0);

  return (
    <div className="flex flex-col h-screen bg-secondary">
      <Header 
        dailySales={dailySales}
        availableMachines={availableMachines}
        occupiedMachines={occupiedMachines}
        onHistoryClick={() => setHistorySheetOpen(true)}
      />
      <main className="flex-1 overflow-y-auto">
        <PCGrid machines={machines} onCardAction={handleCardAction} />
      </main>
      
      <AssignPCDialog 
        isOpen={isAssignDialogOpen} 
        onOpenChange={handleAssignDialogChange}
        machine={machineToAssign}
        onAssign={handleAssignPC}
      />
      
      <ChargeDialog 
        isOpen={isChargeDialogOpen}
        onOpenChange={handleChargeDialogChange}
        machine={machineToCharge}
        onConfirmPayment={handleConfirmPayment}
      />

      <SalesHistorySheet 
        isOpen={isHistorySheetOpen}
        onOpenChange={setHistorySheetOpen}
        sales={sales}
      />
    </div>
  );
}
