"use client";

export const dynamic = 'force-dynamic';

import { useMemo, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import RoleGuard from "@/components/auth/RoleGuard";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import type { Location, Product } from "@/lib/types";
import {
  addDoc,
  collection,
  doc,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import {
  ArrowLeft,
  AlertTriangle,
  PlusCircle,
  MinusCircle,
  RefreshCw,
  Search,
  Boxes,
  AlertCircle,
  CheckCircle2,
  Ban,
  Package,
  TrendingDown,
  TrendingUp,
  Home,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { logAuditAction } from "@/lib/audit-log";
import { logInventoryMovement } from "@/lib/services/inventory-log";

type InventoryDoc = {
  id: string;
  locationId: string;
  productId: string;
  productName?: string;
  currentStock?: number;
  minStock?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type InventoryDiscrepancyPayload = {
  productId: string;
  productName: string;
  locationId: string;
  systemStock: number;
};

const categoryLabels: Record<Product["category"], string> = {
  drink: "Bebidas",
  snack: "Snacks",
  food: "Comidas",
  other: "Servicios y Otros",
};

const categoryStyles: Record<Product["category"], string> = {
  drink: "bg-sky-500/15 text-sky-700 border-sky-300",
  snack: "bg-amber-500/15 text-amber-700 border-amber-300",
  food: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
  other: "bg-slate-500/15 text-slate-700 border-slate-300",
};

export default function InventoryPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const operatorLocationIds = userProfile?.role === "operator" ? (userProfile.locationIds ?? []) : [];

  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustingRow, setAdjustingRow] = useState<{
    productId: string;
    productName: string;
    stock: number;
    minStock: number;
  } | null>(null);
  const [adjustType, setAdjustType] = useState<"entry" | "exit">("entry");
  const [adjustQty, setAdjustQty] = useState<string>("1");
  const [adjustNote, setAdjustNote] = useState<string>("");
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);

  const [isDiscrepancyOpen, setIsDiscrepancyOpen] = useState(false);
  const [discrepancyData, setDiscrepancyData] = useState<InventoryDiscrepancyPayload | null>(null);
  const [countedStock, setCountedStock] = useState<string>("0");
  const [discrepancyNote, setDiscrepancyNote] = useState<string>("");
  const [isSavingDiscrepancy, setIsSavingDiscrepancy] = useState(false);

  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState<string>("");
  const [newCostPrice, setNewCostPrice] = useState<string>("");
  const [newStock, setNewStock] = useState<string>("0");
  const [newMinStock, setNewMinStock] = useState<string>("5");
  const [newCategory, setNewCategory] = useState<string>("snack");
  const [newSupplierInfo, setNewSupplierInfo] = useState("");
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [isScannerMode, setIsScannerMode] = useState(false);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  const locationsQuery = useMemoFirebase(() => query(collection(firestore, "locations")), [firestore]);
  const productsQuery = useMemoFirebase(() => query(collection(firestore, "products")), [firestore]);
  const inventoryQuery = useMemoFirebase(() => query(collection(firestore, "inventory")), [firestore]);

  const { data: locationsData } = useCollection<Omit<Location, "id">>(locationsQuery);
  const { data: productsData } = useCollection<Omit<Product, "id">>(productsQuery);
  const { data: inventoryData } = useCollection<Omit<InventoryDoc, "id">>(inventoryQuery);

  const locations = useMemo(
    () => {
      const base = (locationsData ?? []).filter((location) => location.isActive !== false);
      const scoped = userProfile?.role === "operator"
        ? base.filter((location) => operatorLocationIds.includes(location.id))
        : base;
      return scoped.sort((a, b) => a.name.localeCompare(b.name));
    },
    [locationsData, userProfile?.role, operatorLocationIds]
  );

  const products = useMemo(
    () =>
      (productsData ?? [])
        .filter((product) => product.isActive !== false)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [productsData]
  );

  const inventoryMap = useMemo(() => {
    const map = new Map<string, InventoryDoc>();
    (inventoryData ?? []).forEach((item) => {
      map.set(`${item.locationId}_${item.productId}`, item as InventoryDoc);
    });
    return map;
  }, [inventoryData]);

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId]
  );

  const allRows = useMemo(() => {
    if (!selectedLocationId) return [];

    const mapped = products.map((product) => {
      const key = `${selectedLocationId}_${product.id}`;
      const inv = inventoryMap.get(key);
      const stock = typeof inv?.currentStock === "number" ? inv.currentStock : Math.max(0, product.stock ?? 0);
      const minStock = typeof inv?.minStock === "number" ? inv.minStock : (product.minStock || 5);

      return {
        productId: product.id,
        productName: product.name,
        price: product.price || 0,
        costPrice: product.costPrice || 0,
        category: product.category,
        categoryLabel: categoryLabels[product.category] || product.category,
        stock,
        minStock,
      };
    });

    return mapped.sort((a, b) => {
      const aLow = a.stock <= a.minStock ? 0 : 1;
      const bLow = b.stock <= b.minStock ? 0 : 1;
      if (aLow !== bLow) return aLow - bLow;
      return a.productName.localeCompare(b.productName);
    });
  }, [products, inventoryMap, selectedLocationId]);

  const rows = useMemo(() => {
    let base = allRows;

    if (selectedCategory !== "all") {
      base = base.filter((row) => row.category === selectedCategory);
    }

    if (!searchTerm.trim()) return base;
    const q = searchTerm.toLowerCase();
    return base.filter(
      (row) =>
        row.productName.toLowerCase().includes(q) ||
        row.categoryLabel.toLowerCase().includes(q)
    );
  }, [allRows, searchTerm, selectedCategory]);

  const canManage =
    userProfile?.role === "admin" ||
    userProfile?.role === "manager" ||
    userProfile?.role === "operator";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canManage || !selectedLocationId) return;
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        isAdjustOpen ||
        isDiscrepancyOpen ||
        isNewProductOpen
      ) {
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedRowIndex((prev) => (prev < rows.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedRowIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "+") {
        if (selectedRowIndex >= 0 && selectedRowIndex < rows.length) {
          e.preventDefault();
          const row = rows[selectedRowIndex];
          applyInventoryAdjustment(row, "entry", 1, "Ajuste rápido +1");
        }
      } else if (e.key === "-") {
        if (selectedRowIndex >= 0 && selectedRowIndex < rows.length) {
          e.preventDefault();
          const row = rows[selectedRowIndex];
          if (row.stock > 0) {
            applyInventoryAdjustment(row, "exit", 1, "Ajuste rápido -1");
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRowIndex, rows, canManage, selectedLocationId, isAdjustOpen, isDiscrepancyOpen, isNewProductOpen]);

  useEffect(() => {
    if (!isScannerMode) return;

    const interval = setInterval(() => {
      if (
        document.activeElement !== scannerInputRef.current &&
        !isAdjustOpen &&
        !isDiscrepancyOpen &&
        !isNewProductOpen
      ) {
        scannerInputRef.current?.focus();
      }
    }, 800);

    return () => clearInterval(interval);
  }, [isScannerMode, isAdjustOpen, isDiscrepancyOpen, isNewProductOpen]);

  const indicator = (stock: number, minStock: number) => {
    if (stock <= 3)
      return {
        label: "Crítico",
        className: "bg-destructive/10 text-destructive border-destructive/50 animate-pulse",
      };
    if (stock <= 10)
      return {
        label: "Stock Bajo",
        className: "bg-amber-500/10 text-amber-500 border-amber-500/50",
      };
    return {
      label: "Estable",
      className: "text-muted-foreground border-transparent",
    };
  };

  const applyInventoryAdjustment = async (
    row: { productId: string; productName: string; stock: number; minStock: number },
    type: "entry" | "exit",
    qty: number,
    note: string
  ) => {
    if (!canManage) return;
    if (!selectedLocationId) return;

    const safeQty = Math.max(1, Math.floor(qty || 0));

    const actionKey = `${row.productId}:${type}:${safeQty}`;
    setBusyActionKey(actionKey);

    try {
      const inventoryRef = doc(firestore, "inventory", `${selectedLocationId}_${row.productId}`);

      const result = await runTransaction(firestore, async (transaction) => {
        const snapshot = await transaction.get(inventoryRef);
        const currentStock = snapshot.exists()
          ? Number(snapshot.data().currentStock ?? 0)
          : Math.max(0, row.stock);

        const nextStock = type === "entry"
          ? currentStock + safeQty
          : currentStock - safeQty;

        if (nextStock < 0) {
          throw new Error(`Stock insuficiente. Disponible: ${currentStock}.`);
        }

        transaction.set(
          inventoryRef,
          {
            locationId: selectedLocationId,
            productId: row.productId,
            productName: row.productName,
            minStock: row.minStock,
            currentStock: nextStock,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        return { currentStock, nextStock };
      });

      // Fase 4: Registro de Kardex de Movimientos
      await logInventoryMovement(firestore, {
        locationId: selectedLocationId,
        locationName: selectedLocation?.name ?? "",
        productId: row.productId,
        productName: row.productName,
        type,
        quantity: safeQty,
        previousStock: result.currentStock,
        currentStock: result.nextStock,
        note: note.trim(),
        operator: {
          id: user?.uid ?? null,
          email: user?.email ?? null,
          role: userProfile?.role ?? null,
        },
        source: "manual",
      });

      await logAuditAction(firestore, {
        action: "inventory.adjust",
        target: "inventory",
        targetId: `${selectedLocationId}_${row.productId}`,
        locationId: selectedLocationId,
        actor: { id: user?.uid, email: user?.email, role: userProfile?.role },
        details: {
          movementType: type,
          quantity: safeQty,
          note: note.trim(),
          currentStock: result.currentStock,
          nextStock: result.nextStock,
        },
      });

      toast({
        title: "Inventario actualizado",
        description: `${row.productName}: ${result.currentStock} -> ${result.nextStock}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al actualizar inventario";
      toast({ variant: "destructive", title: message });
    } finally {
      setBusyActionKey(null);
    }
  };

  const openAdjustDialog = (row: { productId: string; productName: string; stock: number; minStock: number }) => {
    setAdjustingRow(row);
    setAdjustType("entry");
    setAdjustQty("1");
    setAdjustNote("");
    setIsAdjustOpen(true);
  };

  const submitAdjustDialog = async () => {
    if (!adjustingRow) return;
    const qty = Math.max(1, Math.floor(Number(adjustQty) || 0));
    await applyInventoryAdjustment(adjustingRow, adjustType, qty, adjustNote);
    setIsAdjustOpen(false);
  };

  const openDiscrepancyDialog = (row: { productId: string; productName: string; stock: number }) => {
    if (!selectedLocationId) return;
    setDiscrepancyData({
      productId: row.productId,
      productName: row.productName,
      locationId: selectedLocationId,
      systemStock: row.stock,
    });
    setCountedStock(String(row.stock));
    setDiscrepancyNote("");
    setIsDiscrepancyOpen(true);
  };

  const saveDiscrepancy = async () => {
    if (!discrepancyData || !canManage) return;

    const counted = Math.max(0, Math.floor(Number(countedStock) || 0));
    const difference = counted - discrepancyData.systemStock;

    try {
      setIsSavingDiscrepancy(true);
      await addDoc(collection(firestore, "inventoryDiscrepancies"), {
        locationId: discrepancyData.locationId,
        locationName: selectedLocation?.name ?? "",
        productId: discrepancyData.productId,
        productName: discrepancyData.productName,
        systemStock: discrepancyData.systemStock,
        countedStock: counted,
        difference,
        note: discrepancyNote.trim(),
        status: "open",
        createdAt: serverTimestamp(),
        reportedBy: {
          id: user?.uid ?? null,
          email: user?.email ?? null,
        },
      });
      await logAuditAction(firestore, {
        action: "inventory.discrepancy.report",
        target: "inventoryDiscrepancies",
        targetId: `${discrepancyData.locationId}_${discrepancyData.productId}`,
        locationId: discrepancyData.locationId,
        actor: { id: user?.uid, email: user?.email, role: userProfile?.role },
        details: {
          systemStock: discrepancyData.systemStock,
          countedStock: counted,
          difference,
          note: discrepancyNote.trim(),
        },
      });

      // Fase 4: Registro de Kardex de Movimientos para Incongruencias
      await logInventoryMovement(firestore, {
        locationId: discrepancyData.locationId,
        locationName: selectedLocation?.name ?? "",
        productId: discrepancyData.productId,
        productName: discrepancyData.productName,
        type: "discrepancy",
        quantity: Math.abs(difference),
        previousStock: discrepancyData.systemStock,
        currentStock: counted,
        note: `Auditoría: Diferencia de ${difference}. ${discrepancyNote.trim()}`,
        operator: {
          id: user?.uid ?? null,
          email: user?.email ?? null,
          role: userProfile?.role ?? null,
        },
        source: "audit",
      });

      setIsDiscrepancyOpen(false);
      toast({ title: "Incongruencia registrada" });
    } catch (error) {
      console.error("Error reporting discrepancy:", error);
      toast({ variant: "destructive", title: "No se pudo registrar la incongruencia" });
    } finally {
      setIsSavingDiscrepancy(false);
    }
  };

  const handleCreateProduct = async () => {
    if (!canManage) return;
    if (!newName.trim()) {
      toast({ variant: "destructive", title: "El nombre es requerido" });
      return;
    }
    const priceNum = Math.max(0, Number(newPrice) || 0);
    const costPriceNum = Math.max(0, Number(newCostPrice) || 0);
    const stockNum = Math.max(0, Math.floor(Number(newStock) || 0));
    const minStockNum = Math.max(0, Math.floor(Number(newMinStock) || 0));

    try {
      setIsCreatingProduct(true);
      const productRef = await addDoc(collection(firestore, "products"), {
        name: newName.trim(),
        price: priceNum,
        costPrice: costPriceNum,
        stock: stockNum,
        minStock: minStockNum,
        category: newCategory,
        supplierInfo: newSupplierInfo.trim(),
        isActive: true,
        createdAt: serverTimestamp(),
      });

      if (selectedLocationId) {
        const invRef = doc(firestore, "inventory", `${selectedLocationId}_${productRef.id}`);
        await runTransaction(firestore, async (transaction) => {
          transaction.set(invRef, {
            locationId: selectedLocationId,
            productId: productRef.id,
            productName: newName.trim(),
            minStock: minStockNum,
            currentStock: stockNum,
            updatedAt: serverTimestamp(),
          });
        });

        // Fase 4: Registro de Kardex de Movimientos para Stock Inicial
        if (stockNum > 0) {
          await logInventoryMovement(firestore, {
            locationId: selectedLocationId,
            locationName: selectedLocation?.name ?? "",
            productId: productRef.id,
            productName: newName.trim(),
            type: "entry",
            quantity: stockNum,
            previousStock: 0,
            currentStock: stockNum,
            note: "Stock inicial de creación",
            operator: {
              id: user?.uid ?? null,
              email: user?.email ?? null,
              role: userProfile?.role ?? null,
            },
            source: "manual",
          });
        }
      }

      await logAuditAction(firestore, {
        action: "inventory.product.create",
        target: "products",
        targetId: productRef.id,
        actor: { id: user?.uid, email: user?.email, role: userProfile?.role },
        details: {
          name: newName.trim(),
          price: priceNum,
          costPrice: costPriceNum,
          stock: stockNum,
          category: newCategory,
        },
      });

      toast({ title: "Producto creado exitosamente" });
      setNewName("");
      setNewPrice("");
      setNewCostPrice("");
      setNewStock("0");
      setNewMinStock("5");
      setNewCategory("snack");
      setNewSupplierInfo("");
      setIsNewProductOpen(false);
    } catch (error) {
      console.error("Error creating product:", error);
      toast({ variant: "destructive", title: "No se pudo crear el producto" });
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const outOfStockCount = allRows.filter((row) => row.stock <= 0).length;
  const lowStockCount = allRows.filter((row) => row.stock > 0 && row.stock <= row.minStock).length;
  const healthyCount = allRows.filter((row) => row.stock > row.minStock).length;
  const priorityRows = useMemo(
    () =>
      allRows
        .filter((row) => row.stock <= row.minStock)
        .sort((a, b) => {
          const aCritical = a.stock <= 0 ? 0 : 1;
          const bCritical = b.stock <= 0 ? 0 : 1;
          if (aCritical !== bCritical) return aCritical - bCritical;
          return a.stock - b.stock;
        })
        .slice(0, 6),
    [allRows]
  );

  return (
    <RoleGuard>
      <div className="app-shell app-enter">
        {/* Header Profesional */}
        <header className="app-sticky-header">
          <div className="app-container">
            <div className="app-header-row">
              <div className="flex items-center gap-3">
                <div className="brand-chip">
                  <div className="brand-chip-icon">
                    <Package className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="font-headline font-bold text-lg">Cabine Grid</span>
                </div>
                <div className="hidden lg:block h-6 w-px bg-border/50"></div>
                <div className="flex flex-col gap-0.5">
                  <h1 className="text-xl font-headline font-bold">Gestión de Inventario</h1>
                  <p className="text-xs text-muted-foreground">Control de stock por local</p>
                </div>
              </div>
            </div>

            {/* Stats rápidas en el header */}
            <div className="kpi-strip grid-cols-3 gap-2">
              <div className="surface-stat">
                <div className="rounded bg-red-500/15 p-1.5 flex-shrink-0">
                  <Ban className="w-4 h-4 text-red-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Agotados</p>
                  <p className="text-sm font-bold text-red-600">{outOfStockCount}</p>
                </div>
              </div>
              <div className="surface-stat">
                <div className="rounded bg-amber-500/15 p-1.5 flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Stock Bajo</p>
                  <p className="text-sm font-bold text-amber-600">{lowStockCount}</p>
                </div>
              </div>
              <div className="surface-stat">
                <div className="rounded bg-green-500/15 p-1.5 flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Estable</p>
                  <p className="text-sm font-bold text-green-600">{healthyCount}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Contenido Principal */}
        <main className="w-full px-4 py-6 space-y-6">
          {/* Barra superior táctica */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 bg-card/40 border border-border/60 rounded-xl">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="w-full sm:w-[220px]">
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                  <SelectTrigger className="h-10 bg-card/50 border-border text-foreground">
                    <SelectValue placeholder="Selecciona local" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="relative w-full sm:w-[260px]">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  ref={scannerInputRef}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 bg-card/50 border-border text-foreground"
                  placeholder="Buscar producto o código..."
                />
              </div>

              <Button
                variant={isScannerMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsScannerMode(!isScannerMode)}
                className={`h-10 text-xs gap-2 ${
                  isScannerMode
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground border-transparent shadow-[0_0_15px_hsl(var(--primary)/0.3)]"
                    : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Boxes className="w-4 h-4" />
                Escáner: {isScannerMode ? "ON" : "OFF"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
                className={`h-9 text-xs ${selectedCategory === "all" ? "bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                Todos
              </Button>
              <Button
                variant={selectedCategory === "snack" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("snack")}
                className={`h-9 text-xs ${selectedCategory === "snack" ? "bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                Snacks
              </Button>
              <Button
                variant={selectedCategory === "drink" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("drink")}
                className={`h-9 text-xs ${selectedCategory === "drink" ? "bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                Bebidas
              </Button>
              <Button
                variant={selectedCategory === "hardware" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("hardware")}
                className={`h-9 text-xs ${selectedCategory === "hardware" ? "bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                Hardware
              </Button>
              <Button
                variant={selectedCategory === "other" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("other")}
                className={`h-9 text-xs ${selectedCategory === "other" ? "bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                Servicios
              </Button>

              {canManage && (
                <Button
                  onClick={() => setIsNewProductOpen(true)}
                  className="h-9 text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 ml-auto lg:ml-0 text-white font-bold px-4"
                >
                  <PlusCircle className="w-4 h-4" />
                  + Nuevo Producto
                </Button>
              )}
            </div>
          </div>

          {selectedLocationId && priorityRows.length > 0 && (
            <Card className="bg-background border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-amber-500">
                  <AlertTriangle className="w-4 h-4 animate-pulse" /> Alertas de Reposición Crítica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                  {priorityRows.map((row) => {
                    const status = indicator(row.stock, row.minStock);
                    return (
                      <div
                        key={`priority-${row.productId}`}
                        className="rounded-lg border border-border bg-card p-3 flex flex-col justify-between gap-2"
                      >
                        <div>
                          <p className="text-xs font-bold text-foreground truncate">{row.productName}</p>
                          <Badge className={`mt-1 text-[10px] ${status.className}`}>{status.label}</Badge>
                        </div>
                        <div className="flex items-center justify-between mt-2 border-t border-border/50 pt-2">
                          <span className="text-[10px] text-muted-foreground">Stock</span>
                          <span className="font-mono text-xs font-bold text-foreground">{row.stock} / {row.minStock}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}



          {/* Tabla de Inventario */}
          <Card className="border-border bg-card overflow-hidden">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-foreground text-base font-headline">
                <Boxes className="w-4 h-4 text-primary" /> 
                Control de Stock {selectedLocation ? <Badge variant="secondary" className="bg-secondary text-secondary-foreground border-border">{selectedLocation.name}</Badge> : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!selectedLocationId ? (
                <div className="py-16 text-center">
                  <Package className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Selecciona un local para auditar existencias</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="py-16 text-center">
                  <AlertCircle className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Sin coincidencias para este filtro.</p>
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                    <TableHeader className="bg-background border-b border-border">
                      <TableRow className="border-none hover:bg-background">
                        <TableHead className="text-muted-foreground font-semibold px-2 py-2 text-xs">Producto</TableHead>
                        <TableHead className="text-muted-foreground font-semibold px-2 py-2 text-xs">Categoría</TableHead>
                        <TableHead className="text-right text-muted-foreground font-semibold px-2 py-2 text-xs">Stock</TableHead>
                        <TableHead className="text-right text-muted-foreground font-semibold px-2 py-2 text-xs">Mín.</TableHead>
                        {userProfile?.role === "admin" && (
                          <TableHead className="text-right text-muted-foreground font-semibold px-2 py-2 text-xs">Margen</TableHead>
                        )}
                        <TableHead className="text-muted-foreground font-semibold px-2 py-2 text-xs">Estado</TableHead>
                        <TableHead className="text-muted-foreground font-semibold px-2 py-2 text-xs">Ajuste Rápido</TableHead>
                        <TableHead className="text-right text-muted-foreground font-semibold px-2 py-2 text-xs">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, index) => {
                        const status = indicator(row.stock, row.minStock);
                        const margin = row.price - (row.costPrice || 0);
                        const isSelected = index === selectedRowIndex;
                        return (
                          <TableRow 
                            key={row.productId} 
                            className={cn(
                              "border-border transition-colors duration-150 border-b cursor-pointer",
                              isSelected ? "bg-secondary/60 text-foreground ring-1 ring-emerald-500/40 border-emerald-500/50" : "hover:bg-secondary/20 text-secondary-foreground"
                            )}
                            onClick={() => setSelectedRowIndex(index)}
                          >
                            <TableCell className="font-medium text-foreground px-2 py-1 text-xs max-w-[200px] truncate">{row.productName}</TableCell>
                            <TableCell className="px-2 py-1 text-xs">
                              <Badge className={`${categoryStyles[row.category] || "bg-secondary text-secondary-foreground"} text-[10px] px-1.5 py-0.5 border`}>
                                {row.categoryLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-foreground px-2 py-1 text-xs">{row.stock}</TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground px-2 py-1 text-xs">{row.minStock}</TableCell>
                            {userProfile?.role === "admin" && (
                              <TableCell className="text-right font-mono font-bold text-emerald-400 px-2 py-1 text-xs">
                                S/ {margin.toFixed(2)}
                              </TableCell>
                            )}
                            <TableCell className="px-2 py-1 text-xs">
                              <span className={`text-xs px-2 py-0.5 rounded-full border text-[10px] ${status.className}`}>
                                {status.label}
                              </span>
                            </TableCell>
                            <TableCell className="px-2 py-1 text-xs">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-400"
                                  disabled={!canManage || !selectedLocationId || busyActionKey !== null}
                                  onClick={() => applyInventoryAdjustment(row, "entry", 1, "Ajuste rápido +1")}
                                >
                                  <TrendingUp className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:bg-rose-500/20 hover:text-rose-400"
                                  disabled={!canManage || !selectedLocationId || row.stock <= 0 || busyActionKey !== null}
                                  onClick={() => applyInventoryAdjustment(row, "exit", 1, "Ajuste rápido -1")}
                                >
                                  <TrendingDown className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right px-2 py-1">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="gap-1 h-7 text-xs bg-secondary text-secondary-foreground hover:bg-zinc-700 border-border"
                                  disabled={!canManage || !selectedLocationId}
                                  onClick={() => openAdjustDialog(row)}
                                >
                                  <PlusCircle className="w-3 h-3" />
                                  <span className="hidden sm:inline">Ajustar</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 h-7 text-xs border-border hover:bg-secondary text-muted-foreground"
                                  onClick={() => openDiscrepancyDialog(row)}
                                  disabled={!canManage}
                                  title="Auditar diferencia"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 md:hidden">
                    {rows.map((row, index) => {
                      const status = indicator(row.stock, row.minStock);
                      const isSelected = index === selectedRowIndex;
                      return (
                        <div
                          key={`card-${row.productId}`}
                          className={cn(
                            "p-4 bg-card border border-border rounded-xl flex flex-col justify-between gap-4 shadow-sm transition-all duration-150",
                            isSelected ? "ring-2 ring-emerald-500 border-emerald-500/50 bg-secondary/40" : "hover:bg-card/60"
                          )}
                          onClick={() => setSelectedRowIndex(index)}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h4 className="font-headline text-foreground text-sm font-bold tracking-wide">{row.productName}</h4>
                              <Badge className={`${categoryStyles[row.category] || "bg-secondary text-secondary-foreground"} text-[10px] mt-1 px-1.5 py-0.5 border`}>
                                {row.categoryLabel}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <span className="text-muted-foreground text-xs block">Stock actual</span>
                              <span className="font-mono font-bold text-base text-foreground">{row.stock}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-1">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Precio</span>
                              <span className="text-foreground font-semibold text-sm font-mono font-bold">S/ {row.price.toFixed(2)}</span>
                            </div>

                            <Badge className={`${status.className} text-[10px] px-2 py-0.5 border`}>
                              {status.label}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <Button
                              variant="ghost"
                              className="h-12 text-destructive bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 font-bold text-lg rounded-xl"
                              disabled={!canManage || !selectedLocationId || row.stock <= 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                applyInventoryAdjustment(row, "exit", 1, "Ajuste rápido -1");
                              }}
                            >
                              <MinusCircle className="w-5 h-5 mr-1" /> -1
                            </Button>
                            <Button
                              variant="ghost"
                              className="h-12 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 font-bold text-lg rounded-xl"
                              disabled={!canManage || !selectedLocationId}
                              onClick={(e) => {
                                e.stopPropagation();
                                applyInventoryAdjustment(row, "entry", 1, "Ajuste rápido +1");
                              }}
                            >
                              <PlusCircle className="w-5 h-5 mr-1" /> +1
                            </Button>
                          </div>
                          
                          <div className="flex gap-2 mt-1 pt-2 border-t border-zinc-850">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="flex-1 h-9 text-xs bg-secondary text-secondary-foreground hover:bg-zinc-700 border-border"
                              disabled={!canManage || !selectedLocationId}
                              onClick={(e) => {
                                e.stopPropagation();
                                openAdjustDialog(row);
                              }}
                            >
                              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Ajustar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 px-3 border-border hover:bg-secondary text-muted-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDiscrepancyDialog(row);
                              }}
                              disabled={!canManage}
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <Dialog open={isDiscrepancyOpen} onOpenChange={setIsDiscrepancyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar Incongruencia de Inventario</DialogTitle>
            <DialogDescription>
              Registra diferencia entre conteo real y sistema para auditoría de turnos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Producto: <span className="font-medium text-foreground">{discrepancyData?.productName ?? "-"}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Stock sistema: <span className="font-medium text-foreground">{discrepancyData?.systemStock ?? 0}</span>
            </div>
            <div className="space-y-2">
              <Label>Stock contado real</Label>
              <Input type="number" min={0} value={countedStock} onChange={(e) => setCountedStock(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Detalle</Label>
              <Textarea
                value={discrepancyNote}
                onChange={(e) => setDiscrepancyNote(e.target.value)}
                placeholder="Ej. Faltan 3 unidades tras revisión de turno."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDiscrepancyOpen(false)}>Cancelar</Button>
            <Button onClick={saveDiscrepancy} disabled={isSavingDiscrepancy || !canManage} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              {isSavingDiscrepancy ? "Registrando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Stock</DialogTitle>
            <DialogDescription>
              Registra entrada o salida para {adjustingRow?.productName ?? "producto"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Stock actual: <span className="font-medium text-foreground">{adjustingRow?.stock ?? 0}</span>
            </div>

            <div className="space-y-2">
              <Label>Tipo de movimiento</Label>
              <Select value={adjustType} onValueChange={(v) => setAdjustType(v as "entry" | "exit") }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Ingreso</SelectItem>
                  <SelectItem value="exit">Salida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={1}
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Nota (opcional)</Label>
              <Input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="Ej. Reposición proveedor / merma"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustOpen(false)}>Cancelar</Button>
            <Button
              onClick={submitAdjustDialog}
              disabled={!canManage || busyActionKey !== null}
              className="gap-2"
            >
              {adjustType === "entry" ? <PlusCircle className="w-4 h-4" /> : <MinusCircle className="w-4 h-4" />}
              Confirmar ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewProductOpen} onOpenChange={setIsNewProductOpen}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground font-headline">Crear Nuevo Producto</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Ingresa los parámetros iniciales para registrar existencias.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nombre del Producto</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-9 bg-background border-border text-foreground"
                placeholder="Ej: Coca Cola 500ml"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Precio Venta (S/)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="h-9 bg-background border-border text-foreground"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Precio Costo (S/)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newCostPrice}
                  onChange={(e) => setNewCostPrice(e.target.value)}
                  className="h-9 bg-background border-border text-foreground"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Stock Inicial</Label>
                <Input
                  type="number"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  className="h-9 bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Stock Mínimo</Label>
                <Input
                  type="number"
                  value={newMinStock}
                  onChange={(e) => setNewMinStock(e.target.value)}
                  className="h-9 bg-background border-border text-foreground"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Categoría</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="h-9 bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground">
                  <SelectItem value="snack">Snacks</SelectItem>
                  <SelectItem value="drink">Bebidas</SelectItem>
                  <SelectItem value="hardware">Hardware</SelectItem>
                  <SelectItem value="other">Servicios</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Proveedor (Opcional)</Label>
              <Input
                value={newSupplierInfo}
                onChange={(e) => setNewSupplierInfo(e.target.value)}
                className="h-9 bg-background border-border text-foreground"
                placeholder="Ej: Makro"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsNewProductOpen(false)} className="border-border text-muted-foreground hover:bg-secondary hover:text-foreground">
              Cancelar
            </Button>
            <Button
              onClick={handleCreateProduct}
              disabled={isCreatingProduct || !canManage}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              {isCreatingProduct ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  );
}
