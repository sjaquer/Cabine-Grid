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
      <h2 className="text-2xl font-bold text-destructive">Error en Panel de Administración</h2>
      <p className="text-muted-foreground max-w-md">
        {error.message || "No se pudo cargar el panel de administración."}
      </p>
      <Button onClick={() => reset()} variant="outline">
        Reintentar
      </Button>
    </div>
  );
}
