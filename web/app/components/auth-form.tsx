'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/better-auth-client';
import Link from 'next/link';

interface AuthFormProps {
  mode: 'login' | 'signup';
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [message, setMessage] = useState('');
  const [sendProductUpdates, setSendProductUpdates] = useState(true);

  // Check if user is already authenticated and redirect
  useEffect(() => {
    authClient.getSession().then((session) => {
      if (session?.data?.user) {
        router.push('/dashboard');
      }
    });
  }, [router]);

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      setMessage('');
      
      // Store the checkbox value in localStorage before OAuth redirect
      if (mode === 'signup') {
        localStorage.setItem('sendProductUpdates', sendProductUpdates.toString());
      }
      
      await authClient.signIn.social({
        provider: 'google',
        callbackURL:
          typeof window !== 'undefined'
            ? `${window.location.origin}/dashboard`
            : 'http://localhost:3000/dashboard',
        scopes: [
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
        ]
      });
      // After OAuth redirect, user will be redirected to home page where session check happens
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
      setIsSigningIn(false);
    }
  };

  const alertClasses = message
    ? message.toLowerCase().includes('error')
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : '';

  const isSignup = mode === 'signup';
  const title = isSignup ? 'Start a free trial' : 'Welcome back';
  const subtitle = isSignup
    ? 'Join thousands of teams already using Composer AI'
    : 'Sign in to your Composer AI account';

  return (
    <div className="min-h-screen">
      {/* Logo - Top Left (Fixed to viewport) */}
      <div className="fixed left-6 top-6 z-10">
        <h1 className="text-2xl font-serif text-slate-900">Composer AI</h1>
      </div>

      {/* Main Content */}
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-12">
        <div className="flex flex-1 flex-col justify-center">
        <h2 className="text-3xl font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-base text-slate-600">{subtitle}</p>

        {/* Trust Indicator - Only show on signup */}
        {/* {isSignup && (
          <div className="mt-6 flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="h-8 w-8 rounded-full bg-blue-500 border-2 border-white"></div>
              <div className="h-8 w-8 rounded-full bg-purple-500 border-2 border-white"></div>
              <div className="h-8 w-8 rounded-full bg-pink-500 border-2 border-white"></div>
            </div>
            <p className="text-sm text-slate-600">Trusted by 25,000+ teams</p>
          </div>
        )} */}

        {/* Auth Buttons */}
        <div className="mt-8 space-y-3">
          <button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningIn ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"></div>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>

        {/* Product Updates Checkbox - Only show on signup */}
        {isSignup && (
          <div className="mt-6 flex items-start gap-2">
            <input
              type="checkbox"
              id="product-updates"
              checked={sendProductUpdates}
              onChange={(e) => setSendProductUpdates(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="product-updates" className="text-sm text-slate-600">
              Send me product updates and tips to get the most out of Composer AI
            </label>
          </div>
        )}

        {/* Switch between login/signup */}
        <p className="mt-8 text-center text-sm text-slate-600">
          {isSignup ? (
            <>
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
                Log in
              </Link>
            </>
          ) : (
            <>
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-700">
                Sign up
              </Link>
            </>
          )}
        </p>

        {/* Error Message */}
        {message && (
          <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${alertClasses}`}>
            {message}
          </div>
        )}

        {/* Footer */}
        <p className="mt-12 text-center text-xs text-slate-500">
          By continuing, you agree to our{' '}
          <a href="#" className="text-blue-600 hover:text-blue-700">
            Terms
          </a>{' '}
          and{' '}
          <a href="#" className="text-blue-600 hover:text-blue-700">
            Privacy Policy
          </a>
          .
        </p>
        </div>
      </div>
    </div>
  );
}

