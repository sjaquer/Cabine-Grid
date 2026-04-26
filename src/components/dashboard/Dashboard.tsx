"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Customer, Machine, Sale, PaymentMethod, SoldProduct, UserProfile, Session, Location, Product } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import Header from "@/components/layout/Header";
import PCGrid from "./PCGrid";
import AssignPCDialog, { type AssignPCFormValues } from "./AssignPCDialog";
import ChargeDialog from "./ChargeDialog";
import ProductsPOSDialog from "./ProductsPOSDialog";
import SalesHistorySheet from "./SalesHistorySheet";
import { doc, Timestamp, addDoc, collection, serverTimestamp, runTransaction } from "firebase/firestore";
import { rates } from "@/lib/data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getShiftStart } from "@/lib/shift-session";
import { logAuditAction, logAuditFailure } from "@/lib/audit-log";
import { closeSession } from "@/lib/close-session";
import { canAccessMachine } from "@/hooks/useMachineAccess";
import { useInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Building2, Settings, SlidersHorizontal } from "lucide-react";
import InventoryAlertsDisplay from "./InventoryAlertsDisplay";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDashboardData } from "@/hooks/useDashboardData";
import { updateSessionProducts, startMachineSession } from "@/lib/services/sales";
import { Skeleton } from "@/components/ui/skeleton";


export default function Dashboard() {
  const router = useRouter();
  const { toast } = useToast();
  
  const {
    machines,
    accessibleMachines,
    visibleMachines,
    filteredMachines,
    locations,
    availableLocations,
    selectedLocationId,
    setSelectedLocationId,
    products,
    customers,
    inventoryData,
    inventoryByProduct,
    visibleSales,
    dailySales,
    isLoading,
    machineViewFilter,
    setMachineViewFilter,
    firestore,
    user,
    userProfile,
  } = useDashboardData();

  // Local UI States
  const [isAssignDialogOpen, setAssignDialogOpen] = useState(false);
  const [machineToAssign, setMachineToAssign] = useState<Machine | null>(null);

  const [isChargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [machineToCharge, setMachineToCharge] = useState<Machine | null>(null);
  const [isProcessingPayment, setProcessingPayment] = useState(false);

  const [isPosDialogOpen, setPosDialogOpen] = useState(false);
  const [machineToPos, setMachineToPos] = useState<Machine | null>(null);

  const [isHistorySheetOpen, setHistorySheetOpen] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);




  const handleCardAction = useCallback((machine: Machine) => {
    if (machine.status === 'available') {
      setMachineToAssign(machine);
      setAssignDialogOpen(true);
    } else if (machine.status === 'occupied' || machine.status === 'warning') {
      setMachineToPos(machine);
      setPosDialogOpen(true);
    }
  }, []);

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

    const selectedCustomer = values.customerId
      ? customers.find((customer) => customer.id === values.customerId) ?? null
      : null;
    
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
      ...(selectedCustomer
        ? {
            client: selectedCustomer.fullName,
            clientId: selectedCustomer.id,
            clientCode: selectedCustomer.customerCode,
          }
        : {}),
      ...(user?.uid ? { userId: user.uid } : {}),
    };

    try {
        await startMachineSession(
          firestore,
          machineToAssign.id,
          session,
          effectiveRate.id,
          selectedLocationId
        );

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
            client: selectedCustomer?.fullName || 'Ocasional',
            customerId: selectedCustomer?.id || null,
          },
        });

        toast({
            title: "Sesión Iniciada",
            description: `${machineToAssign.name} asignada a ${selectedCustomer?.fullName || 'un cliente ocasional'} en modo ${values.usageMode === 'prepaid' ? 'prepagado' : 'pago por uso'}.`,
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
  }, [machineToAssign, firestore, customers, user?.uid, selectedLocationId, toast, handleAssignDialogChange]);

  const handleCreateCustomerQuick = useCallback(async (payload: Omit<Customer, "id">): Promise<Customer> => {
    if (!firestore) {
      throw new Error("Firestore no esta disponible");
    }

    const normalizedCode = payload.customerCode.trim().toUpperCase();
    const normalizedName = payload.fullName.trim();

    const existingByCode = customers.some((customer) => customer.customerCode.trim().toUpperCase() === normalizedCode);
    if (existingByCode) {
      throw new Error("Ya existe un cliente con ese codigo");
    }

    const docRef = await addDoc(collection(firestore, "customers"), {
      customerCode: normalizedCode,
      fullName: normalizedName,
      ...(typeof payload.age === "number" ? { age: payload.age } : {}),
      ...(payload.phone ? { phone: payload.phone } : {}),
      ...(payload.email ? { email: payload.email } : {}),
      favoriteGames: payload.favoriteGames ?? [],
      isActive: payload.isActive ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: {
        id: user?.uid,
        email: user?.email,
      },
      metrics: {
        totalSessions: 0,
        totalMinutesRented: 0,
        totalProductsBought: 0,
        totalSpent: 0,
        machineUsage: {},
        visitsByWeekday: {},
        visitHours: {},
      },
    });

    const created: Customer = {
      id: docRef.id,
      customerCode: normalizedCode,
      fullName: normalizedName,
      ...(typeof payload.age === "number" ? { age: payload.age } : {}),
      ...(payload.phone ? { phone: payload.phone } : {}),
      ...(payload.email ? { email: payload.email } : {}),
      favoriteGames: payload.favoriteGames ?? [],
      isActive: true,
      metrics: {
        totalSessions: 0,
        totalMinutesRented: 0,
        totalProductsBought: 0,
        totalSpent: 0,
        machineUsage: {},
        visitsByWeekday: {},
        visitHours: {},
      },
    };

    await logAuditAction(firestore, {
      action: 'customer.create.quick',
      target: 'customers',
      targetId: created.id,
      actor: { id: user?.uid, email: user?.email, role: userProfile?.role },
      details: {
        customerCode: normalizedCode,
        fullName: normalizedName,
      },
    });

    toast({
      title: "Cliente creado",
      description: `${normalizedName} ya esta disponible para asignar.`,
    });

    return created;
  }, [firestore, customers, user?.uid, user?.email, userProfile?.role, toast]);

  const handleConfirmPayment = useCallback(async (machineId: string, amount: number, paymentMethod: PaymentMethod) => {
    if (!firestore || isProcessingPayment) return;
    const machine = accessibleMachines.find(m => m.id === machineId);
    if (!machine || !machine.session) return;
    
    // Validate user has access to this machine
    if (!canAccessMachine(machine, userProfile)) {
      toast({
        variant: "destructive",
        title: "Acceso denegado",
        description: "No tienes permiso para operar esta máquina.",
      });
      return;
    }
    
    const { session } = machine;
    const effectiveLocationId = machine.locationId || selectedLocationId;
    const shiftStartMs = user?.uid ? (getShiftStart(user.uid) ?? session.startTime) : session.startTime;
    const shiftId = `${effectiveLocationId || 'global'}_${user?.uid || 'anon'}_${shiftStartMs}`;

    // Generate receipt number
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

    const soldProducts = machine.session?.soldProducts ?? [];

    try {
      setProcessingPayment(true);
      
      // Use the new transactional closeSession function
      const result = await closeSession(firestore, {
        machineId,
        machine,
        session,
        amount,
        paymentMethod,
        locationId: effectiveLocationId,
        operatorId: user?.uid,
        operatorEmail: user?.email || undefined,
        operatorRole: userProfile?.role,
        shiftId,
        receiptNumber,
        soldProducts,
      });

      toast({
        title: "Pago Confirmado",
        description: `Se cobró ${formatCurrency(amount)} por la sesión en ${machine.name}. Boleta ${result.receiptNumber}.`,
      });
      handleChargeDialogChange(false);
      handlePosDialogChange(false);

    } catch (error) {
      console.error("Error confirming payment: ", error);
      const message = error instanceof Error ? error.message : "Hubo un problema al registrar la venta en la base de datos.";
      toast({
        variant: "destructive",
        title: "Error al guardar la venta",
        description: message,
      });
    } finally {
      setProcessingPayment(false);
    }
  }, [accessibleMachines, firestore, isProcessingPayment, user?.uid, user?.email, selectedLocationId, toast, handleChargeDialogChange, handlePosDialogChange, userProfile]);

  const handleSaveProducts = useCallback(async (machineId: string, products: SoldProduct[]) => {
    if (!firestore) return;
    const machine = accessibleMachines.find((item) => item.id === machineId);
    if (!machine || !machine.session) return;
    
    // Validate user has access to this machine
    if (!canAccessMachine(machine, userProfile)) {
      toast({
        variant: "destructive",
        title: "Acceso denegado",
        description: "No tienes permiso para operar esta máquina.",
      });
      return;
    }

    try {
      await updateSessionProducts(firestore!, machineId, products);
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
  }, [accessibleMachines, firestore, toast, selectedLocationId, user?.uid, user?.email, userProfile]);

  const handleGoToCharge = useCallback((machineId: string, selectedProducts?: SoldProduct[]) => {
    const machine = accessibleMachines.find((item) => item.id === machineId) ?? null;
    if (!machine) return;
    
    // Validate user has access to this machine
    if (!canAccessMachine(machine, userProfile)) {
      toast({
        variant: "destructive",
        title: "Acceso denegado",
        description: "No tienes permiso para operar esta máquina.",
      });
      return;
    }

    // Cerrar el POS antes de abrir cobro para evitar doble modal y clics extra.
    handlePosDialogChange(false);
    const machineForCharge = selectedProducts
      ? {
          ...machine,
          session: machine.session
            ? {
                ...machine.session,
                soldProducts: selectedProducts,
              }
            : machine.session,
        }
      : machine;

    setMachineToCharge(machineForCharge);
    setChargeDialogOpen(true);
  }, [accessibleMachines, handlePosDialogChange, toast, userProfile]);

  const availableMachines = visibleMachines.filter((machine) => machine.status === "available").length;
  const activeMachines = visibleMachines.filter((machine) => machine.status === "occupied" || machine.status === "warning").length;
  const maintenanceMachines = visibleMachines.filter((machine) => machine.status === "maintenance").length;


  // Hook para obtener alertas de inventario
  const inventoryAlerts = useInventoryAlerts(inventoryData || []);
  const selectedLocationName = useMemo(
    () => availableLocations.find((location) => location.id === selectedLocationId)?.name,
    [availableLocations, selectedLocationId]
  );

  const operationPanel = (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-border/50 bg-card/60 p-3.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Control operativo</p>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Gestor de cabinas</p>
            <p className="text-xs text-muted-foreground">Monitoreo en tiempo real</p>
          </div>
          {selectedLocationName && <Badge variant="secondary" className="h-7 rounded-full px-2.5 text-[11px]">{selectedLocationName}</Badge>}
        </div>
      </div>

      <div className="surface-soft space-y-2 p-3.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cambiar local</p>
        <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
          <SelectTrigger className="h-10 w-full">
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

      <div className="grid grid-cols-2 gap-3">
        <div className="surface-soft p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Libres</p>
          <p className="text-2xl font-bold leading-none">{availableMachines}</p>
        </div>
        <div className="surface-soft p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Activas</p>
          <p className="text-2xl font-bold leading-none">{activeMachines}</p>
        </div>
        <div className="surface-soft p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mantenimiento</p>
          <p className="text-2xl font-bold leading-none">{maintenanceMachines}</p>
        </div>
        <div className="surface-soft p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alertas</p>
          <p className="text-2xl font-bold leading-none">{inventoryAlerts.length}</p>
        </div>
      </div>

      {(userProfile?.role === "admin" || userProfile?.role === "manager") && (
        <Button
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2"
          onClick={() => {
            setShowMobileControls(false);
            router.push("/admin");
          }}
        >
          <Settings className="h-4 w-4" />
          Administración
        </Button>
      )}

      {inventoryAlerts.length > 0 && (
        <InventoryAlertsDisplay alerts={inventoryAlerts} maxDisplay={3} />
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4 p-8 animate-pulse">
        <Skeleton className="h-10 w-[250px]" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="app-shell app-enter flex h-screen flex-col">
      <Header 
        dailySales={dailySales}
        availableMachines={availableMachines}
        occupiedMachines={activeMachines}
        onHistoryClick={() => setHistorySheetOpen(true)}
        userProfile={userProfile}
      />

      <main className="app-container flex-1 overflow-hidden py-3 sm:py-4">
        <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="surface-card hidden h-full overflow-y-auto p-4 lg:block">
            {operationPanel}
          </aside>

          <section className="surface-card flex h-full min-h-0 flex-col overflow-hidden">
            <div className="border-b border-border/40 p-3 sm:p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold sm:text-lg">Cabinas operativas</h2>
                  <p className="text-xs text-muted-foreground sm:text-sm">Selecciona una cabina para asignar, cobrar o abrir TPV.</p>
                </div>
                <div className="hidden items-center gap-2 rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-xs text-muted-foreground sm:flex">
                  <Building2 className="h-3.5 w-3.5" />
                  {selectedLocationName || "Sin local"}
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Button
                size="sm"
                className="h-9 rounded-full px-4 text-sm"
                variant={machineViewFilter === "available" ? "default" : "outline"}
                onClick={() => setMachineViewFilter("available")}
              >
                Libres {availableMachines}
              </Button>
              <Button
                size="sm"
                className="h-9 rounded-full px-4 text-sm"
                variant={machineViewFilter === "active" ? "default" : "outline"}
                onClick={() => setMachineViewFilter("active")}
              >
                Activas {activeMachines}
              </Button>
              <Button
                size="sm"
                className="h-9 rounded-full px-4 text-sm"
                variant={machineViewFilter === "all" ? "default" : "outline"}
                onClick={() => setMachineViewFilter("all")}
              >
                Todas {visibleMachines.length}
              </Button>

              {selectedLocationName && (
                <Badge variant="secondary" className="h-9 rounded-full px-3 text-xs sm:hidden">
                  {selectedLocationName}
                </Badge>
              )}

              {maintenanceMachines > 0 && (
                <Badge variant="outline" className="h-9 rounded-full px-3 text-xs">
                  Mantenimiento {maintenanceMachines}
                </Badge>
              )}

              {inventoryAlerts.length > 0 && (
                <Badge variant="outline" className="h-9 rounded-full px-3 text-xs lg:hidden">
                  <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                  Alertas {inventoryAlerts.length}
                </Badge>
              )}

              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-9 gap-1 px-3 lg:hidden"
                onClick={() => setShowMobileControls(true)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Panel
              </Button>
            </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
               <PCGrid machines={filteredMachines} onCardAction={handleCardAction} isLoading={isLoading} />
            </div>
          </section>
        </div>
      </main>

      <Sheet open={showMobileControls} onOpenChange={setShowMobileControls}>
        <SheetContent side="left" className="w-[88vw] p-4 sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Panel lateral</SheetTitle>
            <SheetDescription>
              Cambia local y revisa informacion rapida sin quitar espacio a las cabinas.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
            {operationPanel}
          </div>
        </SheetContent>
      </Sheet>
      
      <AssignPCDialog 
        isOpen={isAssignDialogOpen} 
        onOpenChange={handleAssignDialogChange}
        machine={machineToAssign}
        customers={customers}
        onCreateCustomer={handleCreateCustomerQuick}
        onAssign={handleAssignPC}
      />
      
      <ChargeDialog 
        isOpen={isChargeDialogOpen}
        onOpenChange={handleChargeDialogChange}
        machine={machineToCharge}
        onConfirmPayment={handleConfirmPayment}
        isProcessing={isProcessingPayment}
        fractionMinutes={locations?.find((loc: Location) => loc.id === (machineToCharge?.locationId || selectedLocationId))?.fractionMinutes || 5}
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
        inventoryByProduct={inventoryByProduct}
      />
    </div>
  );
}
