import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { query, collection, where, Timestamp, getDocs } from "firebase/firestore";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { setShiftLocation } from "@/lib/shift-session";
import { useAccessibleMachines } from "@/hooks/useMachineAccess";
import type { Station, Location, Product, Customer, Inventory, Sale } from "@/lib/types";

export function useDashboardData() {
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();

  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  // ─── DEBOUNCED location for queries ───────────────────────────────
  // Prevents rapid listener teardown/setup when location changes quickly,
  // which causes Firestore SDK INTERNAL ASSERTION FAILED errors.
  const [debouncedLocationId, setDebouncedLocationId] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLocationId(selectedLocationId);
    }, 150); // 150ms debounce — fast enough to feel instant, slow enough to batch
    return () => clearTimeout(timer);
  }, [selectedLocationId]);

  // ─── STATIONS: Real-time listener (critical) ─────────────────────
  const stationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (debouncedLocationId) {
      return query(collection(firestore, "stations"), where("locationId", "==", debouncedLocationId));
    }
    return query(collection(firestore, "stations"));
  }, [firestore, debouncedLocationId]);
  
  const { data: stationsData, isLoading: stationsLoading } = useCollection<Omit<Station, 'id'>>(stationsQuery);

  // ─── LOCATIONS: Fetch once + cache (changes ~never) ──────────────
  const [locationsData, setLocationsData] = useState<Location[] | null>(null);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const locationsFetchedRef = useRef(false);

  useEffect(() => {
    if (!firestore || locationsFetchedRef.current) return;
    locationsFetchedRef.current = true;

    getDocs(query(collection(firestore, "locations")))
      .then((snap) => {
        const locs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Location));
        setLocationsData(locs);
      })
      .catch((e) => console.error("Error fetching locations:", e))
      .finally(() => setLocationsLoading(false));
  }, [firestore]);

  // ─── PRODUCTS: Fetch once + cache (changes ~rarely) ──────────────
  const [productsData, setProductsData] = useState<Product[] | null>(null);
  const [productsLoading, setProductsLoading] = useState(true);
  const productsFetchedRef = useRef(false);

  useEffect(() => {
    if (!firestore || productsFetchedRef.current) return;
    productsFetchedRef.current = true;

    getDocs(query(collection(firestore, "products")))
      .then((snap) => {
        const prods = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
        setProductsData(prods);
      })
      .catch((e) => console.error("Error fetching products:", e))
      .finally(() => setProductsLoading(false));
  }, [firestore]);

  // Expose a manual refresh for products/locations (for admin edits)
  const refreshStaticData = useCallback(() => {
    if (!firestore) return;
    getDocs(query(collection(firestore, "locations")))
      .then((snap) => setLocationsData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Location))));
    getDocs(query(collection(firestore, "products")))
      .then((snap) => setProductsData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product))));
  }, [firestore]);

  // ─── CUSTOMERS: Fetch once + cache (NO real-time listener) ───────
  // Customers change infrequently. The AssignPCDialog searches locally.
  const [customersData, setCustomersData] = useState<Customer[] | null>(null);
  const [customersLoading, setCustomersLoading] = useState(true);
  const customersFetchedRef = useRef(false);

  useEffect(() => {
    if (!firestore || customersFetchedRef.current) return;
    customersFetchedRef.current = true;

    getDocs(query(collection(firestore, "customers")))
      .then((snap) => {
        const custs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
        setCustomersData(custs);
      })
      .catch((e) => console.error("Error fetching customers:", e))
      .finally(() => setCustomersLoading(false));
  }, [firestore]);

  // Expose refresh for customers (after create/edit)
  const refreshCustomers = useCallback(() => {
    if (!firestore) return;
    getDocs(query(collection(firestore, "customers")))
      .then((snap) => setCustomersData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer))));
  }, [firestore]);

  const appendCustomer = useCallback((customer: Customer) => {
    setCustomersData((prev) => prev ? [...prev, customer] : [customer]);
  }, []);

  // ─── INVENTORY: Real-time listener filtered by location ──────────
  const inventoryQuery = useMemoFirebase(() => {
    if (!firestore || !debouncedLocationId) return null;
    return query(
      collection(firestore, "inventory"),
      where("locationId", "==", debouncedLocationId)
    );
  }, [firestore, debouncedLocationId]);

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

  // ─── SALES: Fetch once + manual append after closeSession ────────
  const [salesData, setSalesData] = useState<Sale[] | null>(null);
  const salesFetchedRef = useRef<string | null>(null); // Keyed by date+location

  const salesCacheKey = `${new Date().toDateString()}_${debouncedLocationId}`;
  
  useEffect(() => {
    if (!firestore || !user) return;
    if (salesFetchedRef.current === salesCacheKey) return;
    salesFetchedRef.current = salesCacheKey;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = Timestamp.fromDate(today);
    
    const constraints = [where("endTime", ">=", startOfToday)];
    if (debouncedLocationId) {
      constraints.push(where("locationId", "==", debouncedLocationId));
    }

    getDocs(query(collection(firestore, "sales"), ...constraints))
      .then((snap) => {
        const sales = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
        setSalesData(sales);
      })
      .catch((e) => console.error("Error fetching sales:", e));
  }, [firestore, user, salesCacheKey, debouncedLocationId]);

  // Called after closeSession to append the new sale without re-fetching
  const appendSale = useCallback((sale: Sale) => {
    setSalesData((prev) => prev ? [sale, ...prev] : [sale]);
  }, []);

  // Force-refresh sales (e.g. when another operator closes a session)
  const refreshSales = useCallback(() => {
    salesFetchedRef.current = null; // Invalidate cache
    // Re-trigger by changing the ref
    if (!firestore || !user) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = Timestamp.fromDate(today);
    
    const constraints = [where("endTime", ">=", startOfToday)];
    if (debouncedLocationId) {
      constraints.push(where("locationId", "==", debouncedLocationId));
    }

    getDocs(query(collection(firestore, "sales"), ...constraints))
      .then((snap) => {
        const sales = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
        setSalesData(sales);
      });
  }, [firestore, user, debouncedLocationId]);

  const sortedSales = useMemo(() => 
    salesData ? [...salesData].sort((a, b) => {
      const aMs = (a.endTime as Timestamp)?.toMillis?.() || 0;
      const bMs = (b.endTime as Timestamp)?.toMillis?.() || 0;
      return bMs - aMs;
    }) : [], 
    [salesData]
  );

  const visibleSales = useMemo(() => {
    if (!selectedLocationId) return sortedSales;
    const hasSalesWithLocation = sortedSales.some((sale) => Boolean(sale.locationId));
    if (!hasSalesWithLocation) return sortedSales;
    return sortedSales.filter((sale) => sale.locationId === selectedLocationId);
  }, [sortedSales, selectedLocationId]);

  const dailySales = visibleSales.reduce((sum, sale) => sum + sale.amount, 0);

  // ─── PREPAID WARNING: Removed Firestore writes ───────────────────
  // The PCCard component already calculates warning state locally via useTimer.
  // Writing status:'warning' to Firestore was 100% redundant — it caused
  // unnecessary writes AND re-triggered the stations listener for all clients.
  // NOW: Zero Firestore writes for prepaid warnings.

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
    isLoading: stationsLoading || locationsLoading,
    stationViewFilter,
    setStationViewFilter,
    firestore,
    user,
    userProfile,
    // New Phase 2 utilities
    appendSale,
    refreshSales,
    refreshCustomers,
    refreshStaticData,
    appendCustomer,
  };
}
