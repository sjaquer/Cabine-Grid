import { useState, useEffect, useMemo } from "react";
import { query, collection, where, Timestamp, doc, writeBatch } from "firebase/firestore";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { setShiftLocation } from "@/lib/shift-session";
import { useAccessibleMachines } from "@/hooks/useMachineAccess";
import type { Station, Location, Product, Customer, Inventory, Sale } from "@/lib/types";

export function useDashboardData() {
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();

  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  const stationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (selectedLocationId) {
      return query(collection(firestore, "stations"), where("locationId", "==", selectedLocationId));
    }
    return query(collection(firestore, "stations"));
  }, [firestore, selectedLocationId]);
  
  const { data: stationsData, isLoading: stationsLoading } = useCollection<Omit<Station, 'id'>>(stationsQuery);

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

  const stations = useMemo(() => {
    if (!stationsData) return [];
    return [...stationsData].sort((a, b) => {
      const numA = parseInt(a.name.split(' ')[1] || '0', 10);
      const numB = parseInt(b.name.split(' ')[1] || '0', 10);
      return numA - numB;
    });
  }, [stationsData]);

  // Note: for permissions we still use useAccessibleMachines, but rename in useDashboardData
  const { accessible: accessibleStations } = useAccessibleMachines(stations, userProfile);

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

  const hasStationsWithLocation = useMemo(() => accessibleStations.some((station) => Boolean(station.locationId)), [accessibleStations]);

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

  const visibleStations = useMemo(() => {
    if (!selectedLocationId || !hasStationsWithLocation) {
      return accessibleStations;
    }
    return accessibleStations.filter((station) => station.locationId === selectedLocationId);
  }, [accessibleStations, selectedLocationId, hasStationsWithLocation]);

  const [stationViewFilter, setStationViewFilter] = useState<"active" | "all" | "available">("all");

  const filteredStations = useMemo(() => {
    if (stationViewFilter === "active") {
      return visibleStations.filter((station) => station.status === "occupied" || station.status === "warning");
    }
    if (stationViewFilter === "available") {
      return visibleStations.filter((station) => station.status === "available");
    }
    return visibleStations;
  }, [visibleStations, stationViewFilter]);

  const salesQuery = useMemoFirebase(() => {
    if (!user) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = Timestamp.fromDate(today);
    if (selectedLocationId) {
      return query(
        collection(firestore, "sales"),
        where("endTime", ">=", startOfToday),
        where("locationId", "==", selectedLocationId)
      );
    }
    return query(collection(firestore, "sales"), where("endTime", ">=", startOfToday));
  }, [firestore, user, selectedLocationId]);

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

  // Prepaid station time warning interval
  useEffect(() => {
    if (stationsLoading || !firestore) return;
    
    const interval = setInterval(() => {
      stations.forEach(s => {
        if (s.session?.usageMode === 'prepaid' && (s.status === 'occupied' || s.status === 'warning')) {
            const { startTime, prepaidHours } = s.session;
            const prepaidSeconds = (prepaidHours || 0) * 3600;
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const remainingSeconds = prepaidSeconds - elapsedSeconds;

            if (remainingSeconds <= 300 && remainingSeconds > 0 && s.status !== 'warning') {
              const stationRef = doc(firestore, 'stations', s.id);
              const batch = writeBatch(firestore);
              batch.update(stationRef, { status: 'warning' });
              batch.commit().catch(e => console.error("Error updating station status:", e));
            } else if (remainingSeconds > 300 && s.status === 'warning') {
              const stationRef = doc(firestore, 'stations', s.id);
              const batch = writeBatch(firestore);
              batch.update(stationRef, { status: 'occupied' });
              batch.commit().catch(e => console.error("Error updating station status:", e));
            }
        }
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [stations, firestore, stationsLoading]);

  return {
    stations,
    accessibleStations,
    visibleStations,
    filteredStations,
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
    isLoading: stationsLoading || locationsLoading || productsLoading || customersLoading || inventoryLoading,
    stationViewFilter,
    setStationViewFilter,
    firestore,
    user,
    userProfile,
  };
}
