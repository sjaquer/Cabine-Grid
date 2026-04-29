"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle } from "lucide-react";

type ShiftClosureDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  requiresFormalClose: boolean;
  userProfile: UserProfile | null;
};

export default function ShiftClosureDialog({
  isOpen,
  onOpenChange,
  requiresFormalClose,
  userProfile,
}: ShiftClosureDialogProps) {
  const { logout, getShiftClosurePreview } = useAuth();
  const { toast } = useToast();

  const [countedCash, setCountedCash] = useState<string>("");
  const [countedYape, setCountedYape] = useState<string>("0");
  const [countedOther, setCountedOther] = useState<string>("0");
  const [inventoryChecked, setInventoryChecked] = useState(false);
  const [discrepancyReason, setDiscrepancyReason] = useState("");
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [closurePreview, setClosurePreview] = useState<{
    shiftId: string;
    shiftStartMs: number;
    shiftLocationId?: string;
    salesCount: number;
    expectedCash: number;
    expectedYape: number;
    expectedOther: number;
    totalExpected: number;
    debtsGenerated: number;
    grossSales: number;
    theoreticalIncome: number;
    openMachinesCount: number;
  } | null>(null);

  const parsedCash = useMemo(() => Number(countedCash || 0), [countedCash]);
  const parsedYape = useMemo(() => Number(countedYape || 0), [countedYape]);
  const parsedOther = useMemo(() => Number(countedOther || 0), [countedOther]);
  const isInvalidCount = [parsedCash, parsedYape, parsedOther].some((n) => Number.isNaN(n) || n < 0);

  const expectedCash = closurePreview?.expectedCash ?? 0;
  const expectedYape = closurePreview?.expectedYape ?? 0;
  const expectedOther = closurePreview?.expectedOther ?? 0;

  const cashDifference = useMemo(() => Math.round((parsedCash - expectedCash) * 100) / 100, [parsedCash, expectedCash]);
  const yapeDifference = useMemo(() => Math.round((parsedYape - expectedYape) * 100) / 100, [parsedYape, expectedYape]);
  const otherDifference = useMemo(() => Math.round((parsedOther - expectedOther) * 100) / 100, [parsedOther, expectedOther]);
  const totalCounted = useMemo(() => Math.round((parsedCash + parsedYape + parsedOther) * 100) / 100, [parsedCash, parsedYape, parsedOther]);
  const totalExpected = closurePreview?.totalExpected ?? 0;
  const totalDifference = useMemo(() => Math.round((totalCounted - totalExpected) * 100) / 100, [totalCounted, totalExpected]);

  useEffect(() => {
    if (!isOpen || !requiresFormalClose) return;

    let isMounted = true;
    const loadPreview = async () => {
      try {
        setIsLoadingPreview(true);
        const preview = await getShiftClosurePreview();
        if (!isMounted || !preview) return;
        setClosurePreview(preview);
        
        // Cierre Ciego: Operadores no ven el monto inicial esperado.
        const isOp = userProfile?.role === 'operator';
        setCountedCash(isOp ? "" : String(preview.expectedCash));
        setCountedYape(isOp ? "" : String(preview.expectedYape));
        setCountedOther(isOp ? "" : String(preview.expectedOther));
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo cargar el cierre de turno.";
        toast({ variant: "destructive", title: message });
      } finally {
        if (isMounted) setIsLoadingPreview(false);
      }
    };

    void loadPreview();
    return () => {
      isMounted = false;
    };
  }, [isOpen, requiresFormalClose, getShiftClosurePreview, toast, userProfile?.role]);

  const confirmCloseShiftAndLogout = async () => {
    if (isInvalidCount) {
      toast({ variant: "destructive", title: "Revisa los montos ingresados" });
      return;
    }
    if (!inventoryChecked) {
      toast({ variant: "destructive", title: "Debes confirmar el conteo de inventario" });
      return;
    }

    try {
      setIsClosingShift(true);
      await logout({
        countedCash: parsedCash,
        countedYape: parsedYape,
        countedOther: parsedOther,
        inventoryChecked,
        discrepancyReason,
      });
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cerrar turno";
      toast({ variant: "destructive", title: message });
    } finally {
      setIsClosingShift(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cierre Formal de Turno</DialogTitle>
          <DialogDescription>
            Completa el arqueo completo aqui mismo para cerrar y salir rapidamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoadingPreview ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Cargando resumen del turno...
            </div>
          ) : (
            <>
              {closurePreview && userProfile?.role !== 'operator' && (
                <div className="rounded-md border bg-secondary/20 p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ventas del turno</span>
                    <span className="font-semibold">{closurePreview.salesCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total esperado</span>
                    <span className="font-semibold">{formatCurrency(closurePreview.totalExpected)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Deudas generadas</span>
                    <span className="font-semibold text-destructive">{formatCurrency(closurePreview.debtsGenerated || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ingreso teórico (real)</span>
                    <span className="font-semibold">{formatCurrency(closurePreview.theoreticalIncome || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Maquinas abiertas</span>
                    <span className={`font-semibold ${closurePreview.openMachinesCount > 0 ? "text-destructive" : "text-status-available"}`}>
                      {closurePreview.openMachinesCount}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <MoneyInput
                  label="Efectivo contado"
                  value={countedCash}
                  onChange={setCountedCash}
                  expected={expectedCash}
                  difference={cashDifference}
                  hideExpected={userProfile?.role === 'operator'}
                />
                <MoneyInput
                  label="Yape contado"
                  value={countedYape}
                  onChange={setCountedYape}
                  expected={expectedYape}
                  difference={yapeDifference}
                  hideExpected={userProfile?.role === 'operator'}
                />
                <MoneyInput
                  label="Otros medios"
                  value={countedOther}
                  onChange={setCountedOther}
                  expected={expectedOther}
                  difference={otherDifference}
                  hideExpected={userProfile?.role === 'operator'}
                />
              </div>

              {userProfile?.role !== 'operator' && (
                <div className="rounded-md border p-3 space-y-1.5 bg-background/70">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total contado</span>
                    <span className="font-semibold">{formatCurrency(totalCounted)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total esperado</span>
                    <span className="font-semibold">{formatCurrency(totalExpected)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t pt-1.5">
                    <span className="text-muted-foreground">Diferencia total</span>
                    <span className={`font-semibold ${totalDifference === 0 ? "text-status-available" : "text-destructive"}`}>
                      {formatCurrency(totalDifference)}
                    </span>
                  </div>
                </div>
              )}

              {userProfile?.role !== 'operator' && totalDifference !== 0 && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <p>Hay diferencia en el cierre. Debes detallar el motivo para continuar.</p>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label>Motivo de diferencia (si aplica)</Label>
            <Textarea
              value={discrepancyReason}
              onChange={(e) => setDiscrepancyReason(e.target.value)}
              placeholder="Si hubo diferencia entre caja esperada y contada, explica el motivo."
            />
          </div>

          <div className="flex items-center space-x-2 rounded-md border p-3">
            <Checkbox
              id="inventory-check"
              checked={inventoryChecked}
              onCheckedChange={(checked) => setInventoryChecked(Boolean(checked))}
            />
            <Label htmlFor="inventory-check" className="cursor-pointer">
              Confirmo que se realizo conteo de inventario del turno.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmCloseShiftAndLogout} disabled={isClosingShift || isLoadingPreview}>
            {isClosingShift ? "Cerrando turno..." : "Cerrar Turno y Salir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
  expected,
  difference,
  hideExpected = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  expected: number;
  difference: number;
  hideExpected?: boolean;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3 bg-background/60">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {!hideExpected && (
        <>
          <div className="text-xs text-muted-foreground">Esperado: {formatCurrency(expected)}</div>
          <div className={`text-xs font-medium ${difference === 0 ? "text-status-available" : "text-destructive"}`}>
            Diferencia: {formatCurrency(difference)}
          </div>
        </>
      )}
    </div>
  );
}
