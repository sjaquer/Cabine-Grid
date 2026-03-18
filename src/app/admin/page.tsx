"use client";

import { useMemo, useState } from "react";
import { useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import RoleGuard from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Database, Loader2 } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MachineManager from "@/components/admin/MachineManager";
import LocationManager from "@/components/admin/LocationManager";
import ProductManager from "@/components/admin/ProductManager";
import UserManager from "@/components/admin/UserManager";
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
  updateDoc,
  writeBatch,
} from "firebase/firestore";

export default function AdminPage() {
  const { userProfile } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);

  const machinesQuery = useMemoFirebase(() => query(collection(firestore, "machines")), [firestore]);
  const locationsQuery = useMemoFirebase(() => query(collection(firestore, "locations")), [firestore]);
  const productsQuery = useMemoFirebase(() => query(collection(firestore, "products")), [firestore]);
  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);

  const { data: machinesData } = useCollection<Omit<Machine, "id">>(machinesQuery);
  const { data: locationsData } = useCollection<Omit<Location, "id">>(locationsQuery);
  const { data: productsData } = useCollection<Omit<Product, "id">>(productsQuery);
  const { data: usersData } = useCollection<Omit<UserProfile, "uid">>(usersQuery);

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

  const handleAddMachine = async (machine: Omit<Machine, 'id'>) => {
    await addDoc(collection(firestore, "machines"), machine);
    toast({ title: "Máquina creada" });
  };

  const handleEditMachine = async (id: string, updates: Partial<Machine>) => {
    await updateDoc(doc(firestore, "machines", id), updates);
    toast({ title: "Máquina actualizada" });
  };

  const handleDeleteMachine = async (id: string) => {
    await deleteDoc(doc(firestore, "machines", id));
    toast({ title: "Máquina eliminada" });
  };

  const handleToggleMachineStatus = async (
    id: string,
    status: Machine["status"]
  ) => {
    await updateDoc(doc(firestore, "machines", id), { status });
    toast({ title: "Estado de máquina actualizado" });
  };

  const handleAddLocation = async (location: Omit<Location, 'id' | 'createdAt'>) => {
    await addDoc(collection(firestore, "locations"), {
      ...location,
      createdAt: serverTimestamp(),
      updateAt: serverTimestamp(),
    });
    toast({ title: "Local creado" });
  };

  const handleEditLocation = async (id: string, updates: Partial<Location>) => {
    await updateDoc(doc(firestore, "locations", id), {
      ...updates,
      updateAt: serverTimestamp(),
    });
    toast({ title: "Local actualizado" });
  };

  const handleDeleteLocation = async (id: string) => {
    await deleteDoc(doc(firestore, "locations", id));
    toast({ title: "Local eliminado" });
  };

  const handleAddProduct = async (product: Omit<Product, 'id' | 'createdAt'>) => {
    await addDoc(collection(firestore, "products"), {
      ...product,
      createdAt: serverTimestamp(),
    });
    toast({ title: "Producto creado" });
  };

  const handleEditProduct = async (id: string, updates: Partial<Product>) => {
    await updateDoc(doc(firestore, "products", id), updates);
    toast({ title: "Producto actualizado" });
  };

  const handleDeleteProduct = async (id: string) => {
    await deleteDoc(doc(firestore, "products", id));
    toast({ title: "Producto eliminado" });
  };

  const handleChangeUserRole = async (userId: string, role: UserRole) => {
    await updateDoc(doc(firestore, "users", userId), {
      role,
      updateAt: serverTimestamp(),
    });
    toast({ title: "Rol actualizado" });
  };

  const handleDeactivateUser = async (userId: string) => {
    await updateDoc(doc(firestore, "users", userId), {
      isActive: false,
      updateAt: serverTimestamp(),
    });
    toast({ title: "Usuario desactivado" });
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
      toast({ title: "Datos mock cargados", description: "Ya puedes probar flujos completos en el sistema." });
    } catch (error) {
      console.error(error);
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
                <Button variant="secondary" size="sm" className="gap-2" onClick={handleSeedMockData} disabled={isSeeding}>
                  {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  Cargar Datos Demo
                </Button>
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
            <TabsList className="grid w-full grid-cols-4 mb-8">
              <TabsTrigger value="machines">Cabinas</TabsTrigger>
              <TabsTrigger value="locations">Locales</TabsTrigger>
              <TabsTrigger value="products">Productos</TabsTrigger>
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

            {userProfile?.role === "admin" && (
              <TabsContent value="users" className="space-y-6">
                <UserManager
                  users={users}
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
