"use client";

export const dynamic = 'force-dynamic';

import { useMemo, useRef, useState, useEffect } from "react";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import RoleGuard from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Cpu, FileText, Home, Package, ShoppingCart, Users, UserRound, BarChart3, ShieldAlert, Key, Plus, MapPin } from "lucide-react";
import Link from "next/link";
import MachineManager from "@/components/admin/MachineManager";
import ProductManager from "@/components/admin/ProductManager";
import UserManager from "@/components/admin/UserManager";
import ShiftClosureManager from "@/components/admin/ShiftClosureManager";
import FinanceReportsManager from "@/components/admin/FinanceReportsManager";
import AuditLogsManager from "@/components/admin/AuditLogsManager";
import CustomerManager from "@/components/admin/CustomerManager";
import LocationManager from "@/components/admin/LocationManager";
import type { Customer, Station, Product, UserProfile, Sale, Location } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
  updateDoc,
  limit,
} from "firebase/firestore";
import { logAuditAction } from "@/lib/audit-log";

type AdminSection = 'machines' | 'products' | 'staff' | 'customers' | 'finance' | 'logs' | 'closures' | 'locations';

export default function AdminPage() {
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<AdminSection>("machines");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Load data — lazy: only activate queries for the active section
  const machinesQuery = useMemoFirebase(() => {
    if (activeSection !== 'machines') return null;
    return query(collection(firestore, "stations"));
  }, [firestore, activeSection]);
  const productsQuery = useMemoFirebase(() => {
    if (activeSection !== 'products') return null;
    return query(collection(firestore, "products"));
  }, [firestore, activeSection]);
  const usersQuery = useMemoFirebase(() => {
    if (activeSection !== 'staff') return null;
    return query(collection(firestore, "users"));
  }, [firestore, activeSection]);
  const customersQuery = useMemoFirebase(() => {
    if (activeSection !== 'customers') return null;
    return query(collection(firestore, "customers"));
  }, [firestore, activeSection]);
  const locationsQuery = useMemoFirebase(() => query(collection(firestore, "locations")), [firestore]);
  
  const closuresQuery = useMemoFirebase(() => {
    if (!firestore || activeSection !== 'closures') return null;
    return query(collection(firestore, "shiftClosures"), limit(50));
  }, [firestore, activeSection]);

  const salesQuery = useMemoFirebase(() => {
    if (!firestore || activeSection !== 'finance') return null;
    return query(collection(firestore, "sales"), limit(50));
  }, [firestore, activeSection]);

  const auditLogsQuery = useMemoFirebase(() => {
    if (!firestore || (activeSection !== 'logs' && activeSection !== 'finance')) return null;
    return query(collection(firestore, "auditLogs"), limit(50));
  }, [firestore, activeSection]);

  const { data: machinesData } = useCollection<Omit<Station, "id">>(machinesQuery);
  const { data: productsData } = useCollection<Omit<Product, "id">>(productsQuery);
  const { data: usersData } = useCollection<Omit<UserProfile, "uid">>(usersQuery);
  const { data: customersData } = useCollection<Omit<Customer, "id">>(customersQuery);
  const { data: closuresData } = useCollection<any>(closuresQuery);
  const { data: salesData } = useCollection<Omit<Sale, "id">>(salesQuery);
  const { data: auditLogsData } = useCollection<any>(auditLogsQuery);
  const { data: locationsData } = useCollection<Omit<Location, "id">>(locationsQuery);

  const machines = useMemo(() => (machinesData ?? []) as Station[], [machinesData]);
  const products = useMemo(() => (productsData ?? []) as Product[], [productsData]);
  const users = useMemo(
    () =>
      (usersData ?? []).map((u) => ({
        ...u,
        uid: (u as Partial<UserProfile>).uid || u.id,
      })) as UserProfile[],
    [usersData]
  );
  const closures = useMemo(
    () => (closuresData ?? []).sort((a, b) => (b.shiftEnd?.toMillis?.() || 0) - (a.shiftEnd?.toMillis?.() || 0)),
    [closuresData]
  );
  const sales = useMemo(() => (salesData ?? []) as Sale[], [salesData]);
  const customers = useMemo(() => (customersData ?? []) as Customer[], [customersData]);
  const auditLogs = useMemo(() => (auditLogsData ?? []), [auditLogsData]);
  
  const locations = useMemo(() => {
    const list = (locationsData ?? []) as Location[];
    if (list.length === 0) {
      return [{ id: 'local-01', name: 'Local Único', address: 'Av. Principal 123', phone: '987654321', fractionMinutes: 5, isActive: true, createdAt: null as any }];
    }
    return list;
  }, [locationsData]);

  // Auto-select first location if none selected
  const activeLocationId = useMemo(() => {
    if (selectedLocationId && locations.some(l => l.id === selectedLocationId)) {
      return selectedLocationId;
    }
    return locations[0]?.id || 'local-01';
  }, [selectedLocationId, locations]);

  // Financial calculations
  const todayRevenue = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return sales
      .filter((s) => {
        const saleTime = s.endTime?.toMillis ? s.endTime.toMillis() : 0;
        return saleTime >= startOfDay;
      })
      .reduce((sum, s) => sum + (s.amount || 0), 0);
  }, [sales]);

  // Keyboard Navigation (G + key)
  useEffect(() => {
    let gPressed = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'g') {
        gPressed = true;
        setTimeout(() => { gPressed = false; }, 1000); // 1 second window
        return;
      }

      if (gPressed) {
        switch (e.key.toLowerCase()) {
          case 'c':
            e.preventDefault();
            setActiveSection('machines');
            break;
          case 'p':
            e.preventDefault();
            setActiveSection('products');
            break;
          case 's':
            e.preventDefault();
            setActiveSection('staff');
            break;
          case 'f':
            e.preventDefault();
            setActiveSection('finance');
            break;
          case 'l':
            e.preventDefault();
            setActiveSection('logs');
            break;
        }
        gPressed = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const auditActor = {
    id: user?.uid,
    email: user?.email,
    role: userProfile?.role,
  };

  // Operations
  const handleAddMachine = async (machine: Omit<Station, 'id'>) => {
    const locationId = machine.locationId || activeLocationId;
    await addDoc(collection(firestore, "stations"), { ...machine, locationId });
    await logAuditAction(firestore, {
      action: 'machine.create',
      target: 'machines',
      targetId: machine.name,
      locationId,
      actor: auditActor,
      details: { machine },
    });
    toast({ title: "Estación agregada exitosamente" });
  };

  const handleEditMachine = async (id: string, updates: Partial<Station>) => {
    await updateDoc(doc(firestore, "stations", id), updates);
    await logAuditAction(firestore, {
      action: 'machine.update',
      target: 'machines',
      targetId: id,
      locationId: updates.locationId || activeLocationId,
      actor: auditActor,
      details: { updates },
    });
    toast({ title: "Estación actualizada" });
  };

  const handleDeleteMachine = async (id: string) => {
    // Soft-delete: mark as inactive instead of permanent deletion
    await updateDoc(doc(firestore, "stations", id), { isActive: false, status: 'maintenance' });
    await logAuditAction(firestore, {
      action: 'machine.delete',
      target: 'machines',
      targetId: id,
      locationId: activeLocationId,
      actor: auditActor,
      severity: 'high',
      riskTags: ['destructive-action'],
    });
    toast({ title: "Estación desactivada exitosamente" });
  };

  const handleToggleMachineStatus = async (id: string, status: Station["status"]) => {
    await updateDoc(doc(firestore, "stations", id), { status });
    await logAuditAction(firestore, {
      action: 'machine.status.update',
      target: 'machines',
      targetId: id,
      actor: auditActor,
      details: { status },
    });
  };

  const sidebarItems = [
    { id: 'machines' as AdminSection, label: 'Estaciones', icon: Cpu },
    { id: 'products' as AdminSection, label: 'Productos', icon: ShoppingCart },
    { id: 'staff' as AdminSection, label: 'Personal', icon: Users, adminOnly: true },
    { id: 'customers' as AdminSection, label: 'Clientes CRM', icon: UserRound },
    { id: 'finance' as AdminSection, label: 'Finanzas', icon: BarChart3 },
    { id: 'logs' as AdminSection, label: 'Auditoría', icon: ShieldAlert, adminOnly: true },
    { id: 'closures' as AdminSection, label: 'Turnos', icon: Key },
    { id: 'locations' as AdminSection, label: 'Locales/Reglas', icon: MapPin, adminOnly: true },
  ];

  return (
    <RoleGuard requiredRoles={["admin", "manager"]}>
      <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
        
        {/* Hero KPI Command Bar */}
        <header className="module-header flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-xl font-headline font-bold tracking-tight">Panel de Administración</h1>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto flex-shrink-0">
            <div className="bg-card border border-border/50 rounded-xl px-4 py-2.5 flex flex-col shadow-sm">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Caja Hoy</span>
              <span className="text-sm font-black font-mono text-primary mt-0.5">
                {formatCurrency(todayRevenue)}
              </span>
            </div>
            
            <div className="bg-card border border-border/50 rounded-xl px-4 py-2.5 flex flex-col shadow-sm">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ventas</span>
              <span className="text-sm font-black font-mono text-foreground mt-0.5">
                {sales.length} ops
              </span>
            </div>

            <div className="bg-card border border-border/50 rounded-xl px-4 py-2.5 flex flex-col shadow-sm">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cabinas</span>
              <span className="text-sm font-black font-mono text-info mt-0.5">
                {machines.length} pcs
              </span>
            </div>

            <div className="bg-card border border-border/50 rounded-xl px-4 py-2.5 flex flex-col shadow-sm">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Comunidad</span>
              <span className="text-sm font-black font-mono text-status-warning mt-0.5">
                {customers.length} users
              </span>
            </div>
          </div>
        </header>

        {/* Tabs de navegación — scroll horizontal en móvil */}
        <div className="border-b border-border/40 bg-card/30 overflow-x-auto no-scrollbar">
          <div className="flex gap-1 p-2 min-w-max">
            {sidebarItems.map((item) => {
              if (item.adminOnly && userProfile?.role !== 'admin') return null;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                    activeSection === item.id
                      ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Workspace Content Section */}
        <main className="module-content flex flex-col w-full mx-auto">
            {activeSection === 'machines' && (
              <MachineManager
                machines={machines}
                locations={locations}
                onAdd={handleAddMachine}
                onEdit={handleEditMachine}
                onDelete={handleDeleteMachine}
                onToggleStatus={handleToggleMachineStatus}
              />
            )}

            {activeSection === 'products' && (
              <ProductManager
                products={products}
                onAdd={async (p: any) => {
                  await addDoc(collection(firestore, "products"), { ...p, isActive: true, createdAt: serverTimestamp() });
                  toast({ title: "Producto guardado" });
                }}
                onEdit={async (id: string, p: any) => {
                  await updateDoc(doc(firestore, "products", id), p);
                  toast({ title: "Producto actualizado" });
                }}
                onDelete={async (id: string) => {
                  await deleteDoc(doc(firestore, "products", id));
                  toast({ title: "Producto eliminado" });
                }}
              />
            )}

            {activeSection === 'staff' && userProfile?.role === 'admin' && (
              <UserManager
                users={users}
                locations={locations}
                onCreateUser={async (u: any) => {
                  try {
                    const response = await fetch('/api/users', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(u),
                    });
                    
                    const data = await response.json();
                    
                    if (!response.ok) {
                      throw new Error(data.error || "Error al crear usuario");
                    }
                    
                    toast({ title: "Usuario creado correctamente" });
                  } catch (error: any) {
                    toast({ 
                      title: "Error al crear usuario", 
                      description: error.message,
                      variant: "destructive" 
                    });
                    throw error;
                  }
                }}
                onChangeRole={async (id: string, role: any, locationIds: string[], permissions: string[]) => {
                  await updateDoc(doc(firestore, "users", id), { role, locationIds, permissions });
                  toast({ title: "Permisos de Staff actualizados" });
                }}
                onDeactivate={async (id: string) => {
                  await updateDoc(doc(firestore, "users", id), { isActive: false });
                  toast({ title: "Usuario desactivado" });
                }}
              />
            )}

            {activeSection === 'customers' && (
              <CustomerManager 
                customers={customers}
                onAdd={async (c) => { 
                  await addDoc(collection(firestore, "customers"), c); 
                  toast({ title: "Cliente registrado" });
                }}
                onEdit={async (id, c) => { 
                  await updateDoc(doc(firestore, "customers", id), c); 
                  toast({ title: "Cliente actualizado" });
                }}
                onDelete={async (id) => { 
                  await deleteDoc(doc(firestore, "customers", id)); 
                  toast({ title: "Cliente eliminado" });
                }}
              />
            )}

            {activeSection === 'finance' && (
              <FinanceReportsManager 
                sales={sales} 
                machines={machines}
                locations={locations}
                users={users}
                auditLogs={auditLogs}
                closures={closures}
              />
            )}

            {activeSection === 'logs' && userProfile?.role === 'admin' && (
              <AuditLogsManager 
                logs={auditLogs} 
                locations={locations}
                users={users}
              />
            )}

            {activeSection === 'closures' && (
              <ShiftClosureManager 
                closures={closures} 
                userProfile={userProfile}
                onReopenShift={async (id) => {
                  await updateDoc(doc(firestore, "shiftClosures", id), { status: 'reopened', reopenedAt: serverTimestamp() });
                  toast({ title: "Turno reabierto exitosamente" });
                }}
              />
            )}

            {activeSection === 'locations' && userProfile?.role === 'admin' && (
              <LocationManager
                locations={locations}
                onEdit={async (id, updates) => {
                  // Si no existe el documento en la coleccion, lo creamos o sobreescribimos.
                  await updateDoc(doc(firestore, "locations", id), updates).catch(async () => {
                     const { setDoc } = await import("firebase/firestore");
                     await setDoc(doc(firestore, "locations", id), { ...updates, id, isActive: true, createdAt: serverTimestamp() });
                  });
                  
                  toast({ title: "Reglas de Cobro / Prórroga actualizadas" });
                }}
              />
            )}
          </main>
      </div>
    </RoleGuard>
  );
}
