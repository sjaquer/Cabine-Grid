"use client";

export const dynamic = 'force-dynamic';

import { useMemo, useRef, useState, useEffect } from "react";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import RoleGuard from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Cpu, FileText, Home, Package, ShoppingCart, Users, UserRound, BarChart3, ShieldAlert, Key, Plus } from "lucide-react";
import Link from "next/link";
import MachineManager from "@/components/admin/MachineManager";
import ProductManager from "@/components/admin/ProductManager";
import UserManager from "@/components/admin/UserManager";
import ShiftClosureManager from "@/components/admin/ShiftClosureManager";
import FinanceReportsManager from "@/components/admin/FinanceReportsManager";
import AuditLogsManager from "@/components/admin/AuditLogsManager";
import CustomerManager from "@/components/admin/CustomerManager";
import type { Customer, Station, Product, UserProfile, Sale } from "@/lib/types";
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

type AdminSection = 'machines' | 'products' | 'staff' | 'customers' | 'finance' | 'logs' | 'closures';

export default function AdminPage() {
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<AdminSection>("machines");
  
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Load data
  const machinesQuery = useMemoFirebase(() => query(collection(firestore, "stations")), [firestore]);
  const productsQuery = useMemoFirebase(() => query(collection(firestore, "products")), [firestore]);
  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const customersQuery = useMemoFirebase(() => query(collection(firestore, "customers")), [firestore]);
  
  const closuresQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "shiftClosures"), limit(50));
  }, [firestore]);

  const salesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "sales"), limit(50));
  }, [firestore]);

  const auditLogsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "auditLogs"), limit(50));
  }, [firestore]);

  const { data: machinesData } = useCollection<Omit<Station, "id">>(machinesQuery);
  const { data: productsData } = useCollection<Omit<Product, "id">>(productsQuery);
  const { data: usersData } = useCollection<Omit<UserProfile, "uid">>(usersQuery);
  const { data: customersData } = useCollection<Omit<Customer, "id">>(customersQuery);
  const { data: closuresData } = useCollection<any>(closuresQuery);
  const { data: salesData } = useCollection<Omit<Sale, "id">>(salesQuery);
  const { data: auditLogsData } = useCollection<any>(auditLogsQuery);

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
    await addDoc(collection(firestore, "stations"), { ...machine, locationId: "local-01" });
    await logAuditAction(firestore, {
      action: 'machine.create',
      target: 'machines',
      targetId: machine.name,
      locationId: 'local-01',
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
      locationId: 'local-01',
      actor: auditActor,
      details: { updates },
    });
    toast({ title: "Estación actualizada" });
  };

  const handleDeleteMachine = async (id: string) => {
    await deleteDoc(doc(firestore, "stations", id));
    await logAuditAction(firestore, {
      action: 'machine.delete',
      target: 'machines',
      targetId: id,
      actor: auditActor,
      severity: 'high',
      riskTags: ['destructive-action'],
    });
    toast({ title: "Estación eliminada exitosamente" });
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
  ];

  return (
    <RoleGuard requiredRoles={["admin", "manager"]}>
      <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col">
        
        {/* Hero KPI Command Bar */}
        <header className="w-full border-b border-zinc-800 bg-zinc-900/40 backdrop-blur-xl px-6 py-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-xl font-headline font-bold tracking-tight">Panel de Control de Dueño</h1>
              <p className="text-xs text-zinc-400">Gestión táctica completa • Local Único</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto flex-shrink-0">
              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-4 py-2.5 flex flex-col">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Caja Hoy</span>
                <span className="text-sm font-black font-mono text-emerald-500 mt-0.5">
                  {formatCurrency(todayRevenue)}
                </span>
              </div>
              
              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-4 py-2.5 flex flex-col">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Ventas</span>
                <span className="text-sm font-black font-mono text-primary mt-0.5">
                  {sales.length} ops
                </span>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-4 py-2.5 flex flex-col">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Cabinas</span>
                <span className="text-sm font-black font-mono text-blue-400 mt-0.5">
                  {machines.length} pcs
                </span>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-4 py-2.5 flex flex-col">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Comunidad</span>
                <span className="text-sm font-black font-mono text-amber-500 mt-0.5">
                  {customers.length} users
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Workspace: Sidebar + Content Area */}
        <div className="flex-1 flex overflow-hidden w-full">
          {/* Internal Sidebar */}
          <aside className="w-52 border-r border-zinc-900 bg-zinc-950 flex flex-col gap-1 p-3 shrink-0 hidden md:flex">
            {sidebarItems.map((item) => {
              if (item.adminOnly && userProfile?.role !== 'admin') return null;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all",
                    activeSection === item.id
                      ? "bg-zinc-900 text-primary shadow-[inset_0_0_10px_rgba(234,88,12,0.15)] border border-zinc-800/40"
                      : "text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </aside>

          {/* Workspace Content Section */}
          <main className="flex-1 p-6 overflow-y-auto bg-zinc-950">
            {activeSection === 'machines' && (
              <MachineManager
                machines={machines}
                locations={[{ id: 'local-01', name: 'Local 01', address: '-', fractionMinutes: 60, createdAt: null as any, isActive: true }]}
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
                locations={[{ id: 'local-01', name: 'Local 01', address: '-', fractionMinutes: 60, createdAt: null as any, isActive: true }]}
                onCreateUser={async (u: any) => {
                  toast({ title: "Crear staff mediante consola de seguridad" });
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
                locations={[{ id: 'local-01', name: 'Local 01', address: '-', fractionMinutes: 60, createdAt: null as any, isActive: true }]}
                users={users}
                auditLogs={auditLogs}
                closures={closures}
              />
            )}

            {activeSection === 'logs' && userProfile?.role === 'admin' && (
              <AuditLogsManager 
                logs={auditLogs} 
                locations={[{ id: 'local-01', name: 'Local 01', address: '-', fractionMinutes: 60, createdAt: null as any, isActive: true }]}
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
          </main>
        </div>

      </div>
    </RoleGuard>
  );
}
