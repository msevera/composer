'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { authClient } from '@/lib/better-auth-client';
import { useMutation, useQuery } from '@apollo/client';
import { GET_ALL_INDEXING_STATUSES, START_INDEXING } from '@/lib/graphql/indexing-queries';
import { apolloClient } from '@/lib/apollo-client';

const buttonBase =
  'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const pillButtonBase =
  'inline-flex min-w-[6rem] items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition';

interface PlatformStatus {
  platform: string;
  status: string;
  totalIndexed: number;
  lastSyncedAt?: string;
  errorMessage?: string;
}

const formatDate = (date?: string) => {
  if (!date) return 'Never';
  return new Date(date).toLocaleString();
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'syncing':
      return 'text-blue-700 bg-blue-50 border-blue-200';
    case 'error':
      return 'text-red-700 bg-red-50 border-red-200';
    default:
      return 'text-slate-700 bg-slate-50 border-slate-200';
  }
};

type IntegrationCardProps = {
  id: string;
  name: string;
  description: string;
  features: string[];
  isConnected: boolean;
  isChecking: boolean;
  connectLabel: string;
  connectButtonClasses: string;
  onConnect?: () => void | Promise<void>;
  disconnectLabel?: string;
  onDisconnect?: () => void | Promise<void>;
  metricLabel?: string;
  status?: PlatformStatus;
  comingSoon?: boolean;
  onStartIndexing?: (platform: string) => void;
};

const IntegrationCard = ({
  id,
  name,
  description,
  features,
  isConnected,
  isChecking,
  connectLabel,
  connectButtonClasses,
  onConnect,
  disconnectLabel,
  onDisconnect,
  metricLabel,
  status,
  comingSoon,
  onStartIndexing,
}: IntegrationCardProps) => {
  if (isChecking) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center shadow-sm">
        <p className="text-sm text-slate-600">Checking {name} connection...</p>
      </div>
    );
  }

  const normalizedStatus = status?.status ?? 'idle';
  const statusLabel = normalizedStatus.toUpperCase();
  const statusClasses = getStatusColor(normalizedStatus);
  const canConnect = Boolean(onConnect) && !comingSoon;
  const canDisconnect = Boolean(onDisconnect);
  const showIndexing = Boolean(isConnected && !comingSoon && metricLabel && onStartIndexing);
  const isSyncing = normalizedStatus === 'syncing';
  const metricDisplayLabel = metricLabel ?? 'Items indexed';

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {isConnected ? 'Connected' : comingSoon ? 'Coming Soon' : 'Not Connected'}
          </p>
          <h3 className="text-xl font-semibold text-slate-900">{name}</h3>
        </div>
        <div className="flex items-center gap-2">
          {comingSoon && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
              Coming soon
            </span>
          )}
          {isConnected && canDisconnect && (
            <button
              onClick={onDisconnect}
              className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
            >
              {disconnectLabel ?? 'Disconnect'}
            </button>
          )}
        </div>
      </div>

      {!isConnected && (
        <>
          <p className="mt-3 text-sm text-slate-600">{description}</p>

          <ul className="mt-4 space-y-1 text-sm text-slate-600">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-300" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {showIndexing && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Indexing status</p>
              <p className="text-xs text-slate-500">
                {status?.lastSyncedAt ? `Last synced ${formatDate(status.lastSyncedAt)}` : 'Not synced yet'}
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${statusClasses}`}
            >
              {statusLabel}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500">{metricDisplayLabel}</p>
              <p className="text-lg font-semibold text-slate-900">{status?.totalIndexed ?? 0}</p>
            </div>
            <div>
              <p className="text-slate-500">Last synced</p>
              <p className="text-lg font-semibold text-slate-900">
                {status?.lastSyncedAt ? formatDate(status.lastSyncedAt) : 'Never'}
              </p>
            </div>
          </div>

          {isSyncing ? (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              Indexing in progress...
            </div>
          ) : (
            <button
              onClick={() => onStartIndexing?.(id)}
              className={`${buttonBase} mt-4 w-full bg-slate-900 text-white shadow-sm hover:bg-slate-800 focus-visible:outline-slate-900`}
            >
              {(status?.totalIndexed ?? 0) > 0 ? 'Re-index' : 'Start Indexing'}
            </button>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-6">
        {!isConnected && (
          <button
            onClick={canConnect ? onConnect : undefined}
            disabled={!canConnect}
            className={`${buttonBase} w-full ${canConnect ? connectButtonClasses : 'cursor-not-allowed bg-slate-200 text-slate-500'}`}
          >
            {connectLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isCheckingGmail, setIsCheckingGmail] = useState(false);
  const [isNotionConnected, setIsNotionConnected] = useState(false);
  const [isCheckingNotion, setIsCheckingNotion] = useState(false);

  // Fetch indexing statuses
  const { data: statusData, refetch: refetchStatuses } = useQuery(
    GET_ALL_INDEXING_STATUSES,
    {
      client: apolloClient,
      skip: !isAuthenticated || !isNotionConnected,
      fetchPolicy: 'network-only',
    }
  );

  console.log('statusData', statusData)

  const [startIndexing] = useMutation(START_INDEXING, {
    client: apolloClient,
  });

  const statuses: PlatformStatus[] = statusData?.getAllIndexingStatuses || [];

  const statusByPlatform = useMemo(() => {
    return statuses.reduce<Record<string, PlatformStatus>>((acc, status) => {
      acc[status.platform] = status;
      return acc;
    }, {});
  }, [statuses]);

  const handleStartIndexing = async (platform: string) => {
    try {
      await startIndexing({ variables: { platform } });
      await refetchStatuses();
    } catch (error: any) {
      console.error(`Error starting ${platform} indexing:`, error);
    }
  };

  const checkGmailConnection = useCallback(async () => {
    if (!isAuthenticated) {
      setIsGmailConnected(false);
      setIsCheckingGmail(false);
      return;
    }

    try {
      setIsCheckingGmail(true);
      const accounts = await authClient.listAccounts();
      const googleAccount = accounts.data?.find((account: any) => account.providerId === 'google');
      setIsGmailConnected(Boolean(googleAccount));
    } finally {
      setIsCheckingGmail(false);
    }
  }, [isAuthenticated]);

  const checkNotionConnection = useCallback(async () => {
    if (!isAuthenticated) {
      setIsNotionConnected(false);
      setIsCheckingNotion(false);
      return;
    }

    try {
      setIsCheckingNotion(true);
      const accounts = await authClient.listAccounts();
      const notionAccount = accounts.data?.find((account: any) => account.providerId === 'notion');
      setIsNotionConnected(Boolean(notionAccount));
    } finally {
      setIsCheckingNotion(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    authClient
      .getSession({
        fetchOptions: {
          onSuccess: (ctx)=>{
            const jwt = ctx.response.headers.get("set-auth-jwt")
            console.log('jwt', jwt)
          }
        },
      })
      .then((session) => {
        if (session?.data?.user) {
          setIsAuthenticated(true);
          checkGmailConnection();
          checkNotionConnection();
        } else if (session?.error) {
          console.log('No active session (user not logged in)');
        }
      })
      .catch((error) => {
        if (error?.status !== 401) {
          console.log('Session check error:', error);
        }
      });
  }, [checkGmailConnection, checkNotionConnection]);

  // No automatic indexing - user must click button

  useEffect(() => {
    if (isAuthenticated) {
      checkGmailConnection();
      checkNotionConnection();
    }
  }, [isAuthenticated, checkGmailConnection, checkNotionConnection]);

  const handleConnectGmail = async () => {
    try {
      await authClient.linkSocial({
        provider: 'google',
        callbackURL: 'http://localhost:3000/',
      });
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleConnectNotion = async () => {
    try {
      await authClient.linkSocial({
        provider: 'notion',
        callbackURL: 'http://localhost:3000/',
      });
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleDisconnectNotion = async () => {   
    await authClient.unlinkAccount({ providerId: "notion" });
    setIsNotionConnected(false);
    refetchStatuses();
  };

  const handleDisconnectGmail = async () => {
    await authClient.unlinkAccount({ providerId: "google" });
    setIsGmailConnected(false);  
    if (isNotionConnected) {
      await refetchStatuses();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      if (isSignUp) {
        const result = await authClient.signUp.email({
          email,
          password,
          name: email.split('@')[0],
        });

        if (result.error) {
          setMessage(`Error: ${result.error.message}`);
        } else {
          setMessage('User registered successfully!');
          setIsAuthenticated(true);
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });

        if (result.error) {
          setMessage(`Error: ${result.error.message}`);
        } else {
          setMessage('Signed in successfully!');
          setIsAuthenticated(true);
        }
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      setIsAuthenticated(false);
      setMessage('Signed out successfully!');
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const alertClasses = useMemo(() => {
    if (!message) return '';
    const isError = message.toLowerCase().includes('error');
    return isError
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }, [message]);

  const integrationCards: IntegrationCardProps[] = [
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Use Gmail OAuth to sign in to Smail and unlock upcoming Gmail-aware workflows.',
      features: [
        'Authenticate with your Google account in one click',
        'Securely manage Gmail access tokens via Better Auth',
        'Stay ready for future Gmail-powered automations',
      ],
      isConnected: isGmailConnected,
      isChecking: isCheckingGmail,
      connectLabel: 'Connect Gmail Account',
      connectButtonClasses:
        'bg-blue-600 text-white shadow-sm hover:bg-blue-500 focus-visible:outline-blue-600',
      disconnectLabel: 'Disconnect Gmail Account',
      onConnect: handleConnectGmail,
      onDisconnect: handleDisconnectGmail,
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Bring your Notion docs into Smail to ground email replies in your knowledge base.',
      features: [
        'Index pages and databases automatically',
        'Search Notion content during composition',
        'Blend workspace knowledge into replies',
      ],
      isConnected: isNotionConnected,
      isChecking: isCheckingNotion,
      connectLabel: 'Connect Notion Workspace',
      connectButtonClasses:
        'bg-purple-600 text-white shadow-sm hover:bg-purple-500 focus-visible:outline-purple-600',
      disconnectLabel: 'Disconnect Notion Workspace',
      onConnect: handleConnectNotion,
      onDisconnect: handleDisconnectNotion,
      metricLabel: 'Pages indexed',
    },
    {
      id: 'twitter',
      name: 'Twitter',
      description: 'Soon you will be able to mirror tweets and threads to inform AI replies.',
      features: [
        'Index tweets and threads (coming soon)',
        'Reference social context in replies',
        'Centralize public persona insights',
      ],
      isConnected: false,
      isChecking: false,
      connectLabel: 'Twitter integration coming soon',
      connectButtonClasses: 'bg-slate-200 text-slate-500',
      metricLabel: undefined,
      comingSoon: true,
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-semibold text-slate-900">Smail Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage your multi-platform AI email assistant
        </p>
      </header>

      {!isAuthenticated ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-center gap-3">
            <button
              onClick={() => setIsSignUp(false)}
              className={`${pillButtonBase} ${!isSignUp
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              className={`${pillButtonBase} ${isSignUp ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <button
              type="submit"
              className={`${buttonBase} w-full bg-blue-600 text-white shadow-sm hover:bg-blue-500 focus-visible:outline-blue-600`}
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>

          {message && (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${alertClasses}`}>{message}</div>
          )}
        </section>
      ) : (
        <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-lg font-semibold text-slate-900">You are authenticated! 🎉</p>
            <p className="mt-1 text-sm text-slate-600">Link your data sources to unlock indexing and AI workflows.</p>
          </div>

          <div className="flex flex-col gap-4">
            {integrationCards.map((card) => (
              <IntegrationCard
                key={card.id}
                {...card}
                status={statusByPlatform[card.id]}
                onStartIndexing={card.id === 'notion' ? handleStartIndexing : undefined}
              />
            ))}
          </div>

          {message && (
            <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${alertClasses}`}>{message}</div>
          )}

          <button
            onClick={handleSignOut}
            className={`${buttonBase} bg-slate-900 text-white shadow-sm hover:bg-slate-800 focus-visible:outline-slate-900`}
          >
            Sign Out
          </button>
        </section>
      )}
    </main>
  );
}

