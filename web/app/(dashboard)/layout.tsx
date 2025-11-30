'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { authClient } from '@/lib/better-auth-client';
import { apolloClient } from '@/lib/apollo-client';
import { GET_ME } from '@/lib/graphql/user-queries';
import { Home, Settings, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type NavItem = {
  label: string;
  icon: LucideIcon;
  badge?: string;
  href: string;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const { data: userData, loading: userLoading } = useQuery(GET_ME, {
    client: apolloClient,
    skip: !isAuthenticated,
  });

  const user = userData?.me;

  const navItems: NavItem[] = useMemo(
    () => [
      { label: 'Home', icon: Home, href: '/dashboard' }
    ],
    [],
  );

  const checkSession = useCallback(async () => {
    try {
      setIsCheckingAuth(true);
      const session = await authClient.getSession();
      if (session?.data?.user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        router.replace('/signup');
      }
    } catch {
      setIsAuthenticated(false);
      router.replace('/signup');
    } finally {
      setIsCheckingAuth(false);
    }
  }, [router]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.replace('/signup');
  };

  const loadingState = isCheckingAuth || userLoading;

  if (loadingState) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-sm text-slate-500">
        Loading…
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
        <div className="w-full lg:w-72">
          <aside className="fixed flex w-full flex-col justify-between rounded-3xl bg-white p-6 shadow-sm lg:w-72 lg:top-6 lg:h-[calc(100vh-3rem)]">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-900">Composer AI</p>
                  <p className="text-xs text-slate-500">Intelligent reply assistant</p>
                </div>
              </div>
              <nav className="mt-10 space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <button
                      key={item.label}
                      onClick={() => router.push(item.href)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold ${active
                        ? 'bg-slate-50 text-slate-900'
                        : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? 'text-slate-900' : 'text-slate-400'}`} />
                      {item.label}
                      {item.badge && (
                        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="border-t border-slate-100 pt-6">
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                      <UserRound className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{user?.name ?? user?.email}</p>
                      <p className="text-xs text-slate-500">{user?.email}</p>
                    </div>
                  </div>
                  <span className="text-slate-400">⋯</span>
                </button>
                {isUserMenuOpen && (
                  <div className="absolute right-0 bottom-[110%] w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        router.push('/profile');
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Account
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
        <section className="flex-1">
          {children}
        </section>
      </div>
    </div>
  );
}

