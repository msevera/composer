'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { authClient } from '@/lib/better-auth-client';
import { apolloClient } from '@/lib/apollo-client';
import { GET_ME, DELETE_ACCOUNT } from '@/lib/graphql/user-queries';
import { UserRound, Trash2 } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string>('');
  const modalRef = useRef<HTMLDivElement>(null);

  const { data: userData, loading: userLoading } = useQuery(GET_ME, {
    client: apolloClient,
  });

  const [deleteAccount, { loading: isDeletingAccount }] = useMutation(DELETE_ACCOUNT, {
    client: apolloClient,
  });

  const user = userData?.me;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowDeleteConfirm(false);
      }
    };

    if (showDeleteConfirm) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDeleteConfirm]);

  const handleDeleteAccount = async () => {
    setError('');
    try {
      await deleteAccount();
      // Sign out and redirect after successful deletion
      await authClient.signOut();
      router.replace('/signup');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to delete account');
    }
  };

  if (userLoading) {
    return null;
  }

  return (
    <>
      <div className="rounded-3xl bg-white p-6 shadow-sm lg:p-8">
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-slate-900">Account Settings</h1>
          <p className="text-sm text-slate-500">Manage your account information and preferences</p>
        </div>

        <div className="space-y-6">
          {/* User Info Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <UserRound className="h-6 w-6 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{user?.name ?? user?.email}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Delete Account Section */}
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Delete Account</h2>
              <p className="text-sm text-slate-600">
                Once you delete your account, there is no going back. Please be certain.
              </p>
            </div>
            {error && (
              <div className="mb-4 rounded-xl border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeletingAccount}
              className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div ref={modalRef} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Delete Account</h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeletingAccount}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="flex-1 rounded-xl border border-red-300 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

