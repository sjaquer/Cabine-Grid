"use client";

import { useMemo, useState } from "react";
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

type InventoryDoc = {
  id: string;
  locationId: string;
  productId: string;
  productName?: string;
  stock?: number;
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

  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

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

  const locationsQuery = useMemoFirebase(() => query(collection(firestore, "locations")), [firestore]);
  const productsQuery = useMemoFirebase(() => query(collection(firestore, "products")), [firestore]);
  const inventoryQuery = useMemoFirebase(() => query(collection(firestore, "inventory")), [firestore]);

  const { data: locationsData } = useCollection<Omit<Location, "id">>(locationsQuery);
  const { data: productsData } = useCollection<Omit<Product, "id">>(productsQuery);
  const { data: inventoryData } = useCollection<Omit<InventoryDoc, "id">>(inventoryQuery);

  const locations = useMemo(
    () =>
      (locationsData ?? [])
        .filter((location) => location.isActive !== false)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [locationsData]
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

    return products.map((product) => {
      const key = `${selectedLocationId}_${product.id}`;
      const inv = inventoryMap.get(key);
      const stock = typeof inv?.stock === "number" ? inv.stock : Math.max(0, product.stock ?? 0);
      const minStock = typeof inv?.minStock === "number" ? inv.minStock : 5;

      return {
        productId: product.id,
        productName: product.name,
        category: product.category,
        categoryLabel: categoryLabels[product.category],
        stock,
        minStock,
      };
    });
  }, [products, inventoryMap, selectedLocationId]);

  const rows = useMemo(() => {
    if (!searchTerm.trim()) return allRows;
    const q = searchTerm.toLowerCase();
    return allRows.filter(
      (row) =>
        row.productName.toLowerCase().includes(q) ||
        row.categoryLabel.toLowerCase().includes(q)
    );
  }, [allRows, searchTerm]);

  const canManage =
    userProfile?.role === "admin" ||
    userProfile?.role === "manager" ||
    userProfile?.role === "operator";

  const indicator = (stock: number, minStock: number) => {
    if (stock <= 0)
      return {
        label: "Agotado",
        className: "bg-red-500/20 text-red-700 border-red-300",
      };
    if (stock <= minStock)
      return {
        label: "Stock Bajo",
        className: "bg-amber-500/20 text-amber-700 border-amber-300",
      };
    return {
      label: "Estable",
      className: "bg-green-500/20 text-green-700 border-green-300",
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
      const movementRef = doc(collection(firestore, "inventoryMovements"));

      const result = await runTransaction(firestore, async (transaction) => {
        const snapshot = await transaction.get(inventoryRef);
        const currentStock = snapshot.exists()
          ? Number(snapshot.data().stock ?? 0)
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
            stock: nextStock,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        transaction.set(movementRef, {
          locationId: selectedLocationId,
          locationName: selectedLocation?.name ?? "",
          productId: row.productId,
          productName: row.productName,
          type,
          quantity: safeQty,
          note: note.trim(),
          source: "manual",
          createdAt: serverTimestamp(),
          operator: {
            id: user?.uid ?? null,
            email: user?.email ?? null,
          },
        });

        return { currentStock, nextStock };
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
      setIsDiscrepancyOpen(false);
      toast({ title: "Incongruencia registrada" });
    } catch (error) {
      console.error("Error reporting discrepancy:", error);
      toast({ variant: "destructive", title: "No se pudo registrar la incongruencia" });
    } finally {
      setIsSavingDiscrepancy(false);
    }
  };

  const outOfStockCount = allRows.filter((row) => row.stock <= 0).length;
  const lowStockCount = allRows.filter((row) => row.stock > 0 && row.stock <= row.minStock).length;
  const healthyCount = allRows.filter((row) => row.stock > row.minStock).length;

  return (
    <RoleGuard>
      <div className="min-h-screen bg-gradient-to-br from-secondary via-secondary to-secondary/80">
        {/* Header Profesional */}
        <header className="sticky top-0 z-50 border-b border-border/40 bg-card/95 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center">
                    <Package className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <span className="font-headline font-bold text-lg">Cabine Grid</span>
                </div>
                <div className="hidden lg:block h-6 w-px bg-border/50"></div>
                <div className="flex flex-col gap-0.5">
                  <h1 className="text-xl font-headline font-bold">Gestión de Inventario</h1>
                  <p className="text-xs text-muted-foreground">Control de stock por local</p>
                </div>
              </div>
              <Link href="/">
                <Button variant="outline" size="sm" className="gap-2 h-9">
                  <Home className="w-4 h-4" />
                  <span className="hidden md:inline">Dashboard</span>
                </Button>
              </Link>
            </div>

            {/* Stats rápidas en el header */}
            <div className="grid grid-cols-3 gap-2 py-4 border-t border-border/30">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-background/50 border border-border/30">
                <div className="rounded bg-red-500/15 p-1.5 flex-shrink-0">
                  <Ban className="w-4 h-4 text-red-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Agotados</p>
                  <p className="text-sm font-bold text-red-600">{outOfStockCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-background/50 border border-border/30">
                <div className="rounded bg-amber-500/15 p-1.5 flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">Stock Bajo</p>
                  <p className="text-sm font-bold text-amber-600">{lowStockCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-background/50 border border-border/30">
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
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Tarjetas de Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InventoryStatCard
              title="Productos Agotados"
              value={outOfStockCount}
              icon={<Ban className="w-5 h-5" />}
              color="text-red-600"
              bgColor="bg-red-500/10"
              borderColor="border-red-300/30"
            />
            <InventoryStatCard
              title="Stock Bajo"
              value={lowStockCount}
              icon={<AlertCircle className="w-5 h-5" />}
              color="text-amber-600"
              bgColor="bg-amber-500/10"
              borderColor="border-amber-300/30"
            />
            <InventoryStatCard
              title="Stock Estable"
              value={healthyCount}
              icon={<CheckCircle2 className="w-5 h-5" />}
              color="text-green-600"
              bgColor="bg-green-500/10"
              borderColor="border-green-300/30"
            />
          </div>

          {/* Filtros y Búsqueda */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" /> Filtros y Búsqueda
              </CardTitle>
              <CardDescription>
                Selecciona local y busca productos para gestionar stock
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Local</Label>
                  <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecciona local" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Buscar Producto</Label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9"
                      placeholder="Bebidas, snacks, productos..."
                    />
                  </div>
                </div>
              </div>

              {!canManage && (
                <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-300/50">
                  <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <span className="text-xs text-amber-700">Tu rol permite solo lectura del inventario</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabla de Inventario */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="w-5 h-5" /> 
                Stock Actual {selectedLocation ? <Badge variant="secondary">{selectedLocation.name}</Badge> : null}
              </CardTitle>
              <CardDescription>
                Gestiona stock con ajustes rápidos, reporta incongruencias
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedLocationId ? (
                <div className="py-12 text-center">
                  <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Selecciona un local para ver su inventario</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="py-12 text-center">
                  <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No hay productos que coincidan con la búsqueda</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-border/50 rounded-lg">
                  <Table>
                    <TableHeader className="bg-background/50">
                      <TableRow className="border-border/50 hover:bg-background/50">
                        <TableHead className="font-semibold">Producto</TableHead>
                        <TableHead className="font-semibold">Categoría</TableHead>
                        <TableHead className="text-right font-semibold">Stock</TableHead>
                        <TableHead className="text-right font-semibold">Mín.</TableHead>
                        <TableHead className="font-semibold">Estado</TableHead>
                        <TableHead className="font-semibold">Ajuste Rápido</TableHead>
                        <TableHead className="text-right font-semibold">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const status = indicator(row.stock, row.minStock);
                        return (
                          <TableRow key={row.productId} className="border-border/30 hover:bg-background/30 transition-colors">
                            <TableCell className="font-medium text-sm">{row.productName}</TableCell>
                            <TableCell>
                              <Badge className={`${categoryStyles[row.category]} border text-xs`}>
                                {row.categoryLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-sm">{row.stock}</TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground text-sm">{row.minStock}</TableCell>
                            <TableCell>
                              <Badge className={`${status.className} border text-xs`}>{status.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  disabled={!canManage || !selectedLocationId || busyActionKey !== null}
                                  onClick={() => applyInventoryAdjustment(row, "entry", 1, "Ajuste rápido +1")}
                                  title="Agregar 1 unidad"
                                >
                                  <TrendingUp className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  disabled={!canManage || !selectedLocationId || row.stock <= 0 || busyActionKey !== null}
                                  onClick={() => applyInventoryAdjustment(row, "exit", 1, "Ajuste rápido -1")}
                                  title="Restar 1 unidad"
                                >
                                  <TrendingDown className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="gap-1 h-8 text-xs"
                                  disabled={!canManage || !selectedLocationId}
                                  onClick={() => openAdjustDialog(row)}
                                >
                                  <PlusCircle className="w-3 h-3" />
                                  <span className="hidden sm:inline">Ajustar</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 h-8 text-xs"
                                  onClick={() => openDiscrepancyDialog(row)}
                                  disabled={!canManage}
                                  title="Reportar diferencia"
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
    </RoleGuard>
  );
}

// Componente para Tarjeta de Estadística de Inventario
function InventoryStatCard({
  title,
  value,
  icon,
  color,
  bgColor,
  borderColor,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <Card className={`border-border/50 hover:shadow-lg transition-all ${borderColor}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
          <div className={`p-3 rounded-lg ${bgColor} text-center flex-shrink-0`}>
            <span className={`flex items-center justify-center ${color}`}>{icon}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
