'use client';

import { useState, useEffect } from 'react';
import { authClient } from '@/lib/better-auth-client';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isCheckingGmail, setIsCheckingGmail] = useState(false);

  useEffect(() => {
    // Check if user is already authenticated
    authClient.getSession()
      .then((session) => {
        if (session?.data?.user) {
          console.log('session', session)
          setIsAuthenticated(true);
          // Check Gmail connection status
          checkGmailConnection();
        } else if (session?.error) {
          // 401 or other error means not authenticated - this is normal
          console.log('No active session (user not logged in)');
        }
      })
      .catch((error) => {
        // Silently fail if session check fails (user not logged in)
        // 401 is expected when there's no session
        if (error?.status !== 401) {
          console.log('Session check error:', error);
        }
      });

    // Check if we're returning from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('provider') === 'google' || window.location.pathname.includes('callback')) {
      // Recheck Gmail connection after OAuth callback
      setTimeout(() => {
        checkGmailConnection();
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }, 1000);
    }
  }, []);

  // Re-check Gmail connection when authentication state changes
  useEffect(() => {
    if (isAuthenticated) {
      checkGmailConnection();
    }
  }, [isAuthenticated]);

  const checkGmailConnection = async () => {
    if (!isAuthenticated) {
      setIsGmailConnected(false);
      return;
    }

    const accounts = await authClient.listAccounts();
    const googleAccount = accounts.data?.find((account: any) => account.providerId === 'google');
    console.log('googleAccount', accounts, googleAccount);
    if (googleAccount) {
      setIsGmailConnected(true);
    } else {
      setIsGmailConnected(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      const { data } = await authClient.signIn.social({
        provider: "google",
        callbackURL: 'http://localhost:3000/',
      });

      
      // // Call Better-Auth API to link Google account
      // const apiUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:4000/api/auth';
      // const response = await fetch(`${apiUrl}/link-social`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   credentials: 'include',
      //   body: JSON.stringify({
      //     provider: 'google',
      //     callbackURL: window.location.href,
      //   }),
      // });

      // const result = await response.json();

      // if (result.url) {
      //   // Redirect to Google OAuth
      //   window.location.href = result.url;
      // } else if (result.error) {
      //   setMessage(`Error: ${result.error.message || 'Failed to connect Gmail'}`);
      // }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleDisconnectGmail = async () => {
    await authClient.unlinkAccount({
      providerId: "google"
    });

    checkGmailConnection();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      if (isSignUp) {
        // Use Better-Auth client for sign up
        const result = await authClient.signUp.email({
          email,
          password,
          name: email.split('@')[0], // Use email username as name
        });

        if (result.error) {
          setMessage(`Error: ${result.error.message}`);
        } else {
          setMessage('User registered successfully!');
          setIsAuthenticated(true);
        }
      } else {
        // Use Better-Auth client for sign in
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

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>Smail Authentication</h1>

      {!isAuthenticated ? (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={() => setIsSignUp(false)}
              style={{
                padding: '0.5rem 1rem',
                marginRight: '0.5rem',
                backgroundColor: !isSignUp ? '#0070f3' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: isSignUp ? '#0070f3' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Email:
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
            </div>

            <div>
              <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Password:
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                padding: '0.75rem',
                backgroundColor: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>

          {message && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: message.includes('Error') ? '#fee' : '#efe',
                border: `1px solid ${message.includes('Error') ? '#fcc' : '#cfc'}`,
                borderRadius: '4px',
              }}
            >
              {message}
            </div>
          )}
        </div>
      ) : (
        <div>
          <p style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>
            You are authenticated! 🎉
          </p>

          {isCheckingGmail ? (
            <div
              style={{
                padding: '1.5rem',
                border: '2px solid #ccc',
                borderRadius: '8px',
                marginBottom: '1rem',
                backgroundColor: '#f9f9f9',
                textAlign: 'center',
              }}
            >
              <p style={{ color: '#666' }}>Checking Gmail connection...</p>
            </div>
          ) : !isGmailConnected ? (
            <div
              style={{
                padding: '1.5rem',
                border: '2px solid #0070f3',
                borderRadius: '8px',
                marginBottom: '1rem',
                backgroundColor: '#f0f8ff',
              }}
            >
              <h2 style={{ marginBottom: '0.5rem' }}>Connect Your Gmail</h2>
              <p style={{ marginBottom: '1rem', color: '#666' }}>
                Connect your Gmail account to:
              </p>
              <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }}>
                <li>Read and manage your emails</li>
                <li>Send emails on your behalf</li>
                <li>Read your calendar events</li>
                <li>Create and manage calendar events</li>
              </ul>
              <button
                onClick={handleConnectGmail}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#4285f4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                }}
              >
                Connect Gmail Account
              </button>
            </div>
          ) : (
            <div
              style={{
                padding: '1.5rem',
                border: '2px solid #0f9d58',
                borderRadius: '8px',
                marginBottom: '1rem',
                backgroundColor: '#e8f5e9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>✓</span>
                <h2 style={{ margin: 0, color: '#0f9d58' }}>Gmail Account Connected</h2>
              </div>
              <p style={{ color: '#2e7d32', marginBottom: '1rem' }}>
                Your Gmail account is connected. You can now read emails, send emails, and manage your calendar.
              </p>
              <button
                onClick={handleDisconnectGmail}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                }}
              >
                Disconnect Gmail Account
              </button>
            </div>
          )}

          {message && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '1rem',
                backgroundColor: message.includes('Error') ? '#fee' : '#efe',
                border: `1px solid ${message.includes('Error') ? '#fcc' : '#cfc'}`,
                borderRadius: '4px',
              }}
            >
              {message}
            </div>
          )}

          <button
            onClick={handleSignOut}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f33',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </main>
  );
}

