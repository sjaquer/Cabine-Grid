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
  increment,
  query,
  serverTimestamp,
  writeBatch,
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

  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [movementType, setMovementType] = useState<"entry" | "exit">("entry");
  const [movementQty, setMovementQty] = useState<string>("1");
  const [movementNote, setMovementNote] = useState<string>("");
  const [isSavingMovement, setIsSavingMovement] = useState(false);

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

  const selectedProductRow = useMemo(
    () => allRows.find((row) => row.productId === selectedProductId) ?? null,
    [allRows, selectedProductId]
  );

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

  const handleSaveMovement = async () => {
    if (!canManage) return;
    if (!selectedLocationId || !selectedProductRow) return;

    const qty = Math.max(1, Math.floor(Number(movementQty) || 0));
    if (!qty) return;

    const delta = movementType === "entry" ? qty : -qty;
    const inventoryRef = doc(firestore, "inventory", `${selectedLocationId}_${selectedProductRow.productId}`);

    try {
      setIsSavingMovement(true);
      const batch = writeBatch(firestore);

      batch.set(
        inventoryRef,
        {
          locationId: selectedLocationId,
          productId: selectedProductRow.productId,
          productName: selectedProductRow.productName,
          minStock: selectedProductRow.minStock,
          stock: increment(delta),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      batch.set(doc(collection(firestore, "inventoryMovements")), {
        locationId: selectedLocationId,
        locationName: selectedLocation?.name ?? "",
        productId: selectedProductRow.productId,
        productName: selectedProductRow.productName,
        type: movementType,
        quantity: qty,
        note: movementNote.trim(),
        source: "manual",
        createdAt: serverTimestamp(),
        operator: {
          id: user?.uid ?? null,
          email: user?.email ?? null,
        },
      });

      await batch.commit();
      setMovementQty("1");
      setMovementNote("");
      toast({ title: "Inventario actualizado" });
    } catch (error) {
      console.error("Error updating inventory:", error);
      toast({ variant: "destructive", title: "Error al actualizar inventario" });
    } finally {
      setIsSavingMovement(false);
    }
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
                Filtra por local, busca productos y registra entradas/salidas.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
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

              <div className="space-y-2">
                <Label>Producto</Label>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {allRows.map((row) => (
                      <SelectItem key={row.productId} value={row.productId}>
                        {row.productName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={movementType} onValueChange={(v) => setMovementType(v as "entry" | "exit") }>
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
                <Input type="number" min={1} value={movementQty} onChange={(e) => setMovementQty(e.target.value)} />
              </div>

              <div className="space-y-2 xl:col-span-4">
                <Label>Nota operativa</Label>
                <Input
                  placeholder="Ej. Reposición de proveedor / salida para consumo interno"
                  value={movementNote}
                  onChange={(e) => setMovementNote(e.target.value)}
                />
              </div>

              <div className="xl:col-span-2 flex items-end justify-end gap-2">
                {!canManage && (
                  <span className="text-xs text-amber-700 bg-amber-500/10 border border-amber-300 rounded px-2 py-1">
                    Tu rol es solo lectura.
                  </span>
                )}
                <Button
                  onClick={handleSaveMovement}
                  disabled={!selectedLocationId || !selectedProductId || isSavingMovement || !canManage}
                  className="gap-2"
                >
                  {movementType === "entry" ? <PlusCircle className="w-4 h-4" /> : <MinusCircle className="w-4 h-4" />}
                  {isSavingMovement ? "Guardando..." : "Registrar Movimiento"}
                </Button>
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
                            <TableCell className="text-right">
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
    </RoleGuard>
  );
}
