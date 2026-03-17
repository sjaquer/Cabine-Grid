"use client";

import { useState, useEffect, useMemo } from "react";
import type { Machine, Sale, PaymentMethod, SoldProduct, UserProfile, Session } from "@/lib/types";
import { rates } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import Header from "@/components/layout/Header";
import PCGrid from "./PCGrid";
import AssignPCDialog, { type AssignPCFormValues } from "./AssignPCDialog";
import ChargeDialog from "./ChargeDialog";
import SalesHistorySheet from "./SalesHistorySheet";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, where, Timestamp, doc, writeBatch } from "firebase/firestore";


export default function Dashboard() {
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();

  const machinesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "machines"));
  }, [firestore]);
  
  const { data: machinesData, isLoading: machinesLoading } = useCollection<Omit<Machine, 'id'>>(machinesQuery);

  const machines = useMemo(() => {
    if (!machinesData) return [];
    
    // Sort by name, assuming format "PC XX"
    return machinesData.sort((a, b) => {
      const numA = parseInt(a.name.split(' ')[1] || '0', 10);
      const numB = parseInt(b.name.split(' ')[1] || '0', 10);
      return numA - numB;
    });

  }, [machinesData]);

  const [isAssignDialogOpen, setAssignDialogOpen] = useState(false);
  const [machineToAssign, setMachineToAssign] = useState<Machine | null>(null);

  const [isChargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [machineToCharge, setMachineToCharge] = useState<Machine | null>(null);

  const [isHistorySheetOpen, setHistorySheetOpen] = useState(false);
  
  const { toast } = useToast();

  const salesQuery = useMemoFirebase(() => {
    if (!user) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = Timestamp.fromDate(today);

    return query(collection(firestore, "sales"), where("endTime", ">=", startOfToday));
  }, [firestore, user]);

  const { data: sales, loading: salesLoading } = useCollection<Sale>(salesQuery);
  const sortedSales = useMemo(() => sales ? [...sales].sort((a, b) => (b.endTime as Timestamp).toMillis() - (a.endTime as Timestamp).toMillis()) : [], [sales]);


  useEffect(() => {
     if (machinesLoading) return;
    const interval = setInterval(() => {
      machines.forEach(m => {
        if (m.session?.usageMode === 'prepaid' && (m.status === 'occupied' || m.status === 'warning')) {
            const { startTime, prepaidHours } = m.session;
            const prepaidSeconds = (prepaidHours || 0) * 3600;
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const remainingSeconds = prepaidSeconds - elapsedSeconds;

            if (remainingSeconds <= 300 && remainingSeconds > 0 && m.status !== 'warning') {
              const machineRef = doc(firestore, 'machines', m.id);
              const batch = writeBatch(firestore);
              batch.update(machineRef, { status: 'warning' });
              batch.commit();
            } else if (remainingSeconds > 300 && m.status === 'warning') {
              const machineRef = doc(firestore, 'machines', m.id);
              const batch = writeBatch(firestore);
              batch.update(machineRef, { status: 'occupied' });
              batch.commit();
            }
          }
      });
    }, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [machines, firestore, machinesLoading]);


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

  const handleAssignPC = async (values: AssignPCFormValues) => {
    if (!machineToAssign || !firestore) return;

    let prepaidHours: number | undefined;

    if (values.usageMode === 'prepaid' && values.prepaidValue) {
      const rate = rates.find(r => r.id === values.rateId)!;
      if (values.prepaidInputMode === 'time') {
        prepaidHours = values.prepaidValue;
      } else { // 'amount'
        prepaidHours = values.prepaidValue / rate.pricePerHour;
      }
    }
    
    const session: Session = {
        id: crypto.randomUUID(),
        client: values.client,
        startTime: Date.now(),
        usageMode: values.usageMode,
        rateId: values.rateId,
        prepaidHours: prepaidHours,
        userId: user?.uid
    };

    const machineRef = doc(firestore, "machines", machineToAssign.id);

    try {
        const batch = writeBatch(firestore);
        batch.update(machineRef, {
            status: "occupied",
            rateId: values.rateId,
            session: session
        });
        await batch.commit();

        toast({
            title: "Sesión Iniciada",
            description: `${machineToAssign.name} asignada a ${values.client || 'un cliente ocasional'}.`,
        });
        handleAssignDialogChange(false);
    } catch(error) {
         console.error("Error starting session: ", error);
          toast({
            variant: "destructive",
            title: "Error al iniciar sesión",
            description: "Hubo un problema al actualizar la máquina.",
          });
    }
  };

  const handleConfirmPayment = async (machineId: string, amount: number, paymentMethod: PaymentMethod, soldProducts: SoldProduct[]) => {
    if (!firestore) return;
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
    
    const machineRef = doc(firestore, "machines", machineId);

    try {
      // Use a batch to ensure atomicity
      const batch = writeBatch(firestore);
      
      // 1. Add the new sale document
      const salesCollection = collection(firestore, "sales");
      batch.set(doc(salesCollection), newSale);

      // 2. Reset the machine
      batch.update(machineRef, {
        status: "available",
        session: null // Or `deleteField()` if you want to remove it completely
      });
      
      await batch.commit();
      
      toast({
        title: "Pago Confirmado",
        description: `Se cobró ${formatCurrency(amount)} por la sesión en ${machine.name}.`,
      });
      handleChargeDialogChange(false);

    } catch (error) {
      console.error("Error confirming payment: ", error);
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
        <PCGrid machines={machines} onCardAction={handleCardAction} isLoading={machinesLoading} />
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
