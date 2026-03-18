"use client";

import { useAuth } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { UserRole } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

type RoleGuardProps = {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  fallback?: React.ReactNode;
};

export default function RoleGuard({
  children,
  requiredRoles = ["admin", "manager", "operator", "view-only"],
  fallback,
}: RoleGuardProps) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return null;
  }

  // Si no hay roles requeridos especificados, permitir acceso
  if (requiredRoles.length === 0 || requiredRoles.includes(userProfile.role)) {
    return <>{children}</>;
  }

  // Si el usuario no tiene el rol requerido
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">Acceso Denegado</h1>
        <p className="text-muted-foreground mb-4">
          No tienes permiso para acceder a esta sección.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
