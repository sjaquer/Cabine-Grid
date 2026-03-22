"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Machine, Sale, PaymentMethod, SoldProduct, UserProfile, Session, Location, Product } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import Header from "@/components/layout/Header";
import PCGrid from "./PCGrid";
import AssignPCDialog, { type AssignPCFormValues } from "./AssignPCDialog";
import ChargeDialog from "./ChargeDialog";
import ProductsPOSDialog from "./ProductsPOSDialog";
import SalesHistorySheet from "./SalesHistorySheet";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, where, Timestamp, doc, writeBatch, updateDoc, serverTimestamp, runTransaction, getDoc } from "firebase/firestore";
import { rates } from "@/lib/data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getShiftStart, setShiftLocation } from "@/lib/shift-session";
import { logAuditAction, logAuditFailure } from "@/lib/audit-log";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, TrendingUp } from "lucide-react";


export default function Dashboard() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();

  console.log('DEBUG Dashboard: firestore disponible:', !!firestore, 'user:', user?.email);

  const machinesQuery = useMemoFirebase(() => {
    if (!firestore) {
      console.log('DEBUG: firestore no está disponible');
      return null;
    }
    return query(collection(firestore, "machines"));
  }, [firestore]);
  
  const { data: machinesData, isLoading: machinesLoading } = useCollection<Omit<Machine, 'id'>>(machinesQuery);

  const locationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "locations"));
  }, [firestore]);

  const { data: locationsData } = useCollection<Omit<Location, "id">>(locationsQuery);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "products"));
  }, [firestore]);

  const { data: productsData } = useCollection<Omit<Product, "id">>(productsQuery);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  const machines = useMemo(() => {
    if (!machinesData) {
      console.log('DEBUG: machinesData es null/undefined');
      return [];
    }
    
    console.log('DEBUG: machinesData loaded:', machinesData.length, 'máquinas');
    
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

  const products = useMemo(() => {
    return (productsData ?? [])
      .filter((product) => product.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [productsData]);

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

  useEffect(() => {
    if (!user?.uid) return;
    if (!selectedLocationId) return;
    setShiftLocation(user.uid, selectedLocationId);
  }, [user?.uid, selectedLocationId]);

  const visibleMachines = useMemo(() => {
    console.log('DEBUG: visibleMachines:', {
      totalMachines: machines.length,
      selectedLocationId,
      hasMachinesWithLocation,
      machinesLoading,
    });
    
    if (!selectedLocationId || !hasMachinesWithLocation) {
      console.log('DEBUG: Mostrando todas las máquinas:', machines.length);
      return machines;
    }

    const filtered = machines.filter((machine) => machine.locationId === selectedLocationId);
    console.log('DEBUG: Máquinas filtradas por local:', filtered.length);
    return filtered;
  }, [machines, selectedLocationId, hasMachinesWithLocation, machinesLoading]);

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

        await logAuditAction(firestore, {
          action: 'session.start',
          target: 'machines',
          targetId: machineToAssign.id,
          locationId: machineToAssign.locationId || selectedLocationId || undefined,
          actor: { id: user?.uid, email: user?.email, role: userProfile?.role },
          details: {
            machineName: machineToAssign.name,
            usageMode: values.usageMode,
            prepaidHours: values.prepaidHours ?? null,
            rateId: effectiveRate.id,
            rateName: effectiveRate.name,
            client: values.client || 'Ocasional',
          },
        });

        toast({
            title: "Sesión Iniciada",
            description: `${machineToAssign.name} asignada a ${values.client || 'un cliente ocasional'} en modo ${values.usageMode === 'prepaid' ? 'prepagado' : 'pago por uso'}.`,
        });
        handleAssignDialogChange(false);
    } catch(error) {
         console.error("Error starting session: ", error);
          await logAuditFailure(firestore, {
            action: 'session.start.error',
            target: 'machines',
            targetId: machineToAssign.id,
            locationId: machineToAssign.locationId || selectedLocationId || undefined,
            actor: { id: user?.uid, email: user?.email, role: userProfile?.role },
            error,
          });
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
    const effectiveLocationId = machine.locationId || selectedLocationId;
    const shiftStartMs = user?.uid ? (getShiftStart(user.uid) ?? session.startTime) : session.startTime;
    const shiftId = `${effectiveLocationId || 'global'}_${user?.uid || 'anon'}_${shiftStartMs}`;

    let receiptSequence = 1;
    let receiptSeries = (effectiveLocationId || 'GLOBAL').slice(0, 6).toUpperCase();
    let receiptNumber = `${receiptSeries}-${String(receiptSequence).padStart(6, '0')}`;

    try {
      const counterId = `${effectiveLocationId || 'global'}_${shiftId}`;
      const counterRef = doc(firestore, "receiptCounters", counterId);
      receiptSequence = await runTransaction(firestore, async (transaction) => {
        const snapshot = await transaction.get(counterRef);
        const current = snapshot.exists() ? Number(snapshot.data().lastNumber || 0) : 0;
        const next = current + 1;
        transaction.set(counterRef, {
          locationId: effectiveLocationId || null,
          shiftId,
          lastNumber: next,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        return next;
      });
      receiptNumber = `${receiptSeries}-${String(receiptSequence).padStart(6, '0')}`;
    } catch (error) {
      console.error("Error generating receipt counter:", error);
    }

    const resolvedHourlyRate = typeof session.hourlyRate === "number"
      ? session.hourlyRate
      : (typeof selectedRate?.pricePerHour === "number" ? selectedRate.pricePerHour : undefined);
    const newSale = {
      machineName: machine.name,
      clientName: session.client || "Ocasional",
      ...(effectiveLocationId ? { locationId: effectiveLocationId } : {}),
      receiptSeries,
      receiptSequence,
      receiptNumber,
      shiftId,
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
      const saleRef = doc(salesCollection);
      batch.set(saleRef, newSale);

      if (effectiveLocationId) {
        const inventoryUpdates: Array<{ productId: string; productName: string; newStock: number }> = [];

        for (const product of soldProducts) {
          if (!product.productId) continue;
          const inventoryRef = doc(firestore, "inventory", `${effectiveLocationId}_${product.productId}`);
          const inventorySnap = await getDoc(inventoryRef);
          const fallbackProduct = products.find((item) => item.id === product.productId);
          const currentStock = inventorySnap.exists()
            ? Number(inventorySnap.data().stock ?? 0)
            : Math.max(0, Number(fallbackProduct?.stock ?? 0));

          if (currentStock < product.quantity) {
            throw new Error(`Stock insuficiente para ${product.productName}. Disponible: ${currentStock}.`);
          }

          inventoryUpdates.push({
            productId: product.productId,
            productName: product.productName,
            newStock: currentStock - product.quantity,
          });
        }

        inventoryUpdates.forEach((update) => {
          const inventoryRef = doc(firestore, "inventory", `${effectiveLocationId}_${update.productId}`);
          batch.set(
            inventoryRef,
            {
              locationId: effectiveLocationId,
              productId: update.productId,
              productName: update.productName,
              stock: update.newStock,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        });
      }

      batch.update(machineRef, {
        status: "available",
        session: null
      });
      
      await batch.commit();

      await logAuditAction(firestore, {
        action: 'sale.close',
        target: 'sales',
        targetId: saleRef.id,
        locationId: effectiveLocationId || undefined,
        actor: { id: user?.uid, email: user?.email, role: userProfile?.role },
        details: {
          machineId,
          machineName: machine.name,
          amount,
          paymentMethod,
          receiptNumber,
          shiftId,
          productsCount: soldProducts.reduce((sum, p) => sum + p.quantity, 0),
        },
      });
      
      toast({
        title: "Pago Confirmado",
        description: `Se cobró ${formatCurrency(amount)} por la sesión en ${machine.name}. Boleta ${receiptNumber}.`,
      });
      handleChargeDialogChange(false);
      handlePosDialogChange(false);

    } catch (error) {
      console.error("Error confirming payment: ", error);
      await logAuditFailure(firestore, {
        action: 'sale.close.error',
        target: 'sales',
        targetId: machineId,
        locationId: machine.locationId || selectedLocationId || undefined,
        actor: { id: user?.uid, email: user?.email, role: userProfile?.role },
        error,
        details: {
          paymentMethod,
          amount,
          machineName: machine.name,
        },
      });
      const message = error instanceof Error ? error.message : "Hubo un problema al registrar la venta en la base de datos.";
      toast({
        variant: "destructive",
        title: "Error al guardar la venta",
        description: message,
      });
    } finally {
      setProcessingPayment(false);
    }
  }, [machines, firestore, isProcessingPayment, user?.uid, user?.email, selectedLocationId, toast, handleChargeDialogChange, handlePosDialogChange, products]);

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
      await logAuditAction(firestore, {
        action: 'session.products.update',
        target: 'machines',
        targetId: machineId,
        locationId: machine.locationId || selectedLocationId || undefined,
        actor: { id: user?.uid, email: user?.email, role: userProfile?.role },
        details: {
          totalItems: products.reduce((sum, p) => sum + p.quantity, 0),
          totalProducts: products.length,
        },
      });
      toast({ title: "Productos guardados", description: "Se anexaron a la boleta del cliente." });
    } catch (error) {
      console.error("Error saving products:", error);
      await logAuditFailure(firestore, {
        action: 'session.products.update.error',
        target: 'machines',
        targetId: machineId,
        locationId: machine.locationId || selectedLocationId || undefined,
        actor: { id: user?.uid, email: user?.email, role: userProfile?.role },
        error,
        details: {
          totalItems: products.reduce((sum, p) => sum + p.quantity, 0),
          totalProducts: products.length,
        },
      });
      toast({
        variant: "destructive",
        title: "Error al guardar productos",
        description: "No se pudo actualizar la boleta del cliente.",
      });
    }
  }, [machines, firestore, toast, selectedLocationId, user?.uid, user?.email, userProfile?.role]);

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
  const utilizationRate = visibleMachines.length > 0 ? Math.round((occupiedMachines / visibleMachines.length) * 100) : 0;

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-secondary via-secondary to-secondary/80">
      <Header 
        dailySales={dailySales}
        availableMachines={availableMachines}
        occupiedMachines={occupiedMachines}
        onHistoryClick={() => setHistorySheetOpen(true)}
        onSettingsClick={handleHeaderSettingsClick}
        userProfile={userProfile}
      />

      {/* Sección de Estadísticas y Selección de Local */}
      <div className="border-b border-border/40 bg-card/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
          {/* Grid de Estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard 
              label="Cabinas Disponibles"
              value={availableMachines}
              total={visibleMachines.length}
              color="text-status-available"
              icon={<Clock className="w-4 h-4" />}
            />
            <StatCard 
              label="En uso"
              value={occupiedMachines}
              total={visibleMachines.length}
              color="text-status-occupied"
              icon={<TrendingUp className="w-4 h-4" />}
            />
            <StatCard 
              label="Ocupación"
              value={`${utilizationRate}%`}
              color="text-primary"
              icon={null}
            />
            <StatCard 
              label="Recaudación hoy"
              value={formatCurrency(dailySales)}
              color="text-accent"
              icon={null}
            />
          </div>

          {/* Selección de Local */}
          {availableLocations.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-lg bg-background/50 border border-border/30">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>Filtrando por:</span>
              </div>
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Selecciona local" />
                </SelectTrigger>
                <SelectContent>
                  {availableLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      <span className="font-medium">{location.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLocationId && availableLocations.length > 1 && (
                <Badge variant="secondary" className="hidden sm:flex">
                  {availableLocations.find(l => l.id === selectedLocationId)?.name}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid de Máquinas */}
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
        products={products}
        onSaveProducts={handleSaveProducts}
        onGoToCharge={handleGoToCharge}
      />
    </div>
  );
}

// Componente para Tarjeta de Estadística
function StatCard({ 
  label, 
  value, 
  total,
  color,
  icon 
}: { 
  label: string;
  value: string | number;
  total?: number;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-lg bg-background/50 border border-border/50 hover:border-border/80 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <div className="flex items-baseline gap-1 mt-1">
            <p className={`text-2xl font-bold pretype-number ${color}`}>{value}</p>
            {total !== undefined && (
              <p className="text-xs text-muted-foreground">/ {total}</p>
            )}
          </div>
        </div>
        {icon && (
          <div className={`p-2 rounded-md bg-primary/10 text-primary flex-shrink-0`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
