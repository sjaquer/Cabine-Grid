"use client";

import { useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';

type AppSecuritySettings = {
  requireVerifiedEmailForFullAccess?: boolean;
  requireMfaForFullAccess?: boolean;
};

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const firestore = useFirestore();
  const router = useRouter();

  const securitySettingsRef = useMemoFirebase(() => doc(firestore, 'appSettings', 'security'), [firestore]);
  const { data: securitySettings, isLoading: isSecurityLoading } = useDoc<AppSecuritySettings>(securitySettingsRef);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const isEmailVerificationRequired =
    securitySettings?.requireVerifiedEmailForFullAccess ?? Boolean(securitySettings?.requireMfaForFullAccess);
  const canAccessFullApp = !isEmailVerificationRequired || Boolean(user?.emailVerified);

  if (loading || isSecurityLoading || !user) {
    return (
        <div className="flex flex-col h-screen">
            <header className="px-4 lg:px-6 h-16 flex items-center border-b">
                 <Skeleton className="h-8 w-32" />
                 <div className="ml-auto flex gap-4">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                 </div>
            </header>
            <main className="flex-1 p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6">
                    {Array.from({length: 12}).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
                </div>
            </main>
        </div>
    );
  }

  if (!canAccessFullApp) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-lg rounded-lg border bg-card p-6 text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Correo verificado requerido</h1>
          <p className="text-muted-foreground">
            Para ver todo Cabine Grid, verifica tu correo desde el enlace enviado a tu bandeja de entrada.
          </p>
          <Button onClick={() => router.push('/login')} className="w-full sm:w-auto">
            Ir al login
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
