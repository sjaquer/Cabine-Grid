import { useState, useEffect, useMemo } from "react";
import { query, collection, where, Timestamp, doc, writeBatch } from "firebase/firestore";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { setShiftLocation } from "@/lib/shift-session";
import { useAccessibleMachines } from "@/hooks/useMachineAccess";
import type { Machine, Location, Product, Customer, Inventory, Sale } from "@/lib/types";

export function useDashboardData() {
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

  const { data: locationsData, isLoading: locationsLoading } = useCollection<Omit<Location, "id">>(locationsQuery);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "products"));
  }, [firestore]);

  const { data: productsData, isLoading: productsLoading } = useCollection<Omit<Product, "id">>(productsQuery);

  const customersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "customers"));
  }, [firestore]);

  const { data: customersData, isLoading: customersLoading } = useCollection<Omit<Customer, "id">>(customersQuery);

  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  
  const inventoryQuery = useMemoFirebase(() => {
    if (!firestore || !selectedLocationId) return null;
    return query(
      collection(firestore, "inventory"),
      where("locationId", "==", selectedLocationId)
    );
  }, [firestore, selectedLocationId]);

  const { data: inventoryData, isLoading: inventoryLoading } = useCollection<Omit<Inventory, "id">>(inventoryQuery);

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
    if (!machinesData) return [];
    return [...machinesData].sort((a, b) => {
      const numA = parseInt(a.name.split(' ')[1] || '0', 10);
      const numB = parseInt(b.name.split(' ')[1] || '0', 10);
      return numA - numB;
    });
  }, [machinesData]);

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
    if (!user?.uid || !selectedLocationId) return;
    setShiftLocation(user.uid, selectedLocationId);
  }, [user?.uid, selectedLocationId]);

  const visibleMachines = useMemo(() => {
    if (!selectedLocationId || !hasMachinesWithLocation) {
      return accessibleMachines;
    }
    return accessibleMachines.filter((machine) => machine.locationId === selectedLocationId);
  }, [accessibleMachines, selectedLocationId, hasMachinesWithLocation]);

  const [machineViewFilter, setMachineViewFilter] = useState<"active" | "all" | "available">("active");

  const filteredMachines = useMemo(() => {
    if (machineViewFilter === "active") {
      return visibleMachines.filter((machine) => machine.status === "occupied" || machine.status === "warning");
    }
    if (machineViewFilter === "available") {
      return visibleMachines.filter((machine) => machine.status === "available");
    }
    return visibleMachines;
  }, [visibleMachines, machineViewFilter]);

  const salesQuery = useMemoFirebase(() => {
    if (!user) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = Timestamp.fromDate(today);
    return query(collection(firestore, "sales"), where("endTime", ">=", startOfToday));
  }, [firestore, user]);

  const { data: sales } = useCollection<Sale>(salesQuery);
  
  const sortedSales = useMemo(() => 
    sales ? [...sales].sort((a, b) => (b.endTime as Timestamp).toMillis() - (a.endTime as Timestamp).toMillis()) : [], 
    [sales]
  );

  const visibleSales = useMemo(() => {
    if (!selectedLocationId) return sortedSales;
    const hasSalesWithLocation = sortedSales.some((sale) => Boolean(sale.locationId));
    if (!hasSalesWithLocation) return sortedSales;
    return sortedSales.filter((sale) => sale.locationId === selectedLocationId);
  }, [sortedSales, selectedLocationId]);

  const dailySales = visibleSales.reduce((sum, sale) => sum + sale.amount, 0);

  // Prepaid machine time warning interval
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

  return {
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
    isLoading: machinesLoading || locationsLoading || productsLoading || customersLoading || inventoryLoading,
    machineViewFilter,
    setMachineViewFilter,
    firestore,
    user,
    userProfile,
  };
}
