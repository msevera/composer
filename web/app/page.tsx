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
      skip: !isAuthenticated || (!isGmailConnected && !isNotionConnected),
      pollInterval: 3000, // Poll every 3 seconds
      fetchPolicy: 'network-only',
    }
  );

  const [startIndexing] = useMutation(START_INDEXING, {
    client: apolloClient,
  });

  const statuses: PlatformStatus[] = statusData?.getAllIndexingStatuses || [];

  const handleStartIndexing = async (platform: string) => {
    try {
      await startIndexing({ variables: { platform } });
      await refetchStatuses();
    } catch (error: any) {
      console.error(`Error starting ${platform} indexing:`, error);
    }
  };

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

  interface PlatformStatus {
    platform: string;
    status: string;
    totalIndexed: number;
    lastSyncedAt?: string;
    errorMessage?: string;
  }

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
      .getSession()
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
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: 'http://localhost:3000/',
      });
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleConnectNotion = async () => {
    try {
      await authClient.signIn.social({
        provider: 'notion',
        callbackURL: 'http://localhost:3000/',
      });
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleDisconnectNotion = async () => {
    // try {
    //   const result = await disconnectNotion();
    //   if (result.data?.disconnectNotion) {
    //     setMessage('Notion account disconnected successfully!');
    //     setIsNotionConnected(false);
    //     await refetchNotion();
    //   } else {
    //     setMessage('Failed to disconnect Notion account');
    //   }
    // } catch (error: any) {
    //   setMessage(`Error: ${error.message}`);
    // }
    // checkNotionConnection();
  };

  const handleDisconnectGmail = async () => {
    try {
      // Use GraphQL mutation to disconnect
      const graphqlUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          query: `
            mutation {
              disconnectGmail
            }
          `,
        }),
      });

      const result = await response.json();

      if (result.errors) {
        setMessage(`Error: ${result.errors[0].message}`);
      } else if (result.data?.disconnectGmail) {
        setMessage('Gmail account disconnected successfully!');
        setIsGmailConnected(false);
      } else {
        setMessage('Failed to disconnect Gmail account');
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }

    checkGmailConnection();
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
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-lg font-semibold text-slate-900">You are authenticated! 🎉</p>

          {isCheckingGmail ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-600">Checking Gmail connection...</p>
            </div>
          ) : !isGmailConnected ? (
            <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-6">
              <div>
                <h2 className="text-xl font-semibold text-blue-900">Connect Your Gmail</h2>
                <p className="mt-1 text-sm text-blue-800">Connect your Gmail account to:</p>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-blue-900">
                <li>Read and manage your emails</li>
                <li>Read your calendar events</li>
              </ul>
              <button
                onClick={handleConnectGmail}
                className={`${buttonBase} bg-blue-600 text-white shadow-sm hover:bg-blue-500 focus-visible:outline-blue-600`}
              >
                Connect Gmail Account
              </button>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6">
              <div className="flex items-center gap-2 text-emerald-700">
                <span className="text-2xl">✓</span>
                <h2 className="text-xl font-semibold">Gmail Account Connected</h2>
              </div>
              <p className="text-sm text-emerald-800">
                Your Gmail account is connected. You can now read emails, send emails, and manage your calendar.
              </p>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={handleDisconnectGmail}
                    className={`${buttonBase} bg-rose-600 text-white shadow-sm hover:bg-rose-500 focus-visible:outline-rose-600`}
                  >
                    Disconnect Gmail Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notion Connection Section */}
          {isCheckingNotion ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-600">Checking Notion connection...</p>
            </div>
          ) : !isNotionConnected ? (
            <div className="space-y-4 rounded-2xl border border-purple-200 bg-purple-50/80 p-6">
              <div>
                <h2 className="text-xl font-semibold text-purple-900">Connect Your Notion</h2>
                <p className="mt-1 text-sm text-purple-800">Connect your Notion workspace to:</p>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-purple-900">
                <li>Index your Notion pages and databases</li>
                <li>Use Notion content for AI-powered email composition</li>
                <li>Search across your Notion knowledge base</li>
              </ul>
              <button
                onClick={handleConnectNotion}
                className={`${buttonBase} bg-purple-600 text-white shadow-sm hover:bg-purple-500 focus-visible:outline-purple-600`}
              >
                Connect Notion Workspace
              </button>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6">
              <div className="flex items-center gap-2 text-emerald-700">
                <span className="text-2xl">✓</span>
                <h2 className="text-xl font-semibold">Notion Workspace Connected</h2>
              </div>
              <p className="text-sm text-emerald-800">
                Your Notion workspace is connected. You can now index pages and use them for AI-powered composition.
              </p>
              <button
                onClick={handleDisconnectNotion}
                className={`${buttonBase} bg-rose-600 text-white shadow-sm hover:bg-rose-500 focus-visible:outline-rose-600`}
              >
                Disconnect Notion Workspace
              </button>
            </div>
          )}

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

      {isAuthenticated && (isGmailConnected || isNotionConnected) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            Indexing Status
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Gmail Status Card */}
            {statuses.find((s) => s.platform === 'gmail') && (
              <div
                className={`rounded-xl border p-4 ${getStatusColor(
                  statuses.find((s) => s.platform === 'gmail')?.status || 'idle'
                )}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Gmail</h3>
                  <span className="text-sm font-medium">
                    {statuses.find((s) => s.platform === 'gmail')?.status.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Emails Indexed:</span>{' '}
                    {statuses.find((s) => s.platform === 'gmail')?.totalIndexed || 0}
                  </div>
                  <div>
                    <span className="font-medium">Last Synced:</span>{' '}
                    {formatDate(
                      statuses.find((s) => s.platform === 'gmail')?.lastSyncedAt
                    )}
                  </div>
                </div>

                {statuses.find((s) => s.platform === 'gmail')?.status !== 'syncing' && (
                  <button
                    onClick={() => handleStartIndexing('gmail')}
                    className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    {(statuses.find((s) => s.platform === 'gmail')?.totalIndexed || 0) > 0
                      ? 'Re-index'
                      : 'Start Indexing'}
                  </button>
                )}

                {statuses.find((s) => s.platform === 'gmail')?.status === 'syncing' && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                    <span className="text-sm">Indexing in progress...</span>
                  </div>
                )}
              </div>
            )}

            {/* Notion Status Card */}
            {statuses.find((s) => s.platform === 'notion') ? (
              <div
                className={`rounded-xl border p-4 ${getStatusColor(
                  statuses.find((s) => s.platform === 'notion')?.status || 'idle'
                )}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Notion</h3>
                  <span className="text-sm font-medium">
                    {statuses.find((s) => s.platform === 'notion')?.status.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Pages Indexed:</span>{' '}
                    {statuses.find((s) => s.platform === 'notion')?.totalIndexed || 0}
                  </div>
                  <div>
                    <span className="font-medium">Last Synced:</span>{' '}
                    {formatDate(
                      statuses.find((s) => s.platform === 'notion')?.lastSyncedAt
                    )}
                  </div>
                </div>

                {statuses.find((s) => s.platform === 'notion')?.status !== 'syncing' && (
                  <button
                    onClick={() => handleStartIndexing('notion')}
                    className="mt-4 w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
                  >
                    {(statuses.find((s) => s.platform === 'notion')?.totalIndexed || 0) > 0
                      ? 'Re-index'
                      : 'Start Indexing'}
                  </button>
                )}

                {statuses.find((s) => s.platform === 'notion')?.status === 'syncing' && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-600 border-t-transparent"></div>
                    <span className="text-sm">Indexing in progress...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-600">Notion</h3>
                  <span className="text-sm font-medium text-slate-500">
                    {isNotionConnected ? 'NOT CONNECTED' : 'NOT CONNECTED'}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {isNotionConnected
                    ? 'Connect your Notion workspace above to start indexing.'
                    : 'Connect your Notion workspace to index pages and databases.'}
                </p>
              </div>
            )}

            {/* Twitter Status Card (placeholder) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-600">Twitter</h3>
                <span className="text-sm font-medium text-slate-500">COMING SOON</span>
              </div>
              <p className="text-sm text-slate-500">
                Connect your Twitter account to index tweets and threads.
              </p>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

