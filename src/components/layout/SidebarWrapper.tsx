"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/firebase";
import Link from "next/link";
import { Cpu, Home, UserRound, Package, BarChart3, Settings, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect } from "react";
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
import { formatCurrency, cn } from "@/lib/utils";
import CommandPalette from "./CommandPalette";

export default function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, userProfile, loading, logout, getShiftClosurePreview } = useAuth();
  const { toast } = useToast();

  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [countedCash, setCountedCash] = useState<string>("");
  const [countedYape, setCountedYape] = useState<string>("0");
  const [countedOther, setCountedOther] = useState<string>("0");
  const [inventoryChecked, setInventoryChecked] = useState(false);
  const [discrepancyReason, setDiscrepancyReason] = useState("");
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [closurePreview, setClosurePreview] = useState<any>(null);

  const requiresFormalClose = userProfile?.role === "operator" || userProfile?.role === "manager";

  const parsedCash = useMemo(() => Number(countedCash || 0), [countedCash]);
  const parsedYape = useMemo(() => Number(countedYape || 0), [countedYape]);
  const parsedOther = useMemo(() => Number(countedOther || 0), [countedOther]);
  const isInvalidCount = [parsedCash, parsedYape, parsedOther].some((n) => Number.isNaN(n) || n < 0);

  const expectedCash = closurePreview?.expectedCash ?? 0;
  const expectedYape = closurePreview?.expectedYape ?? 0;
  const expectedOther = closurePreview?.expectedOther ?? 0;

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
    return () => { isMounted = false; };
  }, [isCloseShiftOpen, requiresFormalClose, getShiftClosurePreview, toast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  // Don't show sidebar on login page or when loading
  if (pathname === "/login" || loading || !user) {
    return <>{children}</>;
  }

  const menuItems = [
    { label: "Mapa", icon: Home, href: "/" },
    { label: "Clientes", icon: UserRound, href: "/clientes" },
    { label: "Inventario", icon: Package, href: "/inventario" },
    { label: "Reportes", icon: BarChart3, href: "/reportes", roles: ["admin", "manager"] },
    { label: "Admin", icon: Settings, href: "/admin", roles: ["admin", "manager"] },
  ];


  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 overflow-hidden">
      <CommandPalette isOpen={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen} />

      {/* Sidebar colapsable dinámico */}
      <aside 
        className={cn(
          "bg-slate-900/95 border-r border-slate-800/50 flex flex-col items-center py-4 justify-between z-30 shrink-0 transition-all duration-300 ease-in-out group/sidebar",
          isCollapsed ? "w-16 sm:w-20 hover:w-60" : "w-60"
        )}
      >
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="p-2 bg-primary/20 rounded-xl text-primary-foreground">
            <Cpu className="w-6 h-6 text-primary" />
          </div>

          <nav className="flex flex-col gap-3 w-full px-2">
            {menuItems.map((item) => {
              if (item.roles && !item.roles.includes(userProfile?.role || "")) {
                return null;
              }
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link key={item.href} href={item.href} className="w-full">
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full transition-all rounded-xl flex items-center gap-3",
                      isActive ? "bg-primary/20 text-primary font-bold" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
                      isCollapsed ? "aspect-square justify-center p-0 group-hover/sidebar:justify-start group-hover/sidebar:px-4 group-hover/sidebar:aspect-auto group-hover/sidebar:py-3" : "justify-start px-4 py-3"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className={cn("text-xs font-headline tracking-wide", isCollapsed ? "hidden group-hover/sidebar:inline" : "inline")}>
                      {item.label}
                    </span>
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Perfil y Logout */}
        <div className="flex flex-col items-center gap-4 w-full px-2">
          <Badge variant="outline" className="text-[9px] tracking-wider uppercase font-bold border-slate-700 text-slate-400">
            {userProfile?.role?.slice(0, 3) || "OP"}
          </Badge>
          <Button
            variant="ghost"
            onClick={handleLogoutClick}
            className={cn(
              "w-full transition-all rounded-xl flex items-center gap-3 hover:bg-destructive/20 hover:text-destructive text-slate-400",
              isCollapsed ? "aspect-square justify-center p-0 group-hover/sidebar:justify-start group-hover/sidebar:px-4 group-hover/sidebar:aspect-auto group-hover/sidebar:py-3" : "justify-start px-4 py-3"
            )}
          >
            <LogOut className="w-5 h-5" />
            <span className={cn("text-xs font-headline tracking-wide", isCollapsed ? "hidden group-hover/sidebar:inline" : "inline")}>
              Cerrar Turno
            </span>
          </Button>
        </div>
      </aside>

      {/* Contenido principal expandido */}
      <main className="flex-1 h-full overflow-hidden bg-slate-950 relative">
        {children}
      </main>

      {/* Dialog de cierre de turno */}
      <Dialog open={isCloseShiftOpen} onOpenChange={setIsCloseShiftOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-50">
          <DialogHeader>
            <DialogTitle className="text-slate-50">Cierre Formal de Turno</DialogTitle>
            <DialogDescription className="text-slate-400">
              Completa el arqueo completo aqui mismo para cerrar y salir rapidamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isLoadingPreview ? (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cargando resumen del turno...
              </div>
            ) : (
              <>
                {closurePreview && userProfile?.role !== 'operator' && (
                  <div className="rounded-md border border-slate-800 bg-slate-900/30 p-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Ventas del turno</span>
                      <span className="font-semibold">{closurePreview.salesCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total esperado</span>
                      <span className="font-semibold">{formatCurrency(closurePreview.totalExpected)}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2 rounded-md border border-slate-800 p-3 bg-slate-900/20">
                    <Label className="text-slate-300">Efectivo contado</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                      className="border-slate-800 bg-slate-900 text-slate-50"
                    />
                  </div>
                  <div className="space-y-2 rounded-md border border-slate-800 p-3 bg-slate-900/20">
                    <Label className="text-slate-300">Yape contado</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={countedYape}
                      onChange={(e) => setCountedYape(e.target.value)}
                      className="border-slate-800 bg-slate-900 text-slate-50"
                    />
                  </div>
                  <div className="space-y-2 rounded-md border border-slate-800 p-3 bg-slate-900/20">
                    <Label className="text-slate-300">Otros medios</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={countedOther}
                      onChange={(e) => setCountedOther(e.target.value)}
                      className="border-slate-800 bg-slate-900 text-slate-50"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label className="text-slate-300">Motivo de diferencia (si aplica)</Label>
              <Textarea
                value={discrepancyReason}
                onChange={(e) => setDiscrepancyReason(e.target.value)}
                placeholder="Si hubo diferencia, explica el motivo."
                className="border-slate-800 bg-slate-900 text-slate-50"
              />
            </div>

            <div className="flex items-center space-x-2 rounded-md border border-slate-800 p-3 bg-slate-900/10">
              <Checkbox
                id="inventory-check"
                checked={inventoryChecked}
                onCheckedChange={(checked) => setInventoryChecked(Boolean(checked))}
                className="border-slate-700 data-[state=checked]:bg-primary"
              />
              <Label htmlFor="inventory-check" className="cursor-pointer text-slate-300 text-sm">
                Confirmo que se realizo conteo de inventario del turno.
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsCloseShiftOpen(false)} className="text-slate-400 hover:bg-slate-800/50">
              Cancelar
            </Button>
            <Button onClick={confirmCloseShiftAndLogout} disabled={isClosingShift} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isClosingShift ? "Cerrando..." : "💰 Confirmar y Salir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
