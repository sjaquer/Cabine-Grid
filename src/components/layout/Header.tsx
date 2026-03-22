"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cpu, History, CircleUser, Monitor, MonitorCheck, LogOut, Settings, BarChart3, Package, Loader2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/firebase";
import type { UserProfile } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

type HeaderProps = {
  dailySales: number;
  availableMachines: number;
  occupiedMachines: number;
  onHistoryClick: () => void;
  onSettingsClick?: () => void;
  userProfile: UserProfile | null;
};

export default function Header({ dailySales, availableMachines, occupiedMachines, onHistoryClick, onSettingsClick, userProfile }: HeaderProps) {
  const { logout, getShiftClosurePreview } = useAuth();
  const { toast } = useToast();
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
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
    openMachinesCount: number;
  } | null>(null);
  
  const totalMachines = availableMachines + occupiedMachines;
  const utilizationRate = totalMachines > 0 ? ((occupiedMachines / totalMachines) * 100).toFixed(0) : "0";
  const requiresFormalClose = userProfile?.role === "operator" || userProfile?.role === "manager";

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
    if (!isCloseShiftOpen || !requiresFormalClose) return;

    let isMounted = true;
    const loadPreview = async () => {
      try {
        setIsLoadingPreview(true);
        const preview = await getShiftClosurePreview();
        if (!isMounted || !preview) return;
        setClosurePreview(preview);
        setCountedCash(String(preview.expectedCash));
        setCountedYape(String(preview.expectedYape));
        setCountedOther(String(preview.expectedOther));
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
  }, [isCloseShiftOpen, requiresFormalClose, getShiftClosurePreview, toast]);

  const handleLogoutClick = async () => {
    if (requiresFormalClose) {
      setIsCloseShiftOpen(true);
      return;
    }

    await logout();
  };

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
      setIsCloseShiftOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cerrar turno";
      toast({ variant: "destructive", title: message });
    } finally {
      setIsClosingShift(false);
    }
  };
  
  return (
    <header className="px-4 lg:px-6 flex items-center border-b border-border/50 shrink-0 bg-card/95 backdrop-blur-xl sticky top-0 z-10 shadow-sm">
      <div className="w-full max-w-7xl mx-auto flex items-center gap-4 py-3">
        
        {/* Logo y Branding */}
        <div className="flex items-center gap-3 mr-auto">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/40">
            <Cpu className="h-6 w-6 text-primary" />
          </div>
          <div className="hidden sm:flex flex-col gap-0.5">
            <h1 className="text-sm font-headline font-bold text-foreground">Cabine Grid</h1>
            <p className="text-xs text-muted-foreground">Centro de Operaciones</p>
          </div>
        </div>

        {/* Estadísticas (Desktop) */}
        <div className="hidden lg:flex items-center gap-6">
          <div className="flex gap-3">
            <StatBadge 
              icon={<MonitorCheck className="h-4 w-4" />}
              label="Disponibles"
              value={availableMachines}
              color="text-status-available"
            />
            <StatBadge 
              icon={<Monitor className="h-4 w-4" />}
              label="En Uso"
              value={occupiedMachines}
              color="text-status-occupied"
            />
            <StatBadge 
              icon={<BarChart3 className="h-4 w-4" />}
              label="Ocupación"
              value={`${utilizationRate}%`}
              color="text-primary"
            />
          </div>

          {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/40">
              <span className="text-xs text-muted-foreground">Recaudación hoy:</span>
              <span className="font-bold text-accent">{formatCurrency(dailySales)}</span>
            </div>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onHistoryClick} 
            className="hidden sm:flex gap-2"
          >
            <History className="h-4 w-4" />
            <span>Historial</span>
          </Button>

          {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && onSettingsClick && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onSettingsClick}
              title="Configuración"
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}

          {/* Menú de Usuario */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-2">
                <CircleUser className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="space-y-2 pb-3">
                <div>
                  <div className="text-sm font-semibold">{userProfile?.name || userProfile?.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{userProfile?.email}</div>
                </div>
                <Badge className="w-fit capitalize text-xs" variant="secondary">
                  {userProfile?.role === 'admin' ? '👑 Administrador' : 
                   userProfile?.role === 'manager' ? '👔 Gerente' :
                   userProfile?.role === 'operator' ? '⚙️ Operador' : '👁️ Lectura'}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/inventario" className="cursor-pointer">
                  <Package className="mr-2 h-4 w-4" />
                  <span>Inventario</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogoutClick} className="focus:bg-destructive/10 focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={isCloseShiftOpen} onOpenChange={setIsCloseShiftOpen}>
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
                {closurePreview && (
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
                  />
                  <MoneyInput
                    label="Yape contado"
                    value={countedYape}
                    onChange={setCountedYape}
                    expected={expectedYape}
                    difference={yapeDifference}
                  />
                  <MoneyInput
                    label="Otros medios"
                    value={countedOther}
                    onChange={setCountedOther}
                    expected={expectedOther}
                    difference={otherDifference}
                  />
                </div>

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

                {totalDifference !== 0 && (
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
            <Button variant="outline" onClick={() => setIsCloseShiftOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmCloseShiftAndLogout} disabled={isClosingShift || isLoadingPreview}>
              {isClosingShift ? "Cerrando turno..." : "Cerrar Turno y Salir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
  expected,
  difference,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  expected: number;
  difference: number;
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
      <div className="text-xs text-muted-foreground">Esperado: {formatCurrency(expected)}</div>
      <div className={`text-xs font-medium ${difference === 0 ? "text-status-available" : "text-destructive"}`}>
        Diferencia: {formatCurrency(difference)}
      </div>
    </div>
  );
}

// Componente para Badge de Estadística
function StatBadge({ 
  icon, 
  label, 
  value,
  color 
}: { 
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 border border-border/50 hover:border-border/80 transition-colors">
      <span className={`${color} flex-shrink-0`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`font-bold text-sm ${color}`}>{value}</p>
      </div>
    </div>
  );
}
