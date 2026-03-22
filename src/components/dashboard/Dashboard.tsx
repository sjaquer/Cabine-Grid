"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Customer, Machine, Sale, PaymentMethod, SoldProduct, UserProfile, Session, Location, Product } from "@/lib/types";
import type { Inventory } from "@/lib/types";
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
import { closeSession } from "@/lib/close-session";
import { canAccessMachine, useAccessibleMachines } from "@/hooks/useMachineAccess";
import { useInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, PanelTopClose, PanelTopOpen } from "lucide-react";
import InventoryAlertsDisplay from "./InventoryAlertsDisplay";


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
  const customersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "customers"));
  }, [firestore]);
  const { data: customersData } = useCollection<Omit<Customer, "id">>(customersQuery);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  
  const inventoryQuery = useMemoFirebase(() => {
    if (!firestore || !selectedLocationId) return null;
    return query(
      collection(firestore, "inventory"),
      where("locationId", "==", selectedLocationId)
    );
  }, [firestore, selectedLocationId]);

  const { data: inventoryData } = useCollection<Omit<Inventory, "id">>(inventoryQuery);

  const inventoryByProduct = useMemo(() => {
    const result: Record<string, number> = {};
    if (inventoryData) {
      inventoryData.forEach((item) => {
        result[item.productId] = item.currentStock ?? 0;
      });
    }
    return result;
  }, [inventoryData]);

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

  // Filter machines by user access
  const { accessible: accessibleMachines } = useAccessibleMachines(machines, userProfile);

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

  const customers = useMemo(
    () => (customersData ?? []) as Customer[],
    [customersData]
  );

  const availableLocations = useMemo(() => {
    const profileLocationIds = userProfile?.locationIds;
    const canViewAll = !profileLocationIds || profileLocationIds.length === 0 || userProfile?.role === "admin" || userProfile?.role === "manager";

    if (canViewAll) {
      return locations;
    }

    return locations.filter((location) => profileLocationIds.includes(location.id));
  }, [locations, userProfile?.locationIds, userProfile?.role]);

  const hasMachinesWithLocation = useMemo(() => accessibleMachines.some((machine) => Boolean(machine.locationId)), [accessibleMachines]);

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
      totalAccessibleMachines: accessibleMachines.length,
      selectedLocationId,
      hasMachinesWithLocation,
      machinesLoading,
    });
    
    if (!selectedLocationId || !hasMachinesWithLocation) {
      console.log('DEBUG: Mostrando todas las máquinas accesibles:', accessibleMachines.length);
      return accessibleMachines;
    }

    const filtered = accessibleMachines.filter((machine) => machine.locationId === selectedLocationId);
    console.log('DEBUG: Máquinas filtradas por local:', filtered.length);
    return filtered;
  }, [accessibleMachines, selectedLocationId, hasMachinesWithLocation, machinesLoading]);

  const [isAssignDialogOpen, setAssignDialogOpen] = useState(false);
  const [machineToAssign, setMachineToAssign] = useState<Machine | null>(null);

  const [isChargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [machineToCharge, setMachineToCharge] = useState<Machine | null>(null);
  const [isProcessingPayment, setProcessingPayment] = useState(false);

  const [isPosDialogOpen, setPosDialogOpen] = useState(false);
  const [machineToPos, setMachineToPos] = useState<Machine | null>(null);

  const [isHistorySheetOpen, setHistorySheetOpen] = useState(false);
  const [machineViewFilter, setMachineViewFilter] = useState<"active" | "all" | "available">("active");
  const [isTopPanelHidden, setIsTopPanelHidden] = useState(false);
  
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
  }, [accessibleMachines, firestore, toast, selectedLocationId, user?.uid, user?.email, userProfile]);

  const handleGoToCharge = useCallback((machineId: string) => {
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
    setMachineToCharge(machine);
    setChargeDialogOpen(true);
  }, [accessibleMachines, handlePosDialogChange, toast, userProfile]);

  const availableMachines = visibleMachines.filter(m => m.status === 'available').length;
  const occupiedMachines = visibleMachines.length - availableMachines;
  const filteredMachines = useMemo(() => {
    if (machineViewFilter === "active") {
      return visibleMachines.filter((machine) => machine.status === "occupied" || machine.status === "warning");
    }
    if (machineViewFilter === "available") {
      return visibleMachines.filter((machine) => machine.status === "available");
    }
    return visibleMachines;
  }, [visibleMachines, machineViewFilter]);
  const dailySales = visibleSales.reduce((sum, sale) => sum + sale.amount, 0);

  // Hook para obtener alertas de inventario
  const inventoryAlerts = useInventoryAlerts(inventoryData || []);

  const filterLabel = useMemo(() => {
    if (machineViewFilter === "active") return "Mostrando cabinas activas";
    if (machineViewFilter === "available") return "Mostrando cabinas libres";
    return "Mostrando todas las cabinas";
  }, [machineViewFilter]);

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

      {/* Sección compacta de filtros */}
      <div className="border-b border-border/40 bg-card/80 backdrop-blur-sm">
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isTopPanelHidden ? "py-2" : "py-3"} space-y-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base md:text-lg font-semibold">Cabinas</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs md:text-sm whitespace-nowrap">
                Activas: {occupiedMachines}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsTopPanelHidden((prev) => !prev)}
                className="h-8 px-2.5"
              >
                {isTopPanelHidden ? <PanelTopOpen className="w-4 h-4" /> : <PanelTopClose className="w-4 h-4" />}
                <span className="ml-1 hidden sm:inline">{isTopPanelHidden ? "Mostrar" : "Ocultar"}</span>
              </Button>
            </div>
          </div>

          {isTopPanelHidden ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{filterLabel}</span>
              {selectedLocationId && (
                <Badge variant="secondary" className="text-[11px]">
                  {availableLocations.find((location) => location.id === selectedLocationId)?.name || "Local"}
                </Badge>
              )}
            </div>
          ) : (
            <>
              {/* Filtros rápidos para operación */}
              <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
                <Button
                  size="sm"
                  variant={machineViewFilter === "active" ? "default" : "outline"}
                  onClick={() => setMachineViewFilter("active")}
                  className="whitespace-nowrap"
                >
                  Activas ({occupiedMachines})
                </Button>
                <Button
                  size="sm"
                  variant={machineViewFilter === "available" ? "default" : "outline"}
                  onClick={() => setMachineViewFilter("available")}
                  className="whitespace-nowrap"
                >
                  Libres ({availableMachines})
                </Button>
                <Button
                  size="sm"
                  variant={machineViewFilter === "all" ? "default" : "outline"}
                  onClick={() => setMachineViewFilter("all")}
                  className="whitespace-nowrap"
                >
                  Todas ({visibleMachines.length})
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{filterLabel}</p>

              {/* Alertas de Inventario */}
              {inventoryAlerts.length > 0 && (
                <InventoryAlertsDisplay alerts={inventoryAlerts} maxDisplay={3} />
              )}

              {/* Selección de Local */}
              {availableLocations.length > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 md:p-4 rounded-lg bg-background/50 border border-border/30">
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
            </>
          )}
        </div>
      </div>

      {/* Grid de Máquinas */}
      <main className="flex-1 overflow-y-auto">
        <PCGrid machines={filteredMachines} onCardAction={handleCardAction} isLoading={machinesLoading} />
      </main>
      
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
        inventoryByProduct={inventoryByProduct}
      />
    </div>
  );
}
