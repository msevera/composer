'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { authClient } from '@/lib/better-auth-client';
import { useMutation, useQuery } from '@apollo/client';
import { INDEX_INITIAL_EMAILS, HAS_INITIAL_INDEXING_COMPLETED } from '@/lib/graphql/email-queries';
import { GET_CURRENT_USER } from '@/lib/graphql/user-queries';
import { apolloClient } from '@/lib/apollo-client';
import Link from 'next/link';

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
  const [indexingStatus, setIndexingStatus] = useState<string>('');

  const [indexInitialEmails] = useMutation(INDEX_INITIAL_EMAILS, {
    client: apolloClient,
  });

  // Get current user with indexing status
  const { data: userData, refetch: refetchUser, loading: userLoading } = useQuery(
    GET_CURRENT_USER,
    {
      client: apolloClient,
      skip: !isAuthenticated,
      fetchPolicy: 'network-only',
      pollInterval: isAuthenticated && isGmailConnected ? 3000 : 0, // Poll every 3 seconds when authenticated and Gmail connected
    },
  );

  // Check if initial indexing has been completed (only when authenticated and Gmail is connected)
  const { data: indexingStatusData } = useQuery(
    HAS_INITIAL_INDEXING_COMPLETED,
    {
      client: apolloClient,
      skip: !isAuthenticated || !isGmailConnected,
      fetchPolicy: 'network-only',
    },
  );

  const user = userData?.me;
  const isEmailIndexingInProgress = user?.isEmailIndexingInProgress ?? false;
  const hasIndexed = indexingStatusData?.hasInitialIndexingCompleted ?? false;

  const triggerInitialIndexing = useCallback(async () => {
    // Prevent multiple calls - check backend status
    if (isEmailIndexingInProgress || hasIndexed) {
      return;
    }
    
    setIndexingStatus('Queuing indexing job...');
    try {
      const result = await indexInitialEmails();
      setIndexingStatus(result.data?.indexInitialEmails || 'Indexing job queued');
      // Refetch user to get updated indexing status
      await refetchUser();
      setTimeout(() => setIndexingStatus(''), 5000);
    } catch (error: any) {
      console.error('Error queuing indexing:', error);
      setIndexingStatus(`Error: ${error.message}`);
    }
  }, [indexInitialEmails, isEmailIndexingInProgress, hasIndexed, refetchUser]);

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

  useEffect(() => {
    authClient
      .getSession()
      .then((session) => {
        if (session?.data?.user) {
          setIsAuthenticated(true);
          checkGmailConnection();
        } else if (session?.error) {
          console.log('No active session (user not logged in)');
        }
      })
      .catch((error) => {
        if (error?.status !== 401) {
          console.log('Session check error:', error);
        }
      });

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('provider') === 'google' || window.location.pathname.includes('callback')) {
      setTimeout(async () => {
        await checkGmailConnection();
        window.history.replaceState({}, '', window.location.pathname);
      }, 1000);
    }
  }, [checkGmailConnection]);

  // No automatic indexing - user must click button

  useEffect(() => {
    if (isAuthenticated) {
      checkGmailConnection();
    }
  }, [isAuthenticated, checkGmailConnection]);

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
        <h1 className="text-3xl font-semibold text-slate-900">Snail Authentication</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in, create an account, and connect Gmail securely.</p>
      </header>

      {!isAuthenticated ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-center gap-3">
            <button
              onClick={() => setIsSignUp(false)}
              className={`${pillButtonBase} ${
                !isSignUp
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              className={`${pillButtonBase} ${
                isSignUp ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                <li>Send emails on your behalf</li>
                <li>Read your calendar events</li>
                <li>Create and manage calendar events</li>
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
              
              {/* Indexing Status Indicator */}
              {isEmailIndexingInProgress && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-blue-800">
                      Indexing your emails... {user?.emailIndexingStartedAt && `(Started ${new Date(user.emailIndexingStartedAt).toLocaleTimeString()})`}
                    </p>
                  </div>
                </div>
              )}

              {/* Indexing Status Message */}
              {indexingStatus && !isEmailIndexingInProgress && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm text-emerald-800">{indexingStatus}</p>
                </div>
              )}

              {/* Start Indexing Button */}
              {!hasIndexed && !isEmailIndexingInProgress && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Index Your Emails</h3>
                  <p className="text-sm text-blue-800 mb-3">
                    Start indexing your emails from the last day to enable email search and management.
                  </p>
                  <button
                    onClick={triggerInitialIndexing}
                    disabled={isEmailIndexingInProgress}
                    className={`${buttonBase} bg-blue-600 text-white shadow-sm hover:bg-blue-500 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Start Indexing
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                <Link
                  href="/emails"
                  className={`${buttonBase} bg-blue-600 text-white shadow-sm hover:bg-blue-500 focus-visible:outline-blue-600`}
                >
                  View Emails
                </Link>
                <button
                  onClick={handleDisconnectGmail}
                  className={`${buttonBase} bg-rose-600 text-white shadow-sm hover:bg-rose-500 focus-visible:outline-rose-600`}
                >
                  Disconnect Gmail Account
                </button>
              </div>
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
    </main>
  );
}

