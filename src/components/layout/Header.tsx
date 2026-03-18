"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Cpu, History, CircleUser, Monitor, MonitorCheck, LogOut, Settings, BarChart3, Package } from "lucide-react";
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
  const { logout } = useAuth();
  const { toast } = useToast();
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [countedCash, setCountedCash] = useState<string>("");
  const [inventoryChecked, setInventoryChecked] = useState(false);
  const [discrepancyReason, setDiscrepancyReason] = useState("");
  const [isClosingShift, setIsClosingShift] = useState(false);
  
  const totalMachines = availableMachines + occupiedMachines;
  const utilizationRate = totalMachines > 0 ? ((occupiedMachines / totalMachines) * 100).toFixed(0) : "0";
  const requiresFormalClose = userProfile?.role === "operator" || userProfile?.role === "manager";

  const handleLogoutClick = async () => {
    if (requiresFormalClose) {
      setIsCloseShiftOpen(true);
      return;
    }

    await logout();
  };

  const confirmCloseShiftAndLogout = async () => {
    const parsedCash = Number(countedCash);
    if (Number.isNaN(parsedCash) || parsedCash < 0) {
      toast({ variant: "destructive", title: "Ingresa un conteo de caja valido" });
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
    <header className="px-4 lg:px-6 h-20 flex items-center border-b border-border/60 shrink-0 bg-card/85 backdrop-blur-xl sticky top-0 z-10 shadow-lg shadow-black/10">
      <div className="flex items-center gap-3 mr-auto sm:mr-8">
        <div className="p-2 rounded-xl bg-primary/20 border border-primary/40">
          <Cpu className="h-6 w-6 text-primary" />
        </div>
        <div className="hidden sm:flex flex-col">
          <h1 className="text-sm font-headline font-bold text-foreground">Cabine Grid</h1>
          <p className="text-xs text-muted-foreground">Centro de Operaciones</p>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-8">
        <div className="flex gap-6">
          <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-status-available/10 border border-status-available/30">
            <div className="flex items-center gap-2">
              <MonitorCheck className="h-4 w-4 text-status-available" />
              <span className="font-semibold text-sm text-foreground">{availableMachines}</span>
            </div>
            <span className="text-xs text-muted-foreground">Disponibles</span>
          </div>
          
          <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-status-occupied/10 border border-status-occupied/30">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-status-occupied" />
              <span className="font-semibold text-sm text-foreground">{occupiedMachines}</span>
            </div>
            <span className="text-xs text-muted-foreground">En Uso</span>
          </div>

          <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">{utilizationRate}%</span>
            </div>
            <span className="text-xs text-muted-foreground">Ocupación</span>
          </div>
        </div>

        {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-accent/15 border border-accent/40">
            <span className="text-xs text-muted-foreground">Recaudación:</span>
            <span className="font-headline font-bold text-lg text-accent">{formatCurrency(dailySales)}</span>
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <Button variant="ghost" size="sm" onClick={onHistoryClick} className="hidden sm:flex">
          <History className="mr-2 h-4 w-4" />
          <span>Historial</span>
        </Button>

        {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && onSettingsClick && (
          <Button variant="ghost" size="icon" onClick={onSettingsClick}>
            <Settings className="h-5 w-5" />
            <span className="sr-only">Configuración</span>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <CircleUser className="h-5 w-5" />
              <span className="sr-only">Perfil</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-2 pb-2">
              <div>
                <div className="text-sm font-medium">{userProfile?.name || userProfile?.email}</div>
                <div className="text-xs text-muted-foreground">{userProfile?.email}</div>
              </div>
              <Badge className="w-fit capitalize" variant="secondary">
                {userProfile?.role === 'admin' ? 'Administrador' : 
                 userProfile?.role === 'manager' ? 'Gerente' :
                 userProfile?.role === 'operator' ? 'Operador' : 'Lectura'}
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/inventario">
                <Package className="mr-2 h-4 w-4" />
                <span>Inventario</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogoutClick}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isCloseShiftOpen} onOpenChange={setIsCloseShiftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cierre Formal de Turno</DialogTitle>
            <DialogDescription>
              Debes completar arqueo de caja e inventario antes de cerrar sesión.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Monto contado en caja (efectivo)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                placeholder="Ej. 150.50"
              />
            </div>

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
            <Button onClick={confirmCloseShiftAndLogout} disabled={isClosingShift}>
              {isClosingShift ? "Cerrando turno..." : "Cerrar Turno y Salir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
