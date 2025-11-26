'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/better-auth-client';

export default function HomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    authClient
      .getSession()
      .then((session) => {
        if (!isMounted) return;
        if (session?.data?.user) {
          router.replace('/dashboard');
        } else {
          router.replace('/signup');
        }
      })
      .catch(() => {
        if (!isMounted) return;
        router.replace('/signup');
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white text-sm text-slate-500">
      Redirecting…
    </main>
  );
}

