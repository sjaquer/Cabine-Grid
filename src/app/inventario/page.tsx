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
  const operatorLocationIds = userProfile?.role === "operator" ? (userProfile.locationIds ?? []) : [];

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

    if (safeQty > 20 && userProfile?.role !== "admin") {
      await addDoc(collection(firestore, "sensitiveApprovals"), {
        type: "inventory.adjust.large",
        status: "pending",
        locationId: selectedLocationId,
        requestedBy: {
          id: user?.uid || null,
          email: user?.email || null,
        },
        payload: {
          locationId: selectedLocationId,
          productId: row.productId,
          productName: row.productName,
          minStock: row.minStock,
          quantity: safeQty,
          type,
        },
        note: note.trim() || `Ajuste ${type} de ${safeQty} requiere aprobación`,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Solicitud enviada", description: "Ajustes mayores a 20 unidades requieren aprobación de admin." });
      return;
    }

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
      <div className="min-h-screen bg-gradient-to-b from-secondary to-secondary/70">
        <div className="border-b border-border/40 bg-card/85 backdrop-blur-lg sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-headline font-bold">Inventario General</h1>
              <p className="text-sm text-muted-foreground">
                Control de stock por local con alertas e incongruencias.
              </p>
            </div>
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Volver al Dashboard
              </Button>
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Productos agotados</div>
                  <div className="text-2xl font-black text-red-600">{outOfStockCount}</div>
                </div>
                <Ban className="w-6 h-6 text-red-500" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Stock bajo</div>
                  <div className="text-2xl font-black text-amber-600">{lowStockCount}</div>
                </div>
                <AlertCircle className="w-6 h-6 text-amber-500" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Stock estable</div>
                  <div className="text-2xl font-black text-green-600">{healthyCount}</div>
                </div>
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="w-5 h-5" /> Operación de Inventario
              </CardTitle>
              <CardDescription>
                Filtra por local, busca productos y ajusta stock con botones rápidos por fila.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="space-y-2 xl:col-span-2">
                <Label>Local</Label>
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                  <SelectTrigger>
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

              <div className="space-y-2 xl:col-span-2">
                <Label>Buscar producto o categoría</Label>
                <div className="relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    placeholder="Ej. Inka, Snacks, Servicios"
                  />
                </div>
              </div>
              <div className="xl:col-span-4 flex items-center justify-end">
                {!canManage && (
                  <span className="text-xs text-amber-700 bg-amber-500/10 border border-amber-300 rounded px-2 py-1">
                    Tu rol es solo lectura.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Stock Actual {selectedLocation ? `- ${selectedLocation.name}` : ""}
              </CardTitle>
              <CardDescription>
                Estado por producto con categorías claras y reporte de incongruencias.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedLocationId ? (
                <div className="text-sm text-muted-foreground">
                  Selecciona un local para visualizar su inventario.
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Mínimo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Ajuste rápido</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const status = indicator(row.stock, row.minStock);
                        return (
                          <TableRow key={row.productId}>
                            <TableCell className="font-medium">{row.productName}</TableCell>
                            <TableCell>
                              <Badge className={`${categoryStyles[row.category]} border`}>
                                {row.categoryLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{row.stock}</TableCell>
                            <TableCell className="text-right font-mono">{row.minStock}</TableCell>
                            <TableCell>
                              <Badge className={`${status.className} border`}>{status.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 flex-wrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  disabled={!canManage || !selectedLocationId || busyActionKey !== null}
                                  onClick={() => applyInventoryAdjustment(row, "entry", 1, "Ajuste rápido +1")}
                                >
                                  +1
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  disabled={!canManage || !selectedLocationId || busyActionKey !== null}
                                  onClick={() => applyInventoryAdjustment(row, "entry", 5, "Ajuste rápido +5")}
                                >
                                  +5
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  disabled={!canManage || !selectedLocationId || row.stock <= 0 || busyActionKey !== null}
                                  onClick={() => applyInventoryAdjustment(row, "exit", 1, "Ajuste rápido -1")}
                                >
                                  -1
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="gap-2"
                                  disabled={!canManage || !selectedLocationId}
                                  onClick={() => openAdjustDialog(row)}
                                >
                                  <PlusCircle className="w-4 h-4" />
                                  Ajustar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => openDiscrepancyDialog(row)}
                                  disabled={!canManage}
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                  Incongruencia
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
        </div>
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
