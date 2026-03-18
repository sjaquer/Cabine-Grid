"use client";

import { useMemo, useState } from "react";
import { useAuth, useCollection, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import RoleGuard from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Database, Loader2, Package, BarChart3 } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import MachineManager from "@/components/admin/MachineManager";
import LocationManager from "@/components/admin/LocationManager";
import ProductManager from "@/components/admin/ProductManager";
import UserManager from "@/components/admin/UserManager";
import ShiftClosureManager from "@/components/admin/ShiftClosureManager";
import SensitiveApprovalsManager from "@/components/admin/SensitiveApprovalsManager";
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
  getDoc,
  runTransaction,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { createUserWithEmailAndPassword, deleteUser, getAuth, multiFactor, signOut } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";
import { logAuditAction } from "@/lib/audit-log";

type AppSecuritySettings = {
  requireMfaForFullAccess?: boolean;
};

export default function AdminPage() {
  const { user, userProfile } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  const machinesQuery = useMemoFirebase(() => query(collection(firestore, "machines")), [firestore]);
  const locationsQuery = useMemoFirebase(() => query(collection(firestore, "locations")), [firestore]);
  const productsQuery = useMemoFirebase(() => query(collection(firestore, "products")), [firestore]);
  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const closuresQuery = useMemoFirebase(() => query(collection(firestore, "shiftClosures")), [firestore]);
  const approvalsQuery = useMemoFirebase(() => query(collection(firestore, "sensitiveApprovals")), [firestore]);
  const securitySettingsRef = useMemoFirebase(() => doc(firestore, "appSettings", "security"), [firestore]);

  const { data: machinesData } = useCollection<Omit<Machine, "id">>(machinesQuery);
  const { data: locationsData } = useCollection<Omit<Location, "id">>(locationsQuery);
  const { data: productsData } = useCollection<Omit<Product, "id">>(productsQuery);
  const { data: usersData } = useCollection<Omit<UserProfile, "uid">>(usersQuery);
  const { data: closuresData } = useCollection<any>(closuresQuery);
  const { data: approvalsData } = useCollection<any>(approvalsQuery);
  const { data: securitySettings } = useDoc<AppSecuritySettings>(securitySettingsRef);

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
  const approvals = useMemo(
    () => (approvalsData ?? []).filter((x) => (x.status || "pending") === "pending"),
    [approvalsData]
  );
  const requireMfaForFullAccess = Boolean(securitySettings?.requireMfaForFullAccess);
  const hasSecondFactorEnabled = user ? multiFactor(user).enrolledFactors.length > 0 : false;

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
    const current = products.find((p) => p.id === id);
    const priceChanged = typeof updates.price === "number" && typeof current?.price === "number" && updates.price !== current.price;

    if (priceChanged && userProfile?.role !== "admin") {
      await addDoc(collection(firestore, "sensitiveApprovals"), {
        type: "product.price.change",
        status: "pending",
        targetCollection: "products",
        targetId: id,
        locationId: null,
        requestedBy: {
          id: user?.uid || null,
          email: user?.email || null,
        },
        payload: { updates },
        note: `Solicitud de cambio de precio para producto ${current?.name || id}`,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Solicitud enviada", description: "El cambio de precio requiere aprobación de admin." });
      return;
    }

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

  const handleApproveSensitive = async (approvalId: string) => {
    if (userProfile?.role !== "admin") {
      toast({ variant: "destructive", title: "Solo admin puede aprobar" });
      return;
    }

    const approvalRef = doc(firestore, "sensitiveApprovals", approvalId);
    const snapshot = await getDoc(approvalRef);
    if (!snapshot.exists()) return;

    const approval = snapshot.data() as any;

    if (approval.type === "product.price.change") {
      await updateDoc(doc(firestore, approval.targetCollection, approval.targetId), {
        ...(approval.payload?.updates || {}),
        updateAt: serverTimestamp(),
      });
    }

    if (approval.type === "inventory.adjust.large") {
      const payload = approval.payload || {};
      const inventoryRef = doc(firestore, "inventory", `${payload.locationId}_${payload.productId}`);
      const movementRef = doc(collection(firestore, "inventoryMovements"));
      await runTransaction(firestore, async (transaction) => {
        const invSnap = await transaction.get(inventoryRef);
        const currentStock = invSnap.exists() ? Number(invSnap.data().stock || 0) : 0;
        const qty = Number(payload.quantity || 0);
        const type = payload.type as "entry" | "exit";
        const nextStock = type === "entry" ? currentStock + qty : currentStock - qty;
        if (nextStock < 0) {
          throw new Error("No se puede aprobar: stock quedaría negativo.");
        }

        transaction.set(inventoryRef, {
          locationId: payload.locationId,
          productId: payload.productId,
          productName: payload.productName,
          minStock: payload.minStock ?? 5,
          stock: nextStock,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        transaction.set(movementRef, {
          locationId: payload.locationId,
          productId: payload.productId,
          productName: payload.productName,
          quantity: qty,
          type,
          note: `Aprobado por admin. ${approval.note || ""}`,
          source: "approval",
          createdAt: serverTimestamp(),
          operator: approval.requestedBy || null,
        });
      });
    }

    await updateDoc(approvalRef, {
      status: "approved",
      reviewedAt: serverTimestamp(),
      reviewedBy: { id: user?.uid || null, email: user?.email || null },
    });

    await logAuditAction(firestore, {
      action: "sensitive.approval.approve",
      target: "sensitiveApprovals",
      targetId: approvalId,
      actor: auditActor,
      details: { type: approval.type },
    });

    toast({ title: "Solicitud aprobada" });
  };

  const handleRejectSensitive = async (approvalId: string) => {
    if (userProfile?.role !== "admin") {
      toast({ variant: "destructive", title: "Solo admin puede rechazar" });
      return;
    }
    await updateDoc(doc(firestore, "sensitiveApprovals", approvalId), {
      status: "rejected",
      reviewedAt: serverTimestamp(),
      reviewedBy: { id: user?.uid || null, email: user?.email || null },
    });
    await logAuditAction(firestore, {
      action: "sensitive.approval.reject",
      target: "sensitiveApprovals",
      targetId: approvalId,
      actor: auditActor,
    });
    toast({ title: "Solicitud rechazada" });
  };

  const handleCreateDailySnapshot = async () => {
    if (userProfile?.role !== "admin") {
      toast({ variant: "destructive", title: "Solo admin puede generar snapshots" });
      return;
    }
    const now = new Date();
    const key = now.toISOString().slice(0, 10);
    await setDoc(doc(firestore, "dailySnapshots", key), {
      dateKey: key,
      generatedAt: serverTimestamp(),
      generatedBy: { id: user?.uid || null, email: user?.email || null },
      totals: {
        machines: machines.length,
        locations: locations.length,
        products: products.length,
        users: users.length,
      },
    }, { merge: true });
    toast({ title: "Snapshot diario generado" });
  };

  const handleToggleRequireMfaForFullAccess = async (checked: boolean) => {
    if (userProfile?.role !== "admin") {
      toast({ variant: "destructive", title: "Solo admin puede cambiar esta configuracion" });
      return;
    }

    if (checked && !hasSecondFactorEnabled) {
      toast({
        variant: "destructive",
        title: "Activa 2 pasos primero",
        description: "Tu cuenta admin necesita tener 2 pasos activo antes de exigirlo para toda la app.",
      });
      return;
    }

    setIsSavingSecurity(true);
    try {
      await setDoc(
        securitySettingsRef,
        {
          requireMfaForFullAccess: checked,
          updatedAt: serverTimestamp(),
          updatedBy: {
            id: user?.uid || null,
            email: user?.email || null,
          },
        },
        { merge: true }
      );

      await logAuditAction(firestore, {
        action: "security.mfa.require_full_access.toggle",
        target: "appSettings",
        targetId: "security",
        actor: auditActor,
        details: { requireMfaForFullAccess: checked },
      });

      toast({
        title: checked ? "2 pasos requerido activado" : "2 pasos requerido desactivado",
        description: checked
          ? "Ahora todos deben tener 2 pasos para ver toda la app."
          : "Se desactivo la exigencia global de 2 pasos.",
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "No se pudo actualizar la seguridad",
        description: "Verifica tus permisos y vuelve a intentar.",
      });
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    await deleteDoc(doc(firestore, "products", id));
    toast({ title: "Producto eliminado" });
  };

  const handleChangeUserRole = async (userId: string, role: UserRole) => {
    const currentUser = users.find((u) => u.uid === userId);
    await updateDoc(doc(firestore, "users", userId), {
      role,
      locationIds: currentUser?.locationIds ?? [],
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

  const handleUpdateUserAccess = async (
    userId: string,
    payload: { role: UserRole; locationIds: string[] }
  ) => {
    await updateDoc(doc(firestore, "users", userId), {
      role: payload.role,
      locationIds: payload.locationIds,
      updateAt: serverTimestamp(),
    });
    await logAuditAction(firestore, {
      action: 'user.access.update',
      target: 'users',
      targetId: userId,
      actor: auditActor,
      details: {
        role: payload.role,
        locationIds: payload.locationIds,
      },
    });
    toast({ title: "Acceso de usuario actualizado" });
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
    locationIds,
  }: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    locationIds?: string[];
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
          locationIds: locationIds ?? [],
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
        details: {
          email: email.trim().toLowerCase(),
          name: name.trim(),
          role,
          locationIds: locationIds ?? [],
        },
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
                {userProfile?.role === "admin" && (
                  <Button variant="secondary" size="sm" onClick={handleCreateDailySnapshot}>
                    Snapshot Diario
                  </Button>
                )}
                <Link href="/reportes">
                  <Button variant="outline" size="sm" className="gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Reportes
                  </Button>
                </Link>
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
          {userProfile?.role === "admin" && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Seguridad de 2 pasos</CardTitle>
                <CardDescription>
                  Exige verificacion en 2 pasos para ver todo Cabine Grid.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">Requerir 2 pasos para acceso total</p>
                    <p className="text-sm text-muted-foreground">
                      Si esta activo, cualquier usuario sin 2 pasos quedara bloqueado hasta volver a iniciar sesion con verificacion.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isSavingSecurity && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    <Switch
                      checked={requireMfaForFullAccess}
                      disabled={isSavingSecurity}
                      onCheckedChange={handleToggleRequireMfaForFullAccess}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="machines" className="w-full">
            <TabsList className="grid w-full grid-cols-6 mb-8">
              <TabsTrigger value="machines">Cabinas</TabsTrigger>
              <TabsTrigger value="locations">Locales</TabsTrigger>
              <TabsTrigger value="products">Productos</TabsTrigger>
              <TabsTrigger value="closures">Cierres</TabsTrigger>
              <TabsTrigger value="approvals">Aprobaciones</TabsTrigger>
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

            <TabsContent value="closures" className="space-y-6">
              <ShiftClosureManager
                closures={closures}
                userProfile={userProfile}
                onReopenShift={handleReopenShift}
              />
            </TabsContent>

            <TabsContent value="approvals" className="space-y-6">
              <SensitiveApprovalsManager
                approvals={approvals}
                userProfile={userProfile}
                onApprove={handleApproveSensitive}
                onReject={handleRejectSensitive}
              />
            </TabsContent>

            {userProfile?.role === "admin" && (
              <TabsContent value="users" className="space-y-6">
                <UserManager
                  users={users}
                  locations={locations}
                  onCreateUser={handleCreateUser}
                  onUpdateUserAccess={handleUpdateUserAccess}
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
