'use client';

import { useState, useEffect } from 'react';
import { authClient } from '@/lib/better-auth-client';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is already authenticated
    authClient.getSession()
      .then((session) => {
        if (session?.data?.user) {
          setIsAuthenticated(true);
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
  }, []);

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

