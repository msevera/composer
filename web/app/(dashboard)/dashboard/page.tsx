'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SVGProps } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import { Check } from 'lucide-react';
import { authClient } from '@/lib/better-auth-client';
import { apolloClient } from '@/lib/apollo-client';
import {
  GET_ME,
  UPDATE_SEND_PRODUCT_UPDATES,
  SET_ONBOARDING_COMPLETED,
} from '@/lib/graphql/user-queries';

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


export default function DashboardPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string>('');
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isCheckingGmail, setIsCheckingGmail] = useState(false);
  const [gmailAccounts, setGmailAccounts] = useState<Array<{ accountId: string; email?: string; scopes?: string[] }>>([]);
  const [isExtensionStepCompleted, setIsExtensionStepCompleted] = useState(false);
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);
  const [isCheckingExtension, setIsCheckingExtension] = useState(true);

  const { data: userData, loading: userLoading, refetch: refetchUser } = useQuery(GET_ME, {
    client: apolloClient,
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

  const requiredGmailScopes = useMemo(
    () => [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
    [],
  );

  const refreshConnections = useCallback(async () => {
    if (!user) {
      setIsGmailConnected(false);
      setGmailAccounts([]);
      return;
    }

    try {
      setIsCheckingGmail(true);
      const accounts = await authClient.listAccounts();
      const allAccounts = accounts.data ?? [];
      const gmailAccountsList = allAccounts.filter((account: any) => account.providerId === 'google');
      const validGmailAccounts = gmailAccountsList.filter((account: any) =>
        requiredGmailScopes.every((scope) => account?.scopes?.includes?.(scope))
      );
      
      setGmailAccounts(validGmailAccounts.map((account: any) => {
        console.log('account', JSON.stringify(account, null, 2));
        // Try multiple possible fields for email
        const email = account.email || account.accountEmail || account.profile?.email || account.user?.email || null;
        return {
          accountId: account.accountId || account.id || account._id,
          email: email,
          scopes: account.scopes,
        };
      }));
      setIsGmailConnected(validGmailAccounts.length > 0);
    } finally {
      setIsCheckingGmail(false);
    }
  }, [user, requiredGmailScopes]);


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

  useEffect(() => {
    if (user) {
      refreshConnections();

      const storedPreference = typeof window !== 'undefined'
        ? window.localStorage.getItem('sendProductUpdates')
        : null;
      if (storedPreference !== null) {
        const sendProductUpdates = storedPreference === 'true';
        updateSendProductUpdates({ variables: { sendProductUpdates } }).finally(() => {
          window.localStorage.removeItem('sendProductUpdates');
        });
      }
    }
  }, [user, refreshConnections, updateSendProductUpdates]);

  // Refresh connections when window regains focus (e.g., after OAuth popup)
  useEffect(() => {
    if (typeof window === 'undefined' || !user) {
      return;
    }
    const handleFocus = () => {
      refreshConnections();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, refreshConnections]);

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


  const handleConnectGmail = useCallback(async () => {
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
      // After OAuth redirect, refreshConnections will be called in checkSession
      // But we also refresh here in case the redirect doesn't trigger it
      await refreshConnections();
    } catch (error: any) {
      setMessage(error?.message ?? 'Failed to connect Gmail');
    }
  }, [refreshConnections]);

  const handleDisconnectGmail = async (accountId?: string) => {
    try {
      setMessage('');
      await authClient.unlinkAccount({ providerId: 'google', accountId });
      await refreshConnections();
      setMessage('Gmail account disconnected successfully');
    } catch (error: any) {
      console.error('Failed to disconnect Gmail account', error);
      setMessage(error?.message ?? 'Failed to disconnect Gmail account');
    }
  };


  const handleCompleteOnboarding = useCallback(async () => {
    if (!user) return;
    try {
      await setOnboardingCompleted({ variables: { onboardingCompleted: true } });
      await refetchUser();
      setMessage('Onboarding complete! 🎉');
    } catch (error: any) {
      setMessage(error?.message ?? 'Failed to update onboarding status');
    }
  }, [user, setOnboardingCompleted, refetchUser]);


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
        description: 'Add AI assistant to your Gmail account.',
        completed: isGmailConnected,
        action: (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleConnectGmail}
              className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-500 hover:to-violet-500"
            >
              <GmailIcon className="h-4 w-4" />
              <span>Connect Gmail</span>
            </button>
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
              className={`inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${isExtensionInstalled
                ? 'border border-emerald-200/50 bg-emerald-50/80 backdrop-blur-sm text-emerald-600 cursor-not-allowed shadow-sm'
                : 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-500 hover:to-violet-500 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none'
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
        title: 'Start',
        description: 'Experience the full potential of Composer AI.',
        completed: Boolean(user?.onboardingCompleted),
        action: (
            <button
              disabled={!isGmailConnected || user?.onboardingCompleted || isUpdatingOnboarding}
              onClick={handleCompleteOnboarding}
              className={`inline-flex min-w-[160px] items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition ${user?.onboardingCompleted
                ? 'bg-emerald-50/80 backdrop-blur-sm border border-emerald-200/50 text-emerald-600 cursor-not-allowed shadow-sm'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none'
                }`}
            >
              {'Ready to go!'}
            </button>
        ),
      },
    ];
  }, [
    handleCompleteOnboarding,
    handleConnectGmail,
    isCheckingExtension,
    isExtensionInstalled,
    isExtensionStepCompleted,
    isGmailConnected,
    isUpdatingOnboarding,
    user?.onboardingCompleted,
  ]);

  const shouldShowOnboarding = !user?.onboardingCompleted;

  const dashboardGreeting =
    user?.name || (user?.email ? user.email.split('@')[0] : 'there');

  if (userLoading) {
    return null;
  }

  return (
    <div>
            <div className="mb-8 flex flex-col gap-2">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-base text-slate-500">Welcome back, {dashboardGreeting}</p>
            </div>

            {message && (
              <div className="mt-4 mb-6 rounded-2xl border border-amber-200/50 bg-amber-50/80 backdrop-blur-sm px-4 py-3 text-sm text-amber-800 shadow-sm">
                {message}
              </div>
            )}

            {shouldShowOnboarding ? (
              <div className="rounded-2xl border border-slate-200/50 bg-white/60 backdrop-blur-sm p-6 shadow-sm">
                <OnboardingTimeline steps={onboardingSteps} />
              </div>
            ) : (
              <div>
                {/* Usage Statistics */}
                <div className="mb-6 rounded-2xl border border-slate-200/50 bg-white/60 backdrop-blur-sm p-6 shadow-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      Usage Statistics
                    </p>
                    <p className="text-base font-semibold text-slate-900">
                      Email drafts generated: <span className="text-blue-600">{user?.draftsUsed ?? 0}</span>
                    </p>
                  </div>
                  {(user?.draftsUsed ?? 0) >= (user?.maxDraftsAllowed ?? 10) && (
                    <div className="mt-4 rounded-xl border border-amber-200/50 bg-amber-50/80 backdrop-blur-sm px-4 py-3 text-sm text-amber-800 shadow-sm">
                      You&apos;ve reached your draft limit. Please reach out to{' '}
                      <a
                        href="mailto:michael.svr@gmail.com"
                        className="font-semibold underline hover:text-amber-900"
                      >
                        michael.svr@gmail.com
                      </a>{' '}
                      to upgrade your account.
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <div className="rounded-2xl border border-slate-200/50 bg-white/60 backdrop-blur-sm p-6 shadow-sm">
                    <div className="mb-6">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                        Integrations
                      </p>
                      <p className="text-base text-slate-600">
                        Manage your connected services
                      </p>
                    </div>
                    <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Gmail Accounts</p>
                        <p className="text-xs text-slate-500 mt-1">
                          You can connect multiple Gmail accounts.
                        </p>
                      </div>
                      <button
                        onClick={handleConnectGmail}
                        disabled={isCheckingGmail}
                        className={`${buttonBase} bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-500 hover:to-violet-500 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed`}
                      >
                        <GmailIcon className="h-4 w-4 mr-2" />
                        Connect Account
                      </button>
                    </div>
                    {isCheckingGmail ? (
                      <div className="rounded-2xl border border-slate-200/50 bg-white/60 backdrop-blur-sm p-4 text-sm text-slate-500 shadow-sm">
                        Checking accounts...
                      </div>
                    ) : gmailAccounts.length > 0 ? (
                      <div className="space-y-3">
                        {gmailAccounts.map((account) => (
                          <div
                            key={account.accountId}
                            className="flex items-center justify-between rounded-2xl border border-slate-200/50 bg-white/60 backdrop-blur-sm p-4 shadow-sm"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-blue-200/50">
                                <GmailIcon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {account.email || 'Gmail Account'}
                                </p>
                                <p className="text-xs text-slate-500">Connected</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDisconnectGmail(account.accountId)}
                              className={`${buttonBase} border border-slate-200/50 bg-white/80 backdrop-blur-sm text-slate-700 hover:bg-slate-50/80 transition-colors`}
                            >
                              Disconnect
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200/50 bg-white/60 backdrop-blur-sm p-6 text-center">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-blue-200/50 w-fit mx-auto mb-3">
                          <GmailIcon className="h-8 w-8 opacity-60" />
                        </div>
                        <p className="text-sm font-semibold text-slate-900 mb-1">No Gmail accounts connected</p>
                        <p className="text-xs text-slate-500 mb-4">
                          Connect a Gmail account to get started with Composer AI
                        </p>
                        <button
                          onClick={handleConnectGmail}
                          className={`${buttonBase} bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-500 hover:to-violet-500`}
                        >
                          <GmailIcon className="h-4 w-4 mr-2" />
                          Connect Account
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 mb-4">Chrome Extension</p>
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
                  </div>
                </div>
              </div>
            )}
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
    <div className="flex h-full flex-col rounded-2xl border border-slate-200/50 bg-white/60 backdrop-blur-sm p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {name}
          </p>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${isConnected ? 'bg-emerald-50/80 backdrop-blur-sm border border-emerald-200/50 text-emerald-700' : 'bg-slate-100/80 backdrop-blur-sm border border-slate-200/50 text-slate-500'
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
            className={`${buttonBase} w-full border border-slate-200/50 bg-white/80 backdrop-blur-sm text-slate-700 hover:bg-slate-50/80 disabled:cursor-not-allowed disabled:text-slate-300 transition-colors`}
          >
            {isChecking ? 'Checking…' : disconnectLabel ?? 'Disconnect'}
          </button>
        ) : (
          <button
            disabled={isChecking}
            onClick={onConnect}
            className={`${buttonBase} w-full bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none`}
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
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-700 mb-2">
          Complete your setup
        </h2>
        <p className="text-sm text-slate-500">
          Unlock Composer AI&apos;s full potential in a few simple steps.
        </p>
      </div>

      <div className="mt-8">
        <ol className="relative space-y-6">
          {steps.map((step, index) => (
            <li key={step.id} className="relative flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all ${step.completed
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                    }`}
                >
                  {step.completed ? <Check className="h-5 w-5" /> : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`mt-2 w-px flex-1 ${step.completed ? 'bg-emerald-200' : 'bg-slate-200/50'
                      }`}
                  />
                )}
              </div>
              <div
                className={`flex-1 ${activeStepIndex === index
                  ? 'rounded-2xl border border-slate-200/50 bg-white/60 backdrop-blur-sm p-4 shadow-sm'
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

