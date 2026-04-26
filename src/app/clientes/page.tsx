"use client";

export const dynamic = 'force-dynamic';

import { useMemo, useState, useEffect, useRef } from "react";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import RoleGuard from "@/components/auth/RoleGuard";
import type { Customer } from "@/lib/types";
import { collection, query, addDoc, serverTimestamp } from "firebase/firestore";
import { CustomerProfileDrawer } from "@/components/admin/CustomerProfileDrawer";
import { logAuditAction } from "@/lib/audit-log";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, UserRound, Trophy, Gamepad2, Plus, UserPlus } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

type QuickFilter = 'all' | 'gold' | 'silver' | 'bronze';

export default function ClientesPage() {
  const firestore = useFirestore();
  const { user, userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<QuickFilter>('all');
  const [selectedGamer, setSelectedGamer] = useState<Customer | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Keyboard Navigation State
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Create client modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newDni, setNewDni] = useState("");
  const [newCustomerCode, setNewCustomerCode] = useState("");
  const [isSavingClient, setIsSavingClient] = useState(false);

  const customersQuery = useMemoFirebase(() => query(collection(firestore, "customers")), [firestore]);
  const { data: customersData } = useCollection<Omit<Customer, "id">>(customersQuery);

  const customers = useMemo(() => (customersData ?? []) as Customer[], [customersData]);

  const filteredCustomers = useMemo(() => {
    let result = customers;
    
    // Search term filter
    const needle = searchTerm.toLowerCase().trim();
    if (needle) {
      result = result.filter((c) => {
        const name = c.fullName?.toLowerCase() || "";
        const code = c.customerCode?.toLowerCase() || "";
        const dni = c.dni?.toLowerCase() || "";
        return name.includes(needle) || code.includes(needle) || dni.includes(needle);
      });
    }

    // Quick filters
    if (selectedFilter !== 'all') {
      result = result.filter(c => (c.loyaltyLevel || 'bronze') === selectedFilter);
    }

    return result;
  }, [customers, searchTerm, selectedFilter]);

  // Autofocus Search on Mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev < filteredCustomers.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredCustomers.length - 1));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        const client = filteredCustomers[activeIndex];
        if (client) {
          setSelectedGamer(client);
          setIsDrawerOpen(true);
        }
      } else if (e.key.toLowerCase() === 'n' && document.activeElement !== searchInputRef.current && !isCreateModalOpen && !isDrawerOpen) {
        e.preventDefault();
        setNewFullName("");
        setNewDni("");
        setNewCustomerCode(`CLI-${Math.floor(1000 + Math.random() * 9000)}`);
        setIsCreateModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredCustomers, activeIndex, isCreateModalOpen, isDrawerOpen]);

  const handleCreateClient = async () => {
    if (!newFullName.trim()) return;
    setIsSavingClient(true);
    try {
      const clientRef = await addDoc(collection(firestore, "customers"), {
        fullName: newFullName.trim(),
        dni: newDni.trim(),
        customerCode: newCustomerCode,
        loyaltyLevel: 'bronze',
        totalSpent: 0,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        metrics: {
          totalSessions: 0,
          totalMinutesRented: 0,
          totalProductsBought: 0,
          totalSpent: 0,
        }
      });

      await logAuditAction(firestore, {
        action: "create_customer_crm",
        target: "customers",
        targetId: clientRef.id,
        details: { customerAlias: newFullName.trim(), dni: newDni.trim() },
        actor: { id: user?.uid || null, email: user?.email || null, role: userProfile?.role || null }
      });

      setIsCreateModalOpen(false);
    } catch (e) {
      console.error("Error creando cliente:", e);
    } finally {
      setIsSavingClient(false);
    }
  };

  const loyaltyColors = {
    gold: "text-yellow-500 border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.15)] bg-yellow-500/5",
    silver: "text-zinc-400 border-zinc-700/30 bg-zinc-800/20",
    bronze: "text-orange-500 border-orange-500/20 bg-orange-500/5"
  };

  return (
    <RoleGuard>
      <div className="app-shell app-enter bg-zinc-950 text-zinc-100">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_15px_rgba(234,88,12,0.15)]">
              <UserRound className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-headline font-bold tracking-tight">Mini-CRM Gamer</h1>
              <p className="text-xs text-zinc-400 font-medium">Control de lealtad de la comunidad</p>
            </div>
          </div>

          <Button 
            onClick={() => {
              setNewFullName("");
              setNewDni("");
              setNewCustomerCode(`CLI-${Math.floor(1000 + Math.random() * 9000)}`);
              setIsCreateModalOpen(true);
            }}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs h-9 shadow-[0_0_10px_rgba(234,88,12,0.2)]"
          >
            <Plus className="w-4 h-4" /> Nuevo Cliente (N)
          </Button>
        </header>

        <main className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Hero Search input */}
          <div className="relative">
            <Search className="w-6 h-6 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <Input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setActiveIndex(-1);
              }}
              placeholder="Busca por Alias, Nombre, Código o DNI..."
              className="h-14 pl-12 pr-4 bg-zinc-900/30 border border-zinc-800/60 focus-visible:ring-primary/50 text-base rounded-2xl font-medium text-zinc-100"
            />
            <Badge variant="outline" className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-zinc-500 border-zinc-800">
              Foco Automático
            </Badge>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFilter('all')}
              className={cn("text-xs h-8 px-3 rounded-lg border border-transparent", selectedFilter === 'all' ? "bg-zinc-800 text-zinc-100 font-bold border-zinc-700" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900")}
            >
              Todos
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFilter('gold')}
              className={cn("text-xs h-8 px-3 rounded-lg border border-transparent text-yellow-500 hover:bg-yellow-500/10", selectedFilter === 'gold' && "bg-yellow-500/10 font-bold border-yellow-500/20")}
            >
              <Trophy className="w-3.5 h-3.5 mr-1.5" /> Oro / VIPs
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFilter('silver')}
              className={cn("text-xs h-8 px-3 rounded-lg border border-transparent text-zinc-400 hover:bg-zinc-800", selectedFilter === 'silver' && "bg-zinc-800 font-bold border-zinc-700")}
            >
              Plata
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFilter('bronze')}
              className={cn("text-xs h-8 px-3 rounded-lg border border-transparent text-orange-500 hover:bg-orange-500/10", selectedFilter === 'bronze' && "bg-orange-500/10 font-bold border-orange-500/20")}
            >
              Bronce
            </Button>
          </div>

          {/* High Density Tactical List */}
          <div className="border border-zinc-900 rounded-2xl bg-zinc-950/30 overflow-hidden">
            {filteredCustomers.length === 0 ? (
              <div className="py-12 text-center">
                <UserRound className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
                <p className="text-sm text-zinc-600 font-medium">No se encontraron registros tácticos.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-900/60">
                {filteredCustomers.map((customer, index) => {
                  const tier = customer.loyaltyLevel || 'bronze';
                  return (
                    <div
                      key={customer.id}
                      onClick={() => {
                        setSelectedGamer(customer);
                        setIsDrawerOpen(true);
                        setActiveIndex(index);
                      }}
                      className={cn(
                        "flex items-center justify-between p-4 transition-all cursor-pointer hover:bg-zinc-900/40",
                        index === activeIndex && "bg-zinc-900/60 border-y border-zinc-800/50 shadow-[inset_0_0_15px_rgba(0,0,0,0.2)]"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-400 text-xs font-bold font-mono border border-zinc-800/40">
                          {customer.fullName ? customer.fullName[0].toUpperCase() : "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-zinc-100 tracking-tight truncate">{customer.fullName}</p>
                          <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                            {customer.dni ? `DNI: ${customer.dni}` : `Cod: ${customer.customerCode}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Invertido</p>
                          <p className="text-xs font-bold font-mono text-zinc-300 mt-0.5">
                            {formatCurrency(customer.totalSpent ?? customer.metrics?.totalSpent ?? 0)}
                          </p>
                        </div>

                        <Badge 
                          variant="outline" 
                          className={cn("text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md", loyaltyColors[tier])}
                        >
                          {tier}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Side drawer Player profile */}
        <CustomerProfileDrawer
          customer={selectedGamer}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedGamer(null);
          }}
        />

        {/* Modal Creación Cliente Rápido */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <UserPlus className="w-5 h-5 text-primary" /> Registrar Gamer
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Alta táctica rápida de cliente para el mostrador.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-zinc-400">Nombre Completo o Alias</Label>
                <Input
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Alias Gamer"
                  className="h-9 bg-zinc-900/50 border-zinc-800 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-zinc-400">DNI / Cédula</Label>
                <Input
                  value={newDni}
                  onChange={(e) => setNewDni(e.target.value)}
                  placeholder="Doc Identidad"
                  className="h-9 bg-zinc-900/50 border-zinc-800 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-zinc-500">Código Generado</Label>
                <Input
                  value={newCustomerCode}
                  readOnly
                  disabled
                  className="h-9 bg-zinc-950 border-zinc-900 text-xs font-mono text-zinc-600 cursor-not-allowed"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button 
                onClick={handleCreateClient} 
                disabled={isSavingClient || !newFullName.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9"
              >
                {isSavingClient ? "Guardando..." : "Finalizar Registro"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
