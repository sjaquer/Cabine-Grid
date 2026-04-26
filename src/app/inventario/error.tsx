"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 p-6 text-center">
      <h2 className="text-2xl font-bold text-destructive">Error en Gestión de Inventario</h2>
      <p className="text-muted-foreground max-w-md">
        {error.message || "Hubo un problema al cargar los productos o existencias."}
      </p>
      <Button onClick={() => reset()} variant="secondary">
        Recargar datos
      </Button>
    </div>
  );
}
