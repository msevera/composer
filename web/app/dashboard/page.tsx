'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SVGProps } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import { authClient } from '@/lib/better-auth-client';
import { apolloClient } from '@/lib/apollo-client';
import {
  GET_ME,
  UPDATE_SEND_PRODUCT_UPDATES,
  SET_ONBOARDING_COMPLETED,
} from '@/lib/graphql/user-queries';
import { Home, Settings, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const EXTENSION_ORIGINS = process.env.NEXT_PUBLIC_CHROME_EXTENSION_ORIGINS;
const extensionOrigins = (EXTENSION_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
const EXTENSION_INSTALL_URL =
  process.env.NEXT_PUBLIC_EXTENSION_INSTALL_URL || 'https://chromewebstore.google.com/';

const buttonBase =
  'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

const GmailIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="52 42 88 66" aria-hidden="true" {...props}>
    <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
    <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
    <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
    <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
    <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
  </svg>
);

const NotionIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 100 100" aria-hidden="true" {...props}>
    <path d="M6.017 4.313l55.333 -4.087c6.797 -0.583 8.543 -0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277 -1.553 6.807 -6.99 7.193L24.467 99.967c-4.08 0.193 -6.023 -0.39 -8.16 -3.113L3.3 79.94c-2.333 -3.113 -3.3 -5.443 -3.3 -8.167V11.113c0 -3.497 1.553 -6.413 6.017 -6.8z" fill="#fff"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M61.35 0.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723 0.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257 -3.89c5.433 -0.387 6.99 -2.917 6.99 -7.193V20.64c0 -2.21 -0.873 -2.847 -3.443 -4.733L74.167 3.143c-4.273 -3.107 -6.02 -3.5 -12.817 -2.917zM25.92 19.523c-5.247 0.353 -6.437 0.433 -9.417 -1.99L8.927 11.507c-0.77 -0.78 -0.383 -1.753 1.557 -1.947l53.193 -3.887c4.467 -0.39 6.793 1.167 8.54 2.527l9.123 6.61c0.39 0.197 1.36 1.36 0.193 1.36l-54.933 3.307 -0.68 0.047zM19.803 88.3V30.367c0 -2.53 0.777 -3.697 3.103 -3.893L86 22.78c2.14 -0.193 3.107 1.167 3.107 3.693v57.547c0 2.53 -0.39 4.67 -3.883 4.863l-60.377 3.5c-3.493 0.193 -5.043 -0.97 -5.043 -4.083zm59.6 -54.827c0.387 1.75 0 3.5 -1.75 3.7l-2.91 0.577v42.773c-2.527 1.36 -4.853 2.137 -6.797 2.137 -3.107 0 -3.883 -0.973 -6.21 -3.887l-19.03 -29.94v28.967l6.02 1.363s0 3.5 -4.857 3.5l-13.39 0.777c-0.39 -0.78 0 -2.723 1.357 -3.11l3.497 -0.97v-38.3L30.48 40.667c-0.39 -1.75 0.58 -4.277 3.3 -4.473l14.367 -0.967 19.8 30.327v-26.83l-5.047 -0.58c-0.39 -2.143 1.163 -3.7 3.103 -3.89l13.4 -0.78z" fill="#000"/>
  </svg>
);

type NavItem = {
  label: string;
  icon: LucideIcon;
  badge?: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isNotionConnected, setIsNotionConnected] = useState(false);
  const [isCheckingGmail, setIsCheckingGmail] = useState(false);
  const [isCheckingNotion, setIsCheckingNotion] = useState(false);
  const [isKnowledgeStepSkipped, setIsKnowledgeStepSkipped] = useState(false);
  const [isExtensionStepCompleted, setIsExtensionStepCompleted] = useState(false);
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);
  const [isCheckingExtension, setIsCheckingExtension] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const { data: userData, loading: userLoading, refetch: refetchUser } = useQuery(GET_ME, {
    client: apolloClient,
    skip: !isAuthenticated,
  });

  const user = userData?.me;

  const [updateSendProductUpdates] = useMutation(UPDATE_SEND_PRODUCT_UPDATES, {
    client: apolloClient,
  });

  const [setOnboardingCompleted, { loading: isUpdatingOnboarding }] = useMutation(
    SET_ONBOARDING_COMPLETED,
    {
      client: apolloClient,
    },
  );
  const navItems: NavItem[] = useMemo(
    () => [
      { label: 'Home', icon: Home },
      { label: 'Settings', icon: Settings },
    ],
    [],
  );

  const requiredGmailScopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
  ];

  const refreshConnections = useCallback(async () => {
    if (!isAuthenticated) {
      setIsGmailConnected(false);
      setIsNotionConnected(false);
      return;
    }

    try {
      setIsCheckingGmail(true);
      setIsCheckingNotion(true);
      const accounts = await authClient.listAccounts();
      const allAccounts = accounts.data ?? [];
      const gmailAccount = allAccounts.find((account: any) => account.providerId === 'google');
      const gmailHasScopes = requiredGmailScopes.every((scope) =>
        gmailAccount?.scopes?.includes?.(scope),
      );
      setIsGmailConnected(Boolean(gmailAccount && gmailHasScopes));
      setIsNotionConnected(Boolean(allAccounts.find((account: any) => account.providerId === 'notion')));
    } finally {
      setIsCheckingGmail(false);
      setIsCheckingNotion(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isNotionConnected) {
      setIsKnowledgeStepSkipped(false);
    }
  }, [isNotionConnected]);

  useEffect(() => {
    if (isExtensionInstalled) {
      setIsExtensionStepCompleted(true);
    }
  }, [isExtensionInstalled]);

  const detectExtension = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }
    setIsCheckingExtension(true);
    if (!extensionOrigins.length) {
      setIsExtensionInstalled(false);
      setIsCheckingExtension(false);
      return;
    }
    try {
      let isInstalled = false;
      for (const origin of extensionOrigins) {
        try {
          const response = await fetch(`${origin}/manifest.json`, { cache: 'no-cache' });
          if (response.ok) {
            isInstalled = true;
            break;
          }
        } catch (error) {
          console.warn(`Extension check failed for ${origin}`, error);
        }
      }
      setIsExtensionInstalled(isInstalled);
    } catch {
      setIsExtensionInstalled(false);
    } finally {
      setIsCheckingExtension(false);
    }
  }, []);

  const checkSession = useCallback(async () => {
    try {
      setIsCheckingAuth(true);
      const session = await authClient.getSession();
      if (session?.data?.user) {
        setIsAuthenticated(true);
        await refreshConnections();

        const storedPreference = typeof window !== 'undefined'
          ? window.localStorage.getItem('sendProductUpdates')
          : null;
        if (storedPreference !== null) {
          const sendProductUpdates = storedPreference === 'true';
          try {
            await updateSendProductUpdates({ variables: { sendProductUpdates } });
          } finally {
            window.localStorage.removeItem('sendProductUpdates');
          }
        }
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
  }, [refreshConnections, router, updateSendProductUpdates]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    detectExtension();
    window.addEventListener('focus', detectExtension);
    return () => {
      window.removeEventListener('focus', detectExtension);
    };
  }, [detectExtension]);

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

  const handleConnectGmail = async () => {
    setMessage('');
    try {
      await authClient.linkSocial({
        provider: 'google',
        callbackURL: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/calendar.readonly',
        ],
      });
    } catch (error: any) {
      setMessage(error?.message ?? 'Failed to connect Gmail');
    }
  };

  const handleDisconnectGmail = async () => {
    await authClient.unlinkAccount({ providerId: 'google' });
    await refreshConnections();
  };

  const handleConnectNotion = async () => {
    setMessage('');
    try {
      await authClient.linkSocial({
        provider: 'notion',
        callbackURL: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
      });
    } catch (error: any) {
      setMessage(error?.message ?? 'Failed to connect Notion');
    }
  };

  const handleDisconnectNotion = async () => {
    await authClient.unlinkAccount({ providerId: 'notion' });
    await refreshConnections();
  };

  const handleCompleteOnboarding = async () => {
    if (!user) return;
    try {
      await setOnboardingCompleted({ variables: { onboardingCompleted: true } });
      await refetchUser();
      setMessage('Onboarding complete! 🎉');
    } catch (error: any) {
      setMessage(error?.message ?? 'Failed to update onboarding status');
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.replace('/signup');
  };

  const onboardingSteps = useMemo(() => {
    return [
      {
        id: 'account',
        title: 'Create an account',
        description: 'You’re all set with your Composer AI workspace.',
        completed: true,
        action: null,
      },
      {
        id: 'email',
        title: 'Connect your email',
        description: 'Create email responses in seconds, not minutes.',
        completed: isGmailConnected,
        action: (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleConnectGmail}
              className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <GmailIcon className="h-4 w-4" />
              <span>Connect Gmail</span>
            </button>
          </div>
        ),
      },
      {
        id: 'knowledge',
        title: 'Connect your knowledge bases',
        description:
          'Our agent might use connected knowledge bases to draft the best responses.',
        completed: isNotionConnected || isKnowledgeStepSkipped,
        action: (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={isNotionConnected ? handleDisconnectNotion : handleConnectNotion}
              disabled={isCheckingNotion}
              className={`inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition ${isNotionConnected
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-600'
                : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
                }`}
            >
              <NotionIcon className="h-4 w-4" />
              <span>
                {isCheckingNotion
                  ? 'Checking…'
                  : isNotionConnected
                    ? 'Disconnect Notion'
                    : 'Connect Notion'}
              </span>
            </button>
            {!isNotionConnected && !isKnowledgeStepSkipped && (
              <button
                type="button"
                onClick={() => setIsKnowledgeStepSkipped(true)}
                className="text-sm font-semibold text-slate-400 transition hover:text-slate-600"
              >
                Skip for now
              </button>
            )}
            {isKnowledgeStepSkipped && !isNotionConnected && (
              <span className="text-xs font-medium text-slate-400">
                Skipped — you can connect later.
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'extension',
        title: 'Install Chrome extension',
        description: 'Our Chrome extension agent will help you create responses in seconds not minutes.',
        completed: isExtensionStepCompleted,
        action: (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => window.open(EXTENSION_INSTALL_URL, '_blank', 'noreferrer')}
              disabled={isExtensionInstalled || isCheckingExtension}
              className={`inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition ${isExtensionInstalled
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-600 cursor-not-allowed'
                : 'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500'
                }`}
            >
              {isCheckingExtension
                ? 'Checking…'
                : isExtensionInstalled
                  ? 'Installed'
                  : 'Install Extension'}
            </button>
            {isExtensionInstalled && (
              <button
                type="button"
                onClick={() => setIsExtensionStepCompleted(true)}
                className="text-sm font-semibold text-slate-400 transition hover:text-slate-600"
              >
                Continue
              </button>
            )}
          </div>
        ),
      },
      {
        id: 'start',
        title: 'Start your free trial',
        description: 'Experience the full potential of Composer AI.',
        completed: Boolean(user?.onboardingCompleted),
        action: (
          <button
            disabled={!isGmailConnected || user?.onboardingCompleted || isUpdatingOnboarding}
            onClick={handleCompleteOnboarding}
            className={`inline-flex min-w-[160px] items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white ${user?.onboardingCompleted
              ? 'bg-emerald-100 text-emerald-500'
              : 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-500'
              }`}
          >
            {user?.onboardingCompleted ? 'Ready to go!' : 'Start free trial'}
          </button>
        ),
      },
    ];
  }, [
    handleCompleteOnboarding,
    handleConnectGmail,
    handleConnectNotion,
    handleDisconnectNotion,
    isCheckingExtension,
    isCheckingNotion,
    isExtensionInstalled,
    isExtensionStepCompleted,
    isGmailConnected,
    isKnowledgeStepSkipped,
    isNotionConnected,
    isUpdatingOnboarding,
    user?.onboardingCompleted,
  ]);

  const shouldShowOnboarding = !user?.onboardingCompleted;

  const dashboardGreeting =
    user?.name || (user?.email ? user.email.split('@')[0] : 'there');

  const loadingState = isCheckingAuth || userLoading;

  if (loadingState) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-sm text-slate-500">
        Loading dashboard…
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
                {navItems.map((item, index) => {
                  const Icon = item.icon;
                  const active = index === 0;
                  return (
                    <button
                      key={item.label}
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
          <div className="rounded-3xl bg-white p-6 shadow-sm lg:p-8">
            <div className="mb-6 flex flex-col gap-2">
              <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
              <p className="text-sm text-slate-500">Welcome back, {dashboardGreeting}</p>
            </div>

            {message && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {message}
              </div>
            )}

            {shouldShowOnboarding ? (
              <OnboardingTimeline steps={onboardingSteps} />
            ) : (
              <div>
                <div className="pt-6 mt-6 border-t border-slate-100 bg-white mb-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-800 mb-2">
                    Integrations
                  </p>
                  <p className="text-sm text-slate-500">
                    Manage your connected services
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <IntegrationStatusCard
                    name="Gmail"
                    description="Create responses with your Gmail context."
                    isConnected={isGmailConnected}
                    isChecking={isCheckingGmail}
                    onConnect={handleConnectGmail}
                    onDisconnect={handleDisconnectGmail}
                    connectLabel="Connect Gmail"
                    disconnectLabel="Disconnect"
                    actionLabel="Connect Gmail"
                    disableDisconnect
                  />
                  <IntegrationStatusCard
                    name="Notion"
                    description="Ground replies with documents and notes."
                    isConnected={isNotionConnected}
                    isChecking={isCheckingNotion}
                    onConnect={handleConnectNotion}
                    onDisconnect={handleDisconnectNotion}
                    connectLabel="Connect Notion"
                    disconnectLabel="Disconnect"
                    actionLabel="Connect Notion"
                  />
                  <IntegrationStatusCard
                    name="Chrome extension"
                    description="Reply directly from Gmail."
                    isConnected={isExtensionInstalled}
                    isChecking={isCheckingExtension}
                    onConnect={() => window.open(EXTENSION_INSTALL_URL, '_blank', 'noreferrer')}
                    connectLabel="Install extension"
                    disconnectLabel="Installed"
                    actionLabel="Chrome Extension"
                    disableDisconnect
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

type IntegrationStatusCardProps = {
  name: string;
  description: string;
  isConnected: boolean;
  isChecking: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  connectLabel: string;
  disconnectLabel?: string;
  actionLabel: string;
  disableDisconnect?: boolean;
};

function IntegrationStatusCard({
  name,
  description,
  isConnected,
  isChecking,
  onConnect,
  onDisconnect,
  connectLabel,
  disconnectLabel,
  actionLabel,
  disableDisconnect,
}: IntegrationStatusCardProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {name}
          </p>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${isConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
        >
          {isConnected ? 'Connected' : 'Not connected'}
        </span>
      </div>
      <div className="mt-auto pt-4">
        {isConnected ? (
          <button
            disabled={disableDisconnect || isChecking}
            onClick={onDisconnect}
            className={`${buttonBase} w-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300`}
          >
            {isChecking ? 'Checking…' : disconnectLabel ?? 'Disconnect'}
          </button>
        ) : (
          <button
            disabled={isChecking}
            onClick={onConnect}
            className={`${buttonBase} w-full bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300`}
          >
            {isChecking ? 'Checking…' : connectLabel}
          </button>
        )}
      </div>
    </div>
  );
}

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action: React.ReactNode;
};

function OnboardingTimeline({ steps }: { steps: OnboardingStep[] }) {
  const activeStepIndex = steps.findIndex((step) => !step.completed);

  return (
    <div className="pt-6 mt-6 border-t border-slate-100 bg-white">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-800 mb-2">
        Complete your setup
      </p>
      <p className="text-sm text-slate-500">
        Unlock Composer AI’s full potential in a few simple steps.
      </p>

      <div className="mt-8">
        <ol className="relative space-y-6">
          {steps.map((step, index) => (
            <li key={step.id} className="relative flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold ${step.completed
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-200 bg-white text-slate-500'
                    }`}
                >
                  {step.completed ? '✓' : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`mt-2 w-px flex-1 ${step.completed ? 'bg-emerald-200' : 'bg-slate-200'
                      }`}
                  />
                )}
              </div>
              <div
                className={`flex-1 ${activeStepIndex === index
                  ? 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
                  : 'py-2'
                  }`}
              >
                <p
                  className={`text-sm font-semibold ${step.completed
                    ? 'text-slate-500'
                    : activeStepIndex === index
                      ? 'text-slate-900'
                      : 'text-slate-400'
                    }`}
                >
                  {step.title}
                </p>
                {activeStepIndex === index && (
                  <>
                    <p className="mt-1 text-sm text-slate-500">{step.description}</p>
                    <div className="mt-4">{step.action}</div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

