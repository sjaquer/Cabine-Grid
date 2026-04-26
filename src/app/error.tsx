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
      <div className="rounded-full bg-destructive/10 p-4 text-destructive">
        <span className="text-4xl font-bold">⚠️</span>
      </div>
      <h2 className="text-2xl font-bold tracking-tight">¡Algo salió mal!</h2>
      <p className="text-muted-foreground max-w-md">
        {error.message || "Ocurrió un error inesperado en la aplicación."}
      </p>
      <Button 
        onClick={() => reset()}
        className="bg-primary hover:bg-primary/90 font-semibold shadow-lg transition-all"
      >
        Intentar de nuevo
      </Button>
    </div>
  );
}
