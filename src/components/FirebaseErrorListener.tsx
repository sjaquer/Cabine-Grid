'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { getAuth, signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It throws any received error to be caught by Next.js's global-error.tsx.
 */
export function FirebaseErrorListener() {
  // Use the specific error type for the state for type safety.
  const [error, setError] = useState<FirestorePermissionError | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    // The callback now expects a strongly-typed error, matching the event payload.
    const handleError = (error: FirestorePermissionError) => {
      // Set error in state to trigger a re-render.
      setError(error);
    };

    // The typed emitter will enforce that the callback for 'permission-error'
    // matches the expected payload type (FirestorePermissionError).
    errorEmitter.on('permission-error', handleError);

    // Unsubscribe on unmount to prevent memory leaks.
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  const handleLogout = async () => {
    try {
      setIsSigningOut(true);
      await signOut(getAuth());
    } finally {
      window.location.href = '/login';
    }
  };

  // En lugar de lanzar la excepción y bloquear toda la app,
  // mostramos un panel que permite cerrar sesión y continuar.
  if (error) {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] w-[min(92vw,30rem)] rounded-lg border bg-card p-4 shadow-2xl">
        <h3 className="text-sm font-semibold text-foreground">Error de permisos de Firebase</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Tu sesión no tiene permisos para una consulta activa. Puedes cerrar sesión y volver a entrar.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setError(null)}>
            Cerrar aviso
          </Button>
          <Button size="sm" onClick={handleLogout} disabled={isSigningOut}>
            {isSigningOut ? 'Cerrando...' : 'Cerrar sesión'}
          </Button>
        </div>
      </div>
    );
  }

  // This component renders nothing.
  return null;
}
