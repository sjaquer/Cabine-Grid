"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Customer, Station, Sale, PaymentMethod, SoldProduct, UserProfile, Session, Location, Product } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import Header from "@/components/layout/Header";
import PCGrid from "./PCGrid";
import AssignPCDialog, { type AssignPCFormValues } from "./AssignPCDialog";
import ProductsPOSDialog from "./ProductsPOSDialog";
import SalesHistorySheet from "./SalesHistorySheet";
import { doc, Timestamp, addDoc, collection, serverTimestamp, runTransaction } from "firebase/firestore";
import { rates } from "@/lib/data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getShiftStart } from "@/lib/shift-session";
import { logAuditAction, logAuditFailure } from "@/lib/audit-log";
import { closeSession } from "@/lib/close-session";
import { canAccessMachine } from "@/hooks/useMachineAccess";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Building2, Settings, SlidersHorizontal, Search, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import InventoryAlertsDisplay from "./InventoryAlertsDisplay";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDashboardData } from "@/hooks/useDashboardData";
import { updateSessionProducts, startMachineSession } from "@/lib/services/sales";
import { Skeleton } from "@/components/ui/skeleton";


export default function Dashboard() {
  const router = useRouter();
  const { toast } = useToast();
  
  const {
    stations: machines,
    accessibleStations: accessibleMachines,
    visibleStations: visibleMachines,
    filteredStations: filteredMachines,
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
    stationViewFilter: machineViewFilter,
    setStationViewFilter: setMachineViewFilter,
    firestore,
    user,
    userProfile,
  } = useDashboardData();

  const [isAssignDialogOpen, setAssignDialogOpen] = useState(false);
  const [machineToAssign, setMachineToAssign] = useState<Station | null>(null);

  const [isProcessingPayment, setProcessingPayment] = useState(false);

  const [isPosDialogOpen, setPosDialogOpen] = useState(false);
  const [machineToPos, setMachineToPos] = useState<Station | null>(null);

  const [searchQuery, setSearchQuery] = useState("");

  const finalFilteredMachines = useMemo(() => {
    if (!searchQuery.trim()) return filteredMachines;
    const q = searchQuery.toLowerCase().trim();
    return filteredMachines.filter((m) => {
      const matchesName = m.name.toLowerCase().includes(q);
      const matchesClient = m.session?.client?.toLowerCase().includes(q);
      return matchesName || matchesClient;
    });
  }, [filteredMachines, searchQuery]);

  const [isHistorySheetOpen, setHistorySheetOpen] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);




  useHotkeys([
    {
      key: "f2",
      callback: () => {
        setMachineToPos(null);
        setPosDialogOpen(true);
      }
    }
  ]);

  const handleCardAction = useCallback((machine: Station) => {
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
        stationId: machineId,
        station: machine,
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
  }, [accessibleMachines, firestore, isProcessingPayment, user?.uid, user?.email, selectedLocationId, toast, handlePosDialogChange, userProfile]);

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
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Local Actual</p>
        <div className="text-sm font-bold px-1 py-2 text-foreground">
          {selectedLocationName || 'Local Principal'}
        </div>
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
    <>
      <div className="flex flex-col h-full w-full p-4 lg:p-6 gap-6 bg-zinc-950">
      {/* Barra de Control Omnibar Superior */}
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-3">
        
        {/* Lado Izquierdo: Buscador */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            id="omnibar-search"
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar Estación o Jugador..."
            className="pl-9 h-9 bg-zinc-950/50 border-zinc-800 focus-visible:ring-primary/80 text-zinc-200 text-xs rounded-lg"
          />
        </div>

        {/* Lado Derecho: Hero Metrics */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-3 py-1.5">
            <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase">En Uso:</span>
            <span className="text-xs font-black font-mono text-slate-100">{activeMachines}/{visibleMachines.length}</span>
          </div>

          <div className="flex items-center gap-2 bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-3 py-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase">Alertas:</span>
            <span className="text-xs font-black font-mono text-slate-100">{inventoryAlerts.length}</span>
          </div>
        </div>
      </header>

      {/* Área Expansiva para el Grid */}
      <div className="flex-1 w-full overflow-y-auto custom-scrollbar min-h-0">
        <PCGrid machines={finalFilteredMachines} onCardAction={handleCardAction} isLoading={isLoading} />
      </div>

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
        onConfirmPayment={handleConfirmPayment}
        isProcessingPayment={isProcessingPayment}
        inventoryByProduct={inventoryByProduct}
        fractionMinutes={locations?.find((loc: Location) => loc.id === (machineToPos?.locationId || selectedLocationId))?.fractionMinutes || 5}
      />
      </div>
    </>
  );
}
