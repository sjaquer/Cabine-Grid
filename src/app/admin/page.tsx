"use client";

import { useMemo, useRef, useState } from "react";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import RoleGuard from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, Cpu, MapPin, ShoppingCart, BarChart3, FileText, Home, Users, UserRound } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MachineManager from "@/components/admin/MachineManager";
import LocationManager from "@/components/admin/LocationManager";
import ProductManager from "@/components/admin/ProductManager";
import UserManager from "@/components/admin/UserManager";
import ShiftClosureManager from "@/components/admin/ShiftClosureManager";
import FinanceReportsManager from "@/components/admin/FinanceReportsManager";
import AuditLogsManager from "@/components/admin/AuditLogsManager";
import CustomerManager from "@/components/admin/CustomerManager";
import type { Customer, Machine, Location, Product, UserProfile, UserRole, Sale } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { createUserWithEmailAndPassword, deleteUser, getAuth, signOut } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";
import { logAuditAction, logAuditFailure } from "@/lib/audit-log";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";

export default function AdminPage() {
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("machines");
  const tabsSectionRef = useRef<HTMLDivElement | null>(null);

  const shouldLoadSales = activeTab === "finance";
  const shouldLoadAuditLogs = activeTab === "finance" || activeTab === "logs";
  const shouldLoadClosures = activeTab === "finance" || activeTab === "closures";

  const machinesQuery = useMemoFirebase(() => query(collection(firestore, "machines")), [firestore]);
  const locationsQuery = useMemoFirebase(() => query(collection(firestore, "locations")), [firestore]);
  const productsQuery = useMemoFirebase(() => query(collection(firestore, "products")), [firestore]);
  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const customersQuery = useMemoFirebase(() => query(collection(firestore, "customers")), [firestore]);
  const closuresQuery = useMemoFirebase(() => {
    if (!firestore || !shouldLoadClosures) return null;
    return query(collection(firestore, "shiftClosures"));
  }, [firestore, shouldLoadClosures]);
  const salesQuery = useMemoFirebase(() => {
    if (!firestore || !shouldLoadSales) return null;
    return query(collection(firestore, "sales"));
  }, [firestore, shouldLoadSales]);
  const auditLogsQuery = useMemoFirebase(() => {
    if (!firestore || !shouldLoadAuditLogs) return null;
    return query(collection(firestore, "auditLogs"));
  }, [firestore, shouldLoadAuditLogs]);

  const { data: machinesData } = useCollection<Omit<Machine, "id">>(machinesQuery);
  const { data: locationsData } = useCollection<Omit<Location, "id">>(locationsQuery);
  const { data: productsData } = useCollection<Omit<Product, "id">>(productsQuery);
  const { data: usersData } = useCollection<Omit<UserProfile, "uid">>(usersQuery);
  const { data: customersData } = useCollection<Omit<Customer, "id">>(customersQuery);
  const { data: closuresData } = useCollection<any>(closuresQuery);
  const { data: salesData } = useCollection<Omit<Sale, "id">>(salesQuery);
  const { data: auditLogsData } = useCollection<any>(auditLogsQuery);

  const machines = useMemo(() => (machinesData ?? []) as Machine[], [machinesData]);
  const locations = useMemo(() => (locationsData ?? []) as Location[], [locationsData]);
  const products = useMemo(() => (productsData ?? []) as Product[], [productsData]);
  const users = useMemo(
    () =>
      (usersData ?? []).map((user) => ({
        ...user,
        uid: (user as Partial<UserProfile>).uid || user.id,
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

  const auditActor = {
    id: user?.uid,
    email: user?.email,
    role: userProfile?.role,
  };

  const handleAddMachine = async (machine: Omit<Machine, 'id'>) => {
    await addDoc(collection(firestore, "machines"), machine);
    await logAuditAction(firestore, {
      action: 'machine.create',
      target: 'machines',
      targetId: machine.name,
      locationId: machine.locationId,
      actor: auditActor,
      details: { machine },
    });
    toast({ title: "Máquina creada" });
  };

  const handleEditMachine = async (id: string, updates: Partial<Machine>) => {
    await updateDoc(doc(firestore, "machines", id), updates);
    await logAuditAction(firestore, {
      action: 'machine.update',
      target: 'machines',
      targetId: id,
      locationId: updates.locationId,
      actor: auditActor,
      details: { updates },
    });
    toast({ title: "Máquina actualizada" });
  };

  const handleDeleteMachine = async (id: string) => {
    await deleteDoc(doc(firestore, "machines", id));
    await logAuditAction(firestore, {
      action: 'machine.delete',
      target: 'machines',
      targetId: id,
      actor: auditActor,
      severity: 'high',
      riskTags: ['destructive-action'],
    });
    toast({ title: "Máquina eliminada" });
  };

  const handleToggleMachineStatus = async (
    id: string,
    status: Machine["status"]
  ) => {
    await updateDoc(doc(firestore, "machines", id), { status });
    await logAuditAction(firestore, {
      action: 'machine.status.update',
      target: 'machines',
      targetId: id,
      actor: auditActor,
      details: { status },
    });
    toast({ title: "Estado de máquina actualizado" });
  };

  const handleAddLocation = async (location: Omit<Location, 'id' | 'createdAt'>) => {
    await addDoc(collection(firestore, "locations"), {
      ...location,
      createdAt: serverTimestamp(),
      updateAt: serverTimestamp(),
    });
    await logAuditAction(firestore, {
      action: 'location.create',
      target: 'locations',
      targetId: location.name,
      actor: auditActor,
      details: { location },
    });
    toast({ title: "Local creado" });
  };

  const handleEditLocation = async (id: string, updates: Partial<Location>) => {
    await updateDoc(doc(firestore, "locations", id), {
      ...updates,
      updateAt: serverTimestamp(),
    });
    await logAuditAction(firestore, {
      action: 'location.update',
      target: 'locations',
      targetId: id,
      actor: auditActor,
      details: { updates },
    });
    toast({ title: "Local actualizado" });
  };

  const handleDeleteLocation = async (id: string) => {
    await deleteDoc(doc(firestore, "locations", id));
    await logAuditAction(firestore, {
      action: 'location.delete',
      target: 'locations',
      targetId: id,
      actor: auditActor,
      severity: 'high',
      riskTags: ['destructive-action'],
    });
    toast({ title: "Local eliminado" });
  };

  const handleAddProduct = async (product: Omit<Product, 'id' | 'createdAt'>) => {
    await addDoc(collection(firestore, "products"), {
      ...product,
      createdAt: serverTimestamp(),
    });
    await logAuditAction(firestore, {
      action: 'product.create',
      target: 'products',
      targetId: product.name,
      actor: auditActor,
      details: { product },
    });
    toast({ title: "Producto creado" });
  };

  const handleEditProduct = async (id: string, updates: Partial<Product>) => {
    await updateDoc(doc(firestore, "products", id), updates);
    await logAuditAction(firestore, {
      action: 'product.update',
      target: 'products',
      targetId: id,
      actor: auditActor,
      details: { updates },
    });
    toast({ title: "Producto actualizado" });
  };

  const handleDeleteProduct = async (id: string) => {
    await deleteDoc(doc(firestore, "products", id));
    await logAuditAction(firestore, {
      action: 'product.delete',
      target: 'products',
      targetId: id,
      actor: auditActor,
      severity: 'high',
      riskTags: ['destructive-action'],
    });
    toast({ title: "Producto eliminado" });
  };

  const handleAddCustomer = async (customer: Omit<Customer, 'id'>) => {
    const code = customer.customerCode.trim().toUpperCase();
    const name = customer.fullName.trim();
    const duplicated = customers.some((item) => item.customerCode.trim().toUpperCase() === code);

    if (duplicated) {
      throw new Error("Ya existe un cliente con ese codigo");
    }

    const docRef = await addDoc(collection(firestore, "customers"), {
      customerCode: code,
      fullName: name,
      ...(typeof customer.age === "number" ? { age: customer.age } : {}),
      ...(customer.phone ? { phone: customer.phone } : {}),
      ...(customer.email ? { email: customer.email } : {}),
      favoriteGames: customer.favoriteGames ?? [],
      isActive: customer.isActive ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: {
        id: user?.uid,
        email: user?.email,
      },
      metrics: {
        totalSessions: 0,
        totalMinutesRented: 0,
        totalProductsBought: 0,
        totalSpent: 0,
        machineUsage: {},
        visitsByWeekday: {},
        visitHours: {},
      },
    });

    await logAuditAction(firestore, {
      action: 'customer.create',
      target: 'customers',
      targetId: docRef.id,
      actor: auditActor,
      details: {
        customerCode: code,
        fullName: name,
      },
    });
    toast({ title: "Cliente creado" });
  };

  const handleEditCustomer = async (id: string, updates: Partial<Customer>) => {
    const nextCode = updates.customerCode?.trim().toUpperCase();
    if (nextCode) {
      const duplicated = customers.some(
        (item) => item.id !== id && item.customerCode.trim().toUpperCase() === nextCode
      );
      if (duplicated) {
        throw new Error("Ya existe un cliente con ese codigo");
      }
    }

    await updateDoc(doc(firestore, "customers", id), {
      ...updates,
      ...(nextCode ? { customerCode: nextCode } : {}),
      ...(updates.fullName ? { fullName: updates.fullName.trim() } : {}),
      updatedAt: serverTimestamp(),
    });
    await logAuditAction(firestore, {
      action: 'customer.update',
      target: 'customers',
      targetId: id,
      actor: auditActor,
      details: { updates: { ...updates, ...(nextCode ? { customerCode: nextCode } : {}) } },
    });
    toast({ title: "Cliente actualizado" });
  };

  const handleDeleteCustomer = async (id: string) => {
    await deleteDoc(doc(firestore, "customers", id));
    await logAuditAction(firestore, {
      action: 'customer.delete',
      target: 'customers',
      targetId: id,
      actor: auditActor,
      severity: 'high',
      riskTags: ['destructive-action'],
    });
    toast({ title: "Cliente eliminado" });
  };

  const handleChangeUserRole = async (userId: string, role: UserRole, locationIds: string[]) => {
    await updateDoc(doc(firestore, "users", userId), {
      role,
      locationIds,
      updateAt: serverTimestamp(),
    });
    await logAuditAction(firestore, {
      action: 'user.role.update',
      target: 'users',
      targetId: userId,
      actor: auditActor,
      details: { role, locationIds },
    });
    toast({ title: "Rol actualizado" });
  };

  const handleDeactivateUser = async (userId: string) => {
    await updateDoc(doc(firestore, "users", userId), {
      isActive: false,
      updateAt: serverTimestamp(),
    });
    await logAuditAction(firestore, {
      action: 'user.deactivate',
      target: 'users',
      targetId: userId,
      actor: auditActor,
      details: { isActive: false },
    });
    toast({ title: "Usuario desactivado" });
  };

  const handleCreateUser = async ({
    name,
    email,
    password,
    role,
  }: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }) => {
    if (userProfile?.role !== "admin") {
      throw new Error("Solo un administrador puede crear cuentas.");
    }

    const appName = `cabine-grid-admin-create-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const credential = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
      try {
        await setDoc(doc(firestore, "users", credential.user.uid), {
          uid: credential.user.uid,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          isActive: true,
          createdAt: serverTimestamp(),
          updateAt: serverTimestamp(),
        });
      } catch (profileError) {
        await deleteUser(credential.user).catch(() => undefined);
        throw profileError;
      }

      toast({
        title: "Usuario creado",
        description: `${name.trim()} fue registrado correctamente.`,
      });
      await logAuditAction(firestore, {
        action: 'user.create',
        target: 'users',
        targetId: credential.user.uid,
        actor: auditActor,
        details: { email: email.trim().toLowerCase(), name: name.trim(), role },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el usuario.";
      throw new Error(message);
    } finally {
      await signOut(secondaryAuth).catch(() => undefined);
      await deleteApp(secondaryApp).catch(() => undefined);
    }
  };

  const handleReopenShift = async (closureId: string) => {
    if (userProfile?.role !== "admin") {
      toast({ variant: "destructive", title: "Solo admin puede reabrir cierres" });
      return;
    }
    await updateDoc(doc(firestore, "shiftClosures", closureId), {
      status: "reopened",
      reopenedAt: serverTimestamp(),
      reopenedBy: {
        id: user?.uid || null,
        email: user?.email || null,
      },
    });
    await logAuditAction(firestore, {
      action: 'shift.reopen',
      target: 'shiftClosures',
      targetId: closureId,
      actor: auditActor,
    });
    toast({ title: "Cierre reabierto" });
  };

  const handleQuickActionSelect = (tab: string) => {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      tabsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <RoleGuard requiredRoles={["admin", "manager"]}>
      <div className="min-h-screen bg-gradient-to-br from-secondary via-secondary to-secondary/80">
        {/* Header Profesional Mejorado */}
        <header className="sticky top-0 z-50 border-b border-border/50 bg-card/95 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Navegación Principal */}
            <div className="flex items-center justify-between py-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                    <Cpu className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="font-headline font-bold text-lg">Cabine Grid</span>
                </div>
                <div className="hidden lg:block h-6 w-px bg-border/50"></div>
                <div className="flex flex-col gap-0.5">
                  <h1 className="text-xl font-headline font-bold">Panel Administrativo</h1>
                  <p className="text-xs text-muted-foreground">Gestión integral del sistema</p>
                </div>
              </div>

              {/* Botones de Navegación Secundaria - Reorganizados */}
              <div className="flex items-center gap-3">
                <Link href="/">
                  <Button variant="outline" size="sm" className="gap-2 h-9">
                    <Home className="w-4 h-4" />
                    <span className="hidden md:inline">Dashboard</span>
                  </Button>
                </Link>
                <Link href="/inventario">
                  <Button variant="outline" size="sm" className="gap-2 h-9">
                    <Package className="w-4 h-4" />
                    <span className="hidden md:inline">Inventario</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Estadísticas Rápidas */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 py-4 border-t border-border/30">
              <StatQuick label="Cabinas" value={machines.length} icon={<Cpu className="w-4 h-4" />} />
              <StatQuick label="Locales" value={locations.length} icon={<MapPin className="w-4 h-4" />} />
              <StatQuick label="Productos" value={products.length} icon={<ShoppingCart className="w-4 h-4" />} />
              <StatQuick label="Usuarios" value={users.length} icon={<Users className="w-4 h-4" />} />
              <StatQuick label="Clientes" value={customers.length} icon={<UserRound className="w-4 h-4" />} />
            </div>
          </div>
        </header>

        {/* Contenido Principal */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Sección de Quick Actions */}
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <QuickActionCard
                title="Cabinas"
                description="Gestiona máquinas y especificaciones"
                icon={<Cpu className="w-5 h-5" />}
                count={machines.length}
                tabValue="machines"
                onSelectTab={handleQuickActionSelect}
              />
              <QuickActionCard
                title="Locales"
                description="Administra locales de negocio"
                icon={<MapPin className="w-5 h-5" />}
                count={locations.length}
                tabValue="locations"
                onSelectTab={handleQuickActionSelect}
              />
              <QuickActionCard
                title="Productos"
                description="Inventario y precios"
                icon={<ShoppingCart className="w-5 h-5" />}
                count={products.length}
                tabValue="products"
                onSelectTab={handleQuickActionSelect}
              />
              <QuickActionCard
                title="Clientes"
                description="CRM y fidelizacion"
                icon={<UserRound className="w-5 h-5" />}
                count={customers.length}
                tabValue="customers"
                onSelectTab={handleQuickActionSelect}
              />
              <QuickActionCard
                title="Usuarios"
                description="Roles y permisos"
                icon={<Users className="w-5 h-5" />}
                count={users.length}
                tabValue={userProfile?.role === "admin" ? "users" : null}
                onSelectTab={handleQuickActionSelect}
              />
            </div>
          </div>

          {/* Tabs de Gestión */}
          <div ref={tabsSectionRef}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="bg-card/80 rounded-lg border border-border/50 p-4 mb-6">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 bg-transparent h-auto">
                <TabTriggerWithIcon value="machines" icon={<Cpu className="w-4 h-4" />} label="Cabinas" />
                <TabTriggerWithIcon value="locations" icon={<MapPin className="w-4 h-4" />} label="Locales" />
                <TabTriggerWithIcon value="products" icon={<ShoppingCart className="w-4 h-4" />} label="Productos" />
                <TabTriggerWithIcon value="customers" icon={<UserRound className="w-4 h-4" />} label="Clientes" />
                <TabTriggerWithIcon value="finance" icon={<BarChart3 className="w-4 h-4" />} label="Finanzas" />
                <TabTriggerWithIcon value="logs" icon={<FileText className="w-4 h-4" />} label="Auditoría" />
                <TabTriggerWithIcon value="closures" icon={<Settings className="w-4 h-4" />} label="Cierres" />
                {userProfile?.role === "admin" && (
                  <TabTriggerWithIcon value="users" icon={<Users className="w-4 h-4" />} label="Usuarios" />
                )}
              </TabsList>
            </div>

            {/* Contenido de Tabs */}
            <div className="space-y-6">
              <TabsContent value="machines">
                <MachineManager
                  machines={machines}
                  locations={locations}
                  onAdd={handleAddMachine}
                  onEdit={handleEditMachine}
                  onDelete={handleDeleteMachine}
                  onToggleStatus={handleToggleMachineStatus}
                />
              </TabsContent>

              <TabsContent value="locations">
                <LocationManager
                  locations={locations}
                  onAdd={handleAddLocation}
                  onEdit={handleEditLocation}
                  onDelete={handleDeleteLocation}
                />
              </TabsContent>

              <TabsContent value="products">
                <ProductManager
                  products={products}
                  onAdd={handleAddProduct}
                  onEdit={handleEditProduct}
                  onDelete={handleDeleteProduct}
                />
              </TabsContent>

              <TabsContent value="customers">
                <CustomerManager
                  customers={customers}
                  onAdd={handleAddCustomer}
                  onEdit={handleEditCustomer}
                  onDelete={handleDeleteCustomer}
                />
              </TabsContent>

              <TabsContent value="finance">
                <FinanceReportsManager
                  sales={sales}
                  machines={machines}
                  locations={locations}
                  users={users}
                  auditLogs={auditLogs}
                  closures={closures}
                />
              </TabsContent>

              <TabsContent value="logs">
                <AuditLogsManager
                  logs={auditLogs}
                  locations={locations}
                  users={users}
                />
              </TabsContent>

              <TabsContent value="closures">
                <ShiftClosureManager
                  closures={closures}
                  userProfile={userProfile}
                  onReopenShift={handleReopenShift}
                />
              </TabsContent>

              {userProfile?.role === "admin" && (
                <TabsContent value="users">
                  <UserManager
                    users={users}
                    locations={locations}
                    onCreateUser={handleCreateUser}
                    onChangeRole={handleChangeUserRole}
                    onDeactivate={handleDeactivateUser}
                  />
                </TabsContent>
              )}
            </div>
          </Tabs>
          </div>
        </main>
      </div>
    </RoleGuard>
  );
}

// Componentes Auxiliares para mejor diseño
function StatQuick({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-background/50 border border-border/30 hover:border-border/50 transition-colors">
      {icon && <span className="text-primary flex-shrink-0">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

function QuickActionCard({ 
  title, 
  description, 
  icon, 
  count,
  tabValue,
  onSelectTab,
}: { 
  title: string;
  description: string;
  icon: React.ReactNode;
  count: number;
  tabValue: string | null;
  onSelectTab: (tab: string) => void;
}) {
  const isDisabled = !tabValue;

  const handleOpenTab = () => {
    if (!tabValue) return;
    onSelectTab(tabValue);
  };

  return (
    <Card
      className={`group overflow-hidden transition-all ${isDisabled ? "opacity-70" : "cursor-pointer hover:shadow-lg hover:border-primary/50"}`}
      onClick={handleOpenTab}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpenTab();
        }
      }}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-disabled={isDisabled}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="rounded-lg bg-primary/10 p-3 text-primary group-hover:bg-primary/20 transition-colors">
            {icon}
          </div>
          <Badge variant="secondary" className="text-xs">{count} items</Badge>
        </div>
        <h3 className="font-bold text-lg mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-2 opacity-75 group-hover:opacity-100 transition-opacity justify-start"
          onClick={(event) => {
            event.stopPropagation();
            handleOpenTab();
          }}
          disabled={isDisabled}
        >
          <span>Ir a {title.toLowerCase()}</span>
          <ArrowLeft className="w-4 h-4 rotate-180" />
        </Button>
      </CardContent>
    </Card>
  );
}

function TabTriggerWithIcon({ value, icon, label }: { value: string; icon: React.ReactNode; label: string }) {
  return (
    <TabsTrigger 
      value={value}
      className="flex items-center gap-2 px-3 py-2 text-xs md:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md transition-all"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </TabsTrigger>
  );
}
