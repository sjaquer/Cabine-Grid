"use client";

import { useMemo, useState } from "react";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import RoleGuard from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Database, Loader2, Package } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MachineManager from "@/components/admin/MachineManager";
import LocationManager from "@/components/admin/LocationManager";
import ProductManager from "@/components/admin/ProductManager";
import UserManager from "@/components/admin/UserManager";
import ShiftClosureManager from "@/components/admin/ShiftClosureManager";
import FinanceReportsManager from "@/components/admin/FinanceReportsManager";
import AuditLogsManager from "@/components/admin/AuditLogsManager";
import type { Machine, Location, Product, UserProfile, UserRole, Sale } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { initialMachines, products as defaultProducts, rates } from "@/lib/data";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { createUserWithEmailAndPassword, deleteUser, getAuth, signOut } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";
import { logAuditAction, logAuditFailure } from "@/lib/audit-log";

export default function AdminPage() {
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);

  const machinesQuery = useMemoFirebase(() => query(collection(firestore, "machines")), [firestore]);
  const locationsQuery = useMemoFirebase(() => query(collection(firestore, "locations")), [firestore]);
  const productsQuery = useMemoFirebase(() => query(collection(firestore, "products")), [firestore]);
  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const closuresQuery = useMemoFirebase(() => query(collection(firestore, "shiftClosures")), [firestore]);
  const salesQuery = useMemoFirebase(() => query(collection(firestore, "sales")), [firestore]);
  const auditLogsQuery = useMemoFirebase(() => query(collection(firestore, "auditLogs")), [firestore]);

  const { data: machinesData } = useCollection<Omit<Machine, "id">>(machinesQuery);
  const { data: locationsData } = useCollection<Omit<Location, "id">>(locationsQuery);
  const { data: productsData } = useCollection<Omit<Product, "id">>(productsQuery);
  const { data: usersData } = useCollection<Omit<UserProfile, "uid">>(usersQuery);
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

  const handleChangeUserRole = async (userId: string, role: UserRole) => {
    await updateDoc(doc(firestore, "users", userId), {
      role,
      updateAt: serverTimestamp(),
    });
    await logAuditAction(firestore, {
      action: 'user.role.update',
      target: 'users',
      targetId: userId,
      actor: auditActor,
      details: { role },
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

  const handleSeedMockData = async () => {
    setIsSeeding(true);
    try {
      const [machinesSnap, locationsSnap, productsSnap, usersSnap, salesSnap] = await Promise.all([
        getDocs(query(collection(firestore, "machines"), limit(1))),
        getDocs(query(collection(firestore, "locations"), limit(1))),
        getDocs(query(collection(firestore, "products"), limit(1))),
        getDocs(query(collection(firestore, "users"), limit(1))),
        getDocs(query(collection(firestore, "sales"), limit(1))),
      ]);

      const batch = writeBatch(firestore);

      if (locationsSnap.empty) {
        const centroRef = doc(collection(firestore, "locations"));
        const norteRef = doc(collection(firestore, "locations"));

        batch.set(centroRef, {
          name: "Cabine Grid Centro",
          address: "Av. Principal 120 - Centro",
          phone: "(01) 555-1200",
          fractionMinutes: 5,
          isActive: true,
          createdAt: serverTimestamp(),
          updateAt: serverTimestamp(),
        });

        batch.set(norteRef, {
          name: "Cabine Grid Norte",
          address: "Jr. Los Pinos 450 - Norte",
          phone: "(01) 555-4500",
          fractionMinutes: 5,
          isActive: true,
          createdAt: serverTimestamp(),
          updateAt: serverTimestamp(),
        });

        if (machinesSnap.empty) {
          initialMachines.forEach((machine, index) => {
            const machineRef = doc(collection(firestore, "machines"));
            batch.set(machineRef, {
              ...machine,
              locationId: index < 6 ? centroRef.id : norteRef.id,
              specs: {
                processor: index % 3 === 0 ? "Ryzen 5 5600G" : "Core i5 10400",
                ram: index % 2 === 0 ? "16GB" : "8GB",
                storage: index % 4 === 0 ? "1TB SSD" : "512GB SSD",
              },
            });
          });
        }
      } else if (machinesSnap.empty) {
        const locationIds = locationsSnap.docs.map((locationDoc) => locationDoc.id);
        initialMachines.forEach((machine, index) => {
          const machineRef = doc(collection(firestore, "machines"));
          batch.set(machineRef, {
            ...machine,
            ...(locationIds.length > 0 ? { locationId: locationIds[index % locationIds.length] } : {}),
            specs: {
              processor: index % 3 === 0 ? "Ryzen 5 5600G" : "Core i5 10400",
              ram: index % 2 === 0 ? "16GB" : "8GB",
              storage: index % 4 === 0 ? "1TB SSD" : "512GB SSD",
            },
          });
        });
      }

      if (productsSnap.empty) {
        defaultProducts.forEach((product) => {
          const productRef = doc(collection(firestore, "products"));
          batch.set(productRef, {
            name: product.name,
            price: product.price,
            category: product.category,
            stock: product.stock ?? 0,
            isActive: true,
            createdAt: serverTimestamp(),
          });
        });
      }

      if (usersSnap.empty) {
        batch.set(doc(firestore, "users", "demo-admin"), {
          uid: "demo-admin",
          email: "admin@cabinegrid.com",
          name: "Administrador Demo",
          role: "admin",
          isActive: true,
          createdAt: serverTimestamp(),
        });
        batch.set(doc(firestore, "users", "demo-operator"), {
          uid: "demo-operator",
          email: "operador@cabinegrid.com",
          name: "Operador Demo",
          role: "operator",
          isActive: true,
          createdAt: serverTimestamp(),
        });
      }

      if (salesSnap.empty) {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

        const sampleSales: Omit<Sale, "id">[] = [
          {
            machineName: "PC 01",
            clientName: "PlayerOne",
            startTime: Timestamp.fromDate(twoHoursAgo),
            endTime: Timestamp.fromDate(oneHourAgo),
            totalMinutes: 60,
            amount: 3,
            hourlyRate: 3,
            paymentMethod: "efectivo",
            soldProducts: [
              { productId: "demo-p1", productName: "Inka Kola 500ml", quantity: 1, unitPrice: 2.5 },
            ],
          },
          {
            machineName: "PC 03",
            clientName: "Nexus",
            startTime: Timestamp.fromDate(threeHoursAgo),
            endTime: Timestamp.fromDate(twoHoursAgo),
            totalMinutes: 60,
            amount: 5,
            hourlyRate: 5,
            paymentMethod: "yape",
          },
        ];

        sampleSales.forEach((sale) => {
          const saleRef = doc(collection(firestore, "sales"));
          batch.set(saleRef, sale);
        });
      }

      await batch.commit();
      await logAuditAction(firestore, {
        action: 'system.seed.mock',
        target: 'system',
        targetId: 'seed',
        actor: auditActor,
        severity: 'medium',
      });
      toast({ title: "Datos mock cargados", description: "Ya puedes probar flujos completos en el sistema." });
    } catch (error) {
      console.error(error);
      await logAuditFailure(firestore, {
        action: 'system.seed.mock.error',
        target: 'system',
        targetId: 'seed',
        actor: auditActor,
        error,
      });
      toast({
        variant: "destructive",
        title: "Error al crear datos mock",
        description: "Verifica permisos de Firestore y vuelve a intentar.",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <RoleGuard requiredRoles={["admin", "manager"]}>
      <div className="min-h-screen bg-secondary">
        <div className="border-b border-border/50 bg-card/80 backdrop-blur-lg sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h1 className="text-2xl font-headline font-bold">Panel de Administración</h1>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleSeedMockData} 
                  disabled={isSeeding}
                  variant="default" 
                  size="sm" 
                  className="gap-2"
                >
                  {isSeeding ? "Cargando..." : "Cargar datos de prueba"}
                </Button>
                <Link href="/inventario">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Package className="w-4 h-4" />
                    Inventario por Local
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" size="sm" className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Volver al Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs defaultValue="machines" className="w-full">
            <TabsList className="grid w-full grid-cols-7 mb-8">
              <TabsTrigger value="machines">Cabinas</TabsTrigger>
              <TabsTrigger value="locations">Locales</TabsTrigger>
              <TabsTrigger value="products">Productos</TabsTrigger>
              <TabsTrigger value="finance">Finanzas</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="closures">Cierres</TabsTrigger>
              {userProfile?.role === "admin" && (
                <TabsTrigger value="users">Usuarios</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="machines" className="space-y-6">
              <MachineManager
                machines={machines}
                locations={locations}
                onAdd={handleAddMachine}
                onEdit={handleEditMachine}
                onDelete={handleDeleteMachine}
                onToggleStatus={handleToggleMachineStatus}
              />
            </TabsContent>

            <TabsContent value="locations" className="space-y-6">
              <LocationManager
                locations={locations}
                onAdd={handleAddLocation}
                onEdit={handleEditLocation}
                onDelete={handleDeleteLocation}
              />
            </TabsContent>

            <TabsContent value="products" className="space-y-6">
              <ProductManager
                products={products}
                onAdd={handleAddProduct}
                onEdit={handleEditProduct}
                onDelete={handleDeleteProduct}
              />
            </TabsContent>

            <TabsContent value="finance" className="space-y-6">
              <FinanceReportsManager
                sales={sales}
                machines={machines}
                locations={locations}
                users={users}
                auditLogs={auditLogs}
                closures={closures}
              />
            </TabsContent>

            <TabsContent value="logs" className="space-y-6">
              <AuditLogsManager
                logs={auditLogs}
                locations={locations}
                users={users}
              />
            </TabsContent>

            <TabsContent value="closures" className="space-y-6">
              <ShiftClosureManager
                closures={closures}
                userProfile={userProfile}
                onReopenShift={handleReopenShift}
              />
            </TabsContent>

            {userProfile?.role === "admin" && (
              <TabsContent value="users" className="space-y-6">
                <UserManager
                  users={users}
                  onCreateUser={handleCreateUser}
                  onChangeRole={handleChangeUserRole}
                  onDeactivate={handleDeactivateUser}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </RoleGuard>
  );
}
