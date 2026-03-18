"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Machine, Sale, PaymentMethod, SoldProduct, UserProfile, Session, Location } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import Header from "@/components/layout/Header";
import PCGrid from "./PCGrid";
import AssignPCDialog, { type AssignPCFormValues } from "./AssignPCDialog";
import ChargeDialog from "./ChargeDialog";
import ProductsPOSDialog from "./ProductsPOSDialog";
import SalesHistorySheet from "./SalesHistorySheet";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, where, Timestamp, doc, writeBatch, updateDoc } from "firebase/firestore";
import { rates } from "@/lib/data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


export default function Dashboard() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();

  const machinesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "machines"));
  }, [firestore]);
  
  const { data: machinesData, isLoading: machinesLoading } = useCollection<Omit<Machine, 'id'>>(machinesQuery);

  const locationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "locations"));
  }, [firestore]);

  const { data: locationsData } = useCollection<Omit<Location, "id">>(locationsQuery);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  const machines = useMemo(() => {
    if (!machinesData) return [];
    
    // Sort by name, assuming format "PC XX"
    return machinesData.sort((a, b) => {
      const numA = parseInt(a.name.split(' ')[1] || '0', 10);
      const numB = parseInt(b.name.split(' ')[1] || '0', 10);
      return numA - numB;
    });

  }, [machinesData]);

  const locations = useMemo(() => {
    return (locationsData ?? [])
      .filter((location) => location.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locationsData]);

  const availableLocations = useMemo(() => {
    const profileLocationIds = userProfile?.locationIds;
    const canViewAll = !profileLocationIds || profileLocationIds.length === 0 || userProfile?.role === "admin" || userProfile?.role === "manager";

    if (canViewAll) {
      return locations;
    }

    return locations.filter((location) => profileLocationIds.includes(location.id));
  }, [locations, userProfile?.locationIds, userProfile?.role]);

  const hasMachinesWithLocation = useMemo(() => machines.some((machine) => Boolean(machine.locationId)), [machines]);

  useEffect(() => {
    if (availableLocations.length === 0) {
      setSelectedLocationId("");
      return;
    }

    setSelectedLocationId((current) => {
      if (availableLocations.some((location) => location.id === current)) {
        return current;
      }
      return availableLocations[0].id;
    });
  }, [availableLocations]);

  const visibleMachines = useMemo(() => {
    if (!selectedLocationId || !hasMachinesWithLocation) {
      return machines;
    }

    return machines.filter((machine) => machine.locationId === selectedLocationId);
  }, [machines, selectedLocationId, hasMachinesWithLocation]);

  const [isAssignDialogOpen, setAssignDialogOpen] = useState(false);
  const [machineToAssign, setMachineToAssign] = useState<Machine | null>(null);

  const [isChargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [machineToCharge, setMachineToCharge] = useState<Machine | null>(null);
  const [isProcessingPayment, setProcessingPayment] = useState(false);

  const [isPosDialogOpen, setPosDialogOpen] = useState(false);
  const [machineToPos, setMachineToPos] = useState<Machine | null>(null);

  const [isHistorySheetOpen, setHistorySheetOpen] = useState(false);
  
  const { toast } = useToast();

  const salesQuery = useMemoFirebase(() => {
    if (!user) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = Timestamp.fromDate(today);

    return query(collection(firestore, "sales"), where("endTime", ">=", startOfToday));
  }, [firestore, user]);

  const { data: sales, isLoading: salesLoading } = useCollection<Sale>(salesQuery);
  const sortedSales = useMemo(() => sales ? [...sales].sort((a, b) => (b.endTime as Timestamp).toMillis() - (a.endTime as Timestamp).toMillis()) : [], [sales]);

  const visibleSales = useMemo(() => {
    if (!selectedLocationId) {
      return sortedSales;
    }

    const hasSalesWithLocation = sortedSales.some((sale) => Boolean(sale.locationId));
    if (!hasSalesWithLocation) {
      return sortedSales;
    }

    return sortedSales.filter((sale) => sale.locationId === selectedLocationId);
  }, [sortedSales, selectedLocationId]);


  useEffect(() => {
    if (machinesLoading || !firestore) return;
    
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
              batch.commit().catch(e => console.error("Error updating machine status:", e));
            } else if (remainingSeconds > 300 && m.status === 'warning') {
              const machineRef = doc(firestore, 'machines', m.id);
              const batch = writeBatch(firestore);
              batch.update(machineRef, { status: 'occupied' });
              batch.commit().catch(e => console.error("Error updating machine status:", e));
            }
        }
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [machines, firestore, machinesLoading]);


  const handleCardAction = useCallback((machine: Machine) => {
    if (machine.status === 'available') {
      setMachineToAssign(machine);
      setAssignDialogOpen(true);
    } else if (machine.status === 'occupied' || machine.status === 'warning') {
      setMachineToPos(machine);
      setPosDialogOpen(true);
    }
  }, []);

  const handleHeaderSettingsClick = useCallback(() => {
    router.push('/admin');
  }, [router]);

  const handleAssignDialogChange = useCallback((open: boolean) => {
    setAssignDialogOpen(open);
    if (!open) {
      setMachineToAssign(null);
    }
  }, []);

  const handleChargeDialogChange = useCallback((open: boolean) => {
    setChargeDialogOpen(open);
    if (!open) {
      setMachineToCharge(null);
    }
  }, []);

  const handlePosDialogChange = useCallback((open: boolean) => {
    setPosDialogOpen(open);
    if (!open) {
      setMachineToPos(null);
    }
  }, []);

  const handleAssignPC = useCallback(async (values: AssignPCFormValues) => {
    if (!machineToAssign || !firestore) return;
    
    // Obtener la tarifa de la máquina
    const machineRate = machineToAssign.rateId ? rates.find(r => r.id === machineToAssign.rateId) : null;
    const effectiveRate = machineRate || { 
      id: 'default', 
      name: 'Tarifa Normal', 
      pricePerHour: machineToAssign.hourlyRate || 3.00,
      description: 'Tarifa predefinida'
    };
    
    const session: Session = {
      id: crypto.randomUUID(),
      startTime: Date.now(),
      rateId: effectiveRate.id,
      hourlyRate: effectiveRate.pricePerHour,
      usageMode: values.usageMode,
      ...(values.usageMode === 'prepaid' && values.prepaidHours ? { prepaidHours: values.prepaidHours } : {}),
      ...(values.client ? { client: values.client } : {}),
      ...(user?.uid ? { userId: user.uid } : {}),
    };

    const machineRef = doc(firestore, "machines", machineToAssign.id);

    try {
        const batch = writeBatch(firestore);
        batch.update(machineRef, {
            status: "occupied",
            session: session,
            rateId: effectiveRate.id,
          ...(!machineToAssign.locationId && selectedLocationId ? { locationId: selectedLocationId } : {}),
        });
        await batch.commit();

        toast({
            title: "Sesión Iniciada",
            description: `${machineToAssign.name} asignada a ${values.client || 'un cliente ocasional'} en modo ${values.usageMode === 'prepaid' ? 'prepagado' : 'pago por uso'}.`,
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
  }, [machineToAssign, firestore, user?.uid, selectedLocationId, toast, handleAssignDialogChange]);

  const handleConfirmPayment = useCallback(async (machineId: string, amount: number, paymentMethod: PaymentMethod) => {
    if (!firestore || isProcessingPayment) return;
    const machine = machines.find(m => m.id === machineId);
    if (!machine || !machine.session) return;
    
    const { session } = machine;
    const selectedRate = rates.find(r => r.id === session.rateId);
    const endTime = Date.now();
    const totalMinutes = Math.ceil((endTime - session.startTime) / (1000 * 60));
    
    const operator = {
      ...(user?.uid ? { id: user.uid } : {}),
      ...(user?.email ? { email: user.email } : {}),
    };

    const soldProducts = machine.session?.soldProducts ?? [];
    const resolvedHourlyRate = typeof session.hourlyRate === "number"
      ? session.hourlyRate
      : (typeof selectedRate?.pricePerHour === "number" ? selectedRate.pricePerHour : undefined);
    const newSale = {
      machineName: machine.name,
      clientName: session.client || "Ocasional",
      ...((machine.locationId || selectedLocationId) ? { locationId: machine.locationId || selectedLocationId } : {}),
      startTime: Timestamp.fromMillis(session.startTime),
      endTime: Timestamp.fromMillis(endTime),
      totalMinutes,
      amount,
      ...(selectedRate ? { rate: selectedRate } : {}),
      ...(typeof resolvedHourlyRate === "number" ? { hourlyRate: resolvedHourlyRate } : {}),
      paymentMethod,
      soldProducts,
      ...(Object.keys(operator).length > 0 ? { operator } : {}),
    };
    
    const machineRef = doc(firestore, "machines", machineId);

    try {
      setProcessingPayment(true);
      const batch = writeBatch(firestore);
      const salesCollection = collection(firestore, "sales");
      batch.set(doc(salesCollection), newSale);
      batch.update(machineRef, {
        status: "available",
        session: null
      });
      
      await batch.commit();
      
      toast({
        title: "Pago Confirmado",
        description: `Se cobró ${formatCurrency(amount)} por la sesión en ${machine.name}.`,
      });
      handleChargeDialogChange(false);
      handlePosDialogChange(false);

    } catch (error) {
      console.error("Error confirming payment: ", error);
      toast({
        variant: "destructive",
        title: "Error al guardar la venta",
        description: "Hubo un problema al registrar la venta en la base de datos.",
      });
    } finally {
      setProcessingPayment(false);
    }
  }, [machines, firestore, isProcessingPayment, user?.uid, user?.email, selectedLocationId, toast, handleChargeDialogChange, handlePosDialogChange]);

  const handleSaveProducts = useCallback(async (machineId: string, products: SoldProduct[]) => {
    if (!firestore) return;
    const machine = machines.find((item) => item.id === machineId);
    if (!machine || !machine.session) return;

    try {
      const machineRef = doc(firestore, "machines", machineId);
      const updatedSession = {
        ...machine.session,
        soldProducts: products,
      };
      await updateDoc(machineRef, { session: updatedSession });
      toast({ title: "Productos guardados", description: "Se anexaron a la boleta del cliente." });
    } catch (error) {
      console.error("Error saving products:", error);
      toast({
        variant: "destructive",
        title: "Error al guardar productos",
        description: "No se pudo actualizar la boleta del cliente.",
      });
    }
  }, [machines, firestore, toast]);

  const handleGoToCharge = useCallback((machineId: string) => {
    const machine = machines.find((item) => item.id === machineId) ?? null;
    if (!machine) return;

    // Cerrar el POS antes de abrir cobro para evitar doble modal y clics extra.
    handlePosDialogChange(false);
    setMachineToCharge(machine);
    setChargeDialogOpen(true);
  }, [machines, handlePosDialogChange]);

  const availableMachines = visibleMachines.filter(m => m.status === 'available').length;
  const occupiedMachines = visibleMachines.length - availableMachines;
  const dailySales = visibleSales.reduce((sum, sale) => sum + sale.amount, 0);

  return (
    <div className="flex flex-col h-screen bg-secondary">
      <Header 
        dailySales={dailySales}
        availableMachines={availableMachines}
        occupiedMachines={occupiedMachines}
        onHistoryClick={() => setHistorySheetOpen(true)}
        onSettingsClick={handleHeaderSettingsClick}
        userProfile={userProfile}
      />
      {availableLocations.length > 0 && (
        <div className="px-4 sm:px-6 lg:px-8 py-3 border-b border-border/40 bg-card/70">
          <div className="max-w-sm">
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona local" />
              </SelectTrigger>
              <SelectContent>
                {availableLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      <main className="flex-1 overflow-y-auto">
        <PCGrid machines={visibleMachines} onCardAction={handleCardAction} isLoading={machinesLoading} />
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
        isProcessing={isProcessingPayment}
        fractionMinutes={locationsData?.find(loc => loc.id === (machineToCharge?.locationId || selectedLocationId))?.fractionMinutes || 5}
      />

      <SalesHistorySheet 
        isOpen={isHistorySheetOpen}
        onOpenChange={setHistorySheetOpen}
        sales={visibleSales}
        userProfile={userProfile}
      />

      <ProductsPOSDialog
        isOpen={isPosDialogOpen}
        onOpenChange={handlePosDialogChange}
        machine={machineToPos}
        onSaveProducts={handleSaveProducts}
        onGoToCharge={handleGoToCharge}
      />
    </div>
  );
}
