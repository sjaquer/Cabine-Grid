"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cpu, History, CircleUser, LogOut, Settings, Package, Loader2, AlertTriangle, UserRound, BarChart3 } from "lucide-react";
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
import ShiftClosureDialog from "./ShiftClosureDialog";

type HeaderProps = {
  dailySales: number;
  availableMachines: number;
  occupiedMachines: number;
  onHistoryClick: () => void;
  userProfile: UserProfile | null;
};

export default function Header({ dailySales, availableMachines, occupiedMachines, onHistoryClick, userProfile }: HeaderProps) {
  const { logout, getShiftClosurePreview } = useAuth();
  const { toast } = useToast();
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const requiresFormalClose = userProfile?.role === "operator" || userProfile?.role === "manager";

  const handleLogoutClick = async () => {
    if (requiresFormalClose) {
      setIsCloseShiftOpen(true);
      return;
    }

    await logout();
  };
  
  return (
    <header className="app-sticky-header flex items-center px-2 sm:px-4 lg:px-6 shrink-0 shadow-sm">
      <div className="app-container flex items-center gap-2 py-1.5 sm:gap-4 sm:py-3">
        
        {/* Logo y Branding */}
        <div className="mr-auto flex items-center gap-2 sm:gap-3">
          <div className="brand-chip-icon h-8 w-8 p-0 sm:h-10 sm:w-10">
            <Cpu className="h-4 w-4 text-primary-foreground sm:h-6 sm:w-6" />
          </div>
          <div className="hidden sm:flex flex-col gap-0.5">
            <h1 className="text-sm font-headline font-bold text-foreground">Cabine Grid</h1>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onHistoryClick} 
            className="hidden h-8 gap-2 sm:flex"
          >
            <History className="h-4 w-4" />
            <span>Historial</span>
          </Button>

          {/* Menú de Usuario */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:ml-2 sm:h-10 sm:w-10">
                <CircleUser className="h-4 w-4 sm:h-5 sm:w-5" />
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
                <Link href="/clientes" className="cursor-pointer">
                  <UserRound className="mr-2 h-4 w-4" />
                  <span>Clientes (Mini-CRM)</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/inventario" className="cursor-pointer">
                  <Package className="mr-2 h-4 w-4" />
                  <span>Inventario</span>
                </Link>
              </DropdownMenuItem>
              {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/reportes" className="cursor-pointer">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      <span>Reportes</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Administración</span>
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={handleLogoutClick} className="focus:bg-destructive/10 focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
          <div 
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-primary/10 border border-primary/20"
            title={`Ventas de hoy: ${formatCurrency(dailySales)}`}
          >
            <span className="hidden lg:inline text-xs text-muted-foreground">Caja Hoy:</span>
            <span className="font-bold text-primary text-xs sm:text-sm">{formatCurrency(dailySales)}</span>
          </div>
        )}
      </div>

      <ShiftClosureDialog
        isOpen={isCloseShiftOpen}
        onOpenChange={setIsCloseShiftOpen}
        requiresFormalClose={requiresFormalClose}
        userProfile={userProfile}
      />
    </header>
  );
}
