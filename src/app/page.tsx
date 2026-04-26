export const dynamic = 'force-dynamic';

import AuthGuard from '@/components/auth/AuthGuard';
import Dashboard from '@/components/dashboard/Dashboard';

export default function Home() {
  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col">
        <Dashboard />
      </div>
    </AuthGuard>
  );
}
