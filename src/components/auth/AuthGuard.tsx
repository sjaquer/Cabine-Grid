"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '../ui/skeleton';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
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

  return <>{children}</>;
}
