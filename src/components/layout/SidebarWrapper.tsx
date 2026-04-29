"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/firebase";
import Link from "next/link";
import { Cpu, Home, UserRound, Package, BarChart3, Settings, LogOut, Loader2, Menu, X, Sun, Moon, Palette } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect } from "react";
import { formatCurrency, cn } from "@/lib/utils";
import CommandPalette from "./CommandPalette";
import ShiftClosureDialog from "./ShiftClosureDialog";

export default function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, userProfile, loading, logout, getShiftClosurePreview } = useAuth();
  const { mode, color, setMode, setColor } = useTheme();
  const { toast } = useToast();

  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const requiresFormalClose = userProfile?.role === "operator" || userProfile?.role === "manager";

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
    <div className="flex w-full min-h-screen bg-background text-foreground overflow-hidden">
      <CommandPalette isOpen={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen} />

      {/* Sidebar colapsable dinámico */}
      <aside 
        className={cn(
          "hidden lg:flex bg-card border-r border-border flex-col items-center py-4 justify-between z-30 shrink-0 transition-all duration-300 ease-in-out group/sidebar",
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
                      isActive ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
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

        {/* Theme Customizer */}
        <div className={cn("flex flex-col gap-2 w-full p-2 bg-card/40 border border-border/40 rounded-xl mb-2", isCollapsed ? "hidden group-hover/sidebar:flex" : "flex")}>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center flex items-center justify-center gap-1">
            <Palette className="w-3 h-3" /> Tema
          </span>
          
          {/* Mode Switch */}
          <div className="flex items-center justify-around gap-1 bg-background/60 p-0.5 rounded-lg border border-border/50">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMode('light')}
              className={cn("h-6 w-6 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-all", mode === 'light' && "bg-secondary text-primary font-bold shadow-sm")}
            >
              <Sun className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMode('dark')}
              className={cn("h-6 w-6 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-all", mode === 'dark' && "bg-secondary text-primary font-bold shadow-sm")}
            >
              <Moon className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Color variations */}
          <div className="grid grid-cols-5 gap-1 mt-0.5 px-1">
            {(['orange', 'emerald', 'blue', 'violet', 'amber'] as const).map((c) => {
              const colorBg = {
                orange: 'bg-orange-500',
                emerald: 'bg-emerald-500',
                blue: 'bg-blue-500',
                violet: 'bg-violet-500',
                amber: 'bg-amber-500',
              }[c];
              return (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-3.5 h-3.5 rounded-full transition-all border border-background/50 hover:scale-125 mx-auto shrink-0", 
                    colorBg, 
                    color === c && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                  )}
                  title={c}
                />
              );
            })}
          </div>
        </div>

        {/* Perfil y Logout */}
        <div className="flex flex-col items-center gap-4 w-full px-2">
          <Badge variant="outline" className="text-xs tracking-wider uppercase font-bold border-border/50 text-muted-foreground">
            {userProfile?.role?.slice(0, 3) || "OP"}
          </Badge>
          <Button
            variant="ghost"
            onClick={handleLogoutClick}
            className={cn(
              "w-full transition-all rounded-xl flex items-center gap-3 hover:bg-destructive/20 hover:text-destructive text-muted-foreground",
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

      {/* Menú Hamburguesa flotante para tablets y móviles (<1024px) */}
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="h-11 w-11 rounded-xl bg-background/90 border-border text-foreground shadow-[0_4px_15px_rgba(0,0,0,0.4)] backdrop-blur-md flex items-center justify-center"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Superposición del Menú Móvil */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-background/98 backdrop-blur-xl z-40 flex flex-col items-center justify-center animate-in fade-in slide-in-from-top-8 duration-300">
          <nav className="flex flex-col gap-5 items-center">
            {menuItems.map((item) => {
              if (item.roles && !item.roles.includes(userProfile?.role || "")) return null;
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} onClick={() => setIsMobileOpen(false)}>
                  <span className={cn(
                    "text-xl font-headline tracking-wide flex items-center gap-3 py-3 px-6 rounded-xl transition-all",
                    isActive 
                      ? "text-primary font-bold bg-primary/10 border border-primary/30 shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}>
                    <Icon className="w-6 h-6" />
                    {item.label}
                  </span>
                </Link>
              );
            })}
            <Button
              variant="ghost"
              onClick={() => {
                setIsMobileOpen(false);
                handleLogoutClick();
              }}
              className="mt-8 text-muted-foreground hover:text-destructive flex items-center gap-3 text-lg hover:bg-destructive/10 py-6 px-8 rounded-xl"
            >
              <LogOut className="w-6 h-6" />
              Cerrar Turno
            </Button>
          </nav>
        </div>
      )}

      {/* Contenido principal expandido */}
      <main className="flex-1 h-full overflow-y-auto bg-transparent relative">
        {children}
      </main>

      <ShiftClosureDialog
        isOpen={isCloseShiftOpen}
        onOpenChange={setIsCloseShiftOpen}
        requiresFormalClose={requiresFormalClose}
        userProfile={userProfile}
      />
    </div>
  );
}
