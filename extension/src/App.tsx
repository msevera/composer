import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react/index.js';
import { GET_CURRENT_USER, SEND_QUICK_NOTE } from './graphql';
import { authClient } from './lib/betterAuthClient';

type CurrentUserResponse = {
  me: {
    id: string;
    email: string;
  } | null;
};

type Status = 'idle' | 'success' | 'error';
type SessionUser = { id: string; email: string } | null;

export default function App() {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [noteStatus, setNoteStatus] = useState<Status>('idle');
  const [sessionUser, setSessionUser] = useState<SessionUser>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const shouldFetchUser = Boolean(sessionUser);
  const {
    data,
    loading: userLoading,
    error: sessionError,
    refetch,
  } = useQuery<CurrentUserResponse>(GET_CURRENT_USER, {
    fetchPolicy: 'network-only',
    skip: !shouldFetchUser,
  });

  const user = data?.me ?? null;
  const isAuthenticated = Boolean(sessionUser);

  const [sendQuickNote, { loading: sending }] = useMutation(SEND_QUICK_NOTE, {
    onCompleted: () => {
      setNoteStatus('success');
      setMessage('');
    },
    onError: () => {
      setNoteStatus('error');
    },
  });

  useEffect(() => {
    authClient
      .getSession()
      .then((session) => {
        if (session?.data?.user) {
          setSessionUser({
            id: session.data.user.id,
            email: session.data.user.email,
          });
        } else {
          setSessionUser(null);
        }
      })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (noteStatus === 'idle') return;
    const timeout = setTimeout(() => setNoteStatus('idle'), 2000);
    return () => clearTimeout(timeout);
  }, [noteStatus]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      setAuthError('Please enter email and password.');
      return;
    }
    setSigningIn(true);
    setAuthError('');
    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });
      if (result.error) {
        setAuthError(result.error.message ?? 'Failed to sign in.');
        setSessionUser(null);
        return;
      }
      if (result.data?.user) {
        setSessionUser({
          id: result.data.user.id,
          email: result.data.user.email,
        });
      }
      await refetch?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to sign in.');
      setAuthError(err.message);
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      setSessionUser(null);
      setMessage('');
      setEmail('');
      setPassword('');
      setAuthError('');
      await refetch?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to sign out.');
      setAuthError(err.message);
    } finally {
      setSigningOut(false);
    }
  };

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }
    setNoteStatus('idle');
    sendQuickNote({ variables: { content: message.trim() } });
  };

  const showSignIn = useMemo(() => {
    if (checkingSession) return false;
    if (sessionError) return true;
    return !isAuthenticated;
  }, [checkingSession, sessionError, isAuthenticated]);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ snailAuthenticated: isAuthenticated });
    }
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen w-[360px] bg-slate-50 text-slate-900 p-4">
      <div className="space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-snail-500 to-snail-700 text-white font-semibold flex items-center justify-center shadow-card">
              S
            </div>
            <div>
              <p className="text-sm font-semibold">Snail</p>
              <p className="text-xs text-slate-500">Smail companion extension</p>
            </div>
          </div>
          {isAuthenticated && (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          )}
        </header>

        {(checkingSession || userLoading) && isAuthenticated && (
          <div className="rounded-2xl bg-white shadow-card border border-slate-100 p-4 text-sm text-slate-600">
            <p>Checking session…</p>
          </div>
        )}

        {!checkingSession && isAuthenticated && (
          <div className="rounded-2xl bg-white shadow-card border border-slate-100 p-4 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Signed in as</p>
              <p className="text-base font-semibold text-slate-900">
                {sessionUser?.email || user?.email}
              </p>
            </div>

            <form className="space-y-3" onSubmit={handleSend}>
              <label className="text-sm font-medium text-slate-700" htmlFor="quick-note">
                Quick note
              </label>
              <textarea
                id="quick-note"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-snail-200 focus:border-snail-500 min-h-[120px] resize-vertical"
                placeholder="Type something to send to your Smail workspace…"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <button
                type="submit"
                disabled={!message.trim() || sending}
                className="inline-flex w-full items-center justify-center rounded-xl bg-snail-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-snail-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending…' : 'Send note'}
              </button>
              {noteStatus === 'success' && (
                <p className="text-xs text-green-600">Sent!</p>
              )}
              {noteStatus === 'error' && (
                <p className="text-xs text-red-600">Failed to send note. Please try again.</p>
              )}
            </form>
          </div>
        )}

        {showSignIn && (
          <div className="rounded-2xl bg-white shadow-card border border-slate-100 p-4 space-y-4">
      <div>
              <p className="text-base font-semibold text-slate-900">Sign in to continue</p>
              <p className="text-sm text-slate-500">Authenticate with your Smail credentials.</p>
            </div>
            <form className="space-y-3" onSubmit={handleSignIn}>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-snail-200 focus:border-snail-500"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-snail-200 focus:border-snail-500"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
      </div>
              <button
                type="submit"
                disabled={signingIn}
                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {signingIn ? 'Signing in…' : 'Sign in'}
        </button>
              {(authError || sessionError) && (
                <p className="text-xs text-red-600">
                  {authError || sessionError?.message || 'Unable to verify session.'}
        </p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
