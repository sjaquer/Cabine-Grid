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
  const [isChargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [isHistorySheetOpen, setHistorySheetOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
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

            if (remainingSeconds <= 300 && m.status !== 'warning') { // Within 5 mins or time up
              return { ...m, status: 'warning' };
            }
          }
          return m;
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenAssignDialog = () => setAssignDialogOpen(true);

  const handleOpenChargeDialog = (machine: Machine) => {
    setSelectedMachine(machine);
    setChargeDialogOpen(true);
  };
  
  const handleOpenHistorySheet = () => setHistorySheetOpen(true);

  const handleChargeDialogChange = (open: boolean) => {
    setChargeDialogOpen(open);
    if (!open) {
      setSelectedMachine(null);
    }
  }

  const handleAssignPC = (values: AssignPCFormValues) => {
    const machineName = machines.find(m => m.id === Number(values.machineId))?.name || `ID ${values.machineId}`;
    
    setMachines(prev =>
      prev.map(m => {
        if (m.id === Number(values.machineId)) {
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
      description: `${machineName} asignada a ${values.client}.`,
    });
    setAssignDialogOpen(false);
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
          ? { ...m, status: "available", session: undefined } 
          : m
      )
    );
    
    toast({
      title: "Pago Confirmado",
      description: `Se cobró ${formatCurrency(amount)} por la sesión en ${machine.name}.`,
    });
    setChargeDialogOpen(false);
  };

  const availableMachines = machines.filter(m => m.status === 'available');
  const dailySales = sales.reduce((sum, sale) => sum + sale.amount, 0);

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header 
        dailySales={dailySales}
        onAssignClick={handleOpenAssignDialog}
        onHistoryClick={handleOpenHistorySheet}
      />
      <main className="flex-1 overflow-y-auto">
        <PCGrid machines={machines} onFinishSession={handleOpenChargeDialog} />
      </main>
      
      <AssignPCDialog 
        isOpen={isAssignDialogOpen} 
        onOpenChange={setAssignDialogOpen}
        availableMachines={availableMachines}
        onAssign={handleAssignPC}
      />
      
      <ChargeDialog 
        isOpen={isChargeDialogOpen}
        onOpenChange={handleChargeDialogChange}
        machine={selectedMachine}
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
