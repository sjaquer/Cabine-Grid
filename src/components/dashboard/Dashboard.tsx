"use client";

import { useState, useEffect, useMemo } from "react";
import type { Machine, Sale, PaymentMethod, SoldProduct, UserProfile } from "@/lib/types";
import { initialMachines, rates } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import Header from "@/components/layout/Header";
import PCGrid from "./PCGrid";
import AssignPCDialog, { type AssignPCFormValues } from "./AssignPCDialog";
import ChargeDialog from "./ChargeDialog";
import SalesHistorySheet from "./SalesHistorySheet";
import { useAuth, useCollection, useFirestore } from '@/firebase';
import { collection, addDoc, query, where, Timestamp } from "firebase/firestore";


export default function Dashboard() {
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();
  const [machines, setMachines] = useState<Machine[]>(initialMachines);
  
  const [isAssignDialogOpen, setAssignDialogOpen] = useState(false);
  const [machineToAssign, setMachineToAssign] = useState<Machine | null>(null);

  const [isChargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [machineToCharge, setMachineToCharge] = useState<Machine | null>(null);

  const [isHistorySheetOpen, setHistorySheetOpen] = useState(false);
  
  const { toast } = useToast();

  const salesQuery = useMemo(() => {
    if (!user) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = Timestamp.fromDate(today);

    return query(collection(firestore, "sales"), where("endTime", ">=", startOfToday));
  }, [firestore, user]);

  const { data: sales, loading: salesLoading } = useCollection<Sale>(salesQuery);
  const sortedSales = useMemo(() => sales ? [...sales].sort((a, b) => b.endTime - a.endTime) : [], [sales]);


  useEffect(() => {
    const interval = setInterval(() => {
      setMachines(prevMachines =>
        prevMachines.map(m => {
          if (m.session?.usageMode === 'prepaid' && m.status === 'occupied') {
            const { startTime, prepaidHours } = m.session;
            const prepaidSeconds = (prepaidHours || 0) * 3600;
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const remainingSeconds = prepaidSeconds - elapsedSeconds;

            if (remainingSeconds <= 300 && remainingSeconds > 0) {
              return { ...m, status: 'warning' };
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

    let prepaidHours: number | undefined;

    if (values.usageMode === 'prepaid' && values.prepaidValue) {
      const rate = rates.find(r => r.id === values.rateId)!;
      if (values.prepaidInputMode === 'time') {
        prepaidHours = values.prepaidValue;
      } else { // 'amount'
        prepaidHours = values.prepaidValue / rate.pricePerHour;
      }
    }

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
              prepaidHours: prepaidHours,
              userId: user?.uid
            },
          };
        }
        return m;
      })
    );

    toast({
      title: "Sesión Iniciada",
      description: `${machineToAssign.name} asignada a ${values.client || 'un cliente ocasional'}.`,
    });
    handleAssignDialogChange(false);
  };

  const handleConfirmPayment = async (machineId: number, amount: number, paymentMethod: PaymentMethod, soldProducts: SoldProduct[]) => {
    const machine = machines.find(m => m.id === machineId);
    if (!machine || !machine.session) return;
    
    const { session } = machine;
    const endTime = Date.now();
    const totalMinutes = Math.ceil((endTime - session.startTime) / (1000 * 60));
    const rate = rates.find(r => r.id === session.rateId)!;
    
    const newSale = {
      machineName: machine.name,
      clientName: session.client || "Ocasional",
      startTime: Timestamp.fromMillis(session.startTime),
      endTime: Timestamp.fromMillis(endTime),
      totalMinutes,
      amount,
      rate,
      paymentMethod,
      soldProducts,
      operator: {
        id: user?.uid,
        email: user?.email,
      }
    };
    
    try {
      await addDoc(collection(firestore, "sales"), newSale);

      setMachines(prev =>
        prev.map(m => 
          m.id === machineId 
            ? { ...initialMachines.find(im => im.id === machineId)!, rateId: m.rateId }
            : m
        )
      );
      
      toast({
        title: "Pago Confirmado",
        description: `Se cobró ${formatCurrency(amount)} por la sesión en ${machine.name}.`,
      });
      handleChargeDialogChange(false);

    } catch (error) {
      console.error("Error adding document: ", error);
      toast({
        variant: "destructive",
        title: "Error al guardar la venta",
        description: "Hubo un problema al registrar la venta en la base de datos.",
      });
    }
  };

  const availableMachines = machines.filter(m => m.status === 'available').length;
  const occupiedMachines = machines.length - availableMachines;
  const dailySales = sortedSales.reduce((sum, sale) => sum + sale.amount, 0);

  return (
    <div className="flex flex-col h-screen bg-secondary">
      <Header 
        dailySales={dailySales}
        availableMachines={availableMachines}
        occupiedMachines={occupiedMachines}
        onHistoryClick={() => setHistorySheetOpen(true)}
        userProfile={userProfile}
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
        sales={sortedSales}
        userProfile={userProfile}
      />
    </div>
  );
}
