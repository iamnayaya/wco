'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../../components/layout/sidebar';
import { Header } from '../../components/layout/header';
import { useAuthStore } from '../../store/slices/auth-slice';
import { setUnauthorizedHandler } from '../../lib/api/client';

/**
 * Dashboard shell — auth gate + layout.
 * Auth-gated: redirects to /login when unauthenticated.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) router.replace('/login');
    setUnauthorizedHandler(() => {
      useAuthStore.getState().clearSession();
      router.replace('/login');
    });
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
