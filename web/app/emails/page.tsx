'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_EMAIL_THREADS, INDEX_INITIAL_EMAILS, HAS_INITIAL_INDEXING_COMPLETED } from '@/lib/graphql/email-queries';
import { GET_CURRENT_USER } from '@/lib/graphql/user-queries';
import { apolloClient } from '@/lib/apollo-client';
import Link from 'next/link';

interface EmailThread {
  threadId: string;
  emails: Array<{
    id: string;
    messageId: string;
    subject?: string;
    from: string;
    snippet?: string;
    date: Date;
    isRead: boolean;
  }>;
  emailCount: number;
  subject?: string;
  lastEmailDate: Date;
  isRead: boolean;
}

export default function EmailsPage() {
  const [cursor, setCursor] = useState<string | undefined>();
  const [indexingStatus, setIndexingStatus] = useState<string>('');

  const { data, loading, error, refetch } = useQuery(GET_EMAIL_THREADS, {
    variables: { cursor, limit: 50 },
    client: apolloClient,
    fetchPolicy: 'cache-and-network',
  });

  // Get current user with indexing status
  const { data: userData, refetch: refetchUser } = useQuery(GET_CURRENT_USER, {
    client: apolloClient,
    fetchPolicy: 'network-only',
    pollInterval: 3000, // Poll every 3 seconds to check indexing status
  });

  // Check if initial indexing has been completed
  const { data: indexingStatusData } = useQuery(HAS_INITIAL_INDEXING_COMPLETED, {
    client: apolloClient,
    fetchPolicy: 'network-only',
  });

  const [indexInitialEmails] = useMutation(INDEX_INITIAL_EMAILS, {
    client: apolloClient,
  });

  const user = userData?.me;
  const isEmailIndexingInProgress = user?.isEmailIndexingInProgress ?? false;
  const hasIndexed = indexingStatusData?.hasInitialIndexingCompleted ?? false;

  const handleStartIndexing = async () => {
    setIndexingStatus('Queuing indexing job...');
    try {
      const result = await indexInitialEmails();
      setIndexingStatus(result.data?.indexInitialEmails || 'Indexing job queued');
      await refetchUser();
      setTimeout(() => setIndexingStatus(''), 5000);
    } catch (error: any) {
      setIndexingStatus(`Error: ${error.message}`);
    }
  };

  const handleNext = () => {
    if (data?.emailThreads?.nextCursor) {
      setCursor(data.emailThreads.nextCursor);
    }
  };

  const handlePrev = () => {
    if (data?.emailThreads?.prevCursor) {
      setCursor(data.emailThreads.prevCursor);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return d.toLocaleDateString([], { weekday: 'short' });
    } else {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading emails...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        <p>Error loading emails: {error.message}</p>
      </div>
    );
  }

  const threads: EmailThread[] = data?.emailThreads?.threads || [];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Emails</h1>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none' }}>
          ← Back to Home
        </Link>
      </div>

      {/* Indexing Status Indicator */}
      {isEmailIndexingInProgress && (
        <div style={{ padding: '1rem', backgroundColor: '#f0f8ff', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #b3d9ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '16px', height: '16px', border: '2px solid #0070f3', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ margin: 0, color: '#0066cc' }}>
              Indexing your emails... {user?.emailIndexingStartedAt && `(Started ${new Date(user.emailIndexingStartedAt).toLocaleTimeString()})`}
            </p>
          </div>
        </div>
      )}

      {/* Indexing Status Message */}
      {indexingStatus && !isEmailIndexingInProgress && (
        <div style={{ padding: '1rem', backgroundColor: '#e8f5e9', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #c8e6c9' }}>
          <p style={{ margin: 0, color: '#2e7d32' }}>{indexingStatus}</p>
        </div>
      )}

      {threads.length === 0 && !hasIndexed && !isEmailIndexingInProgress ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          <p>No emails found. Click the button below to index your emails.</p>
          <button
            onClick={handleStartIndexing}
            disabled={isEmailIndexingInProgress}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: isEmailIndexingInProgress ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isEmailIndexingInProgress ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              opacity: isEmailIndexingInProgress ? 0.6 : 1,
            }}
          >
            Start Indexing
          </button>
        </div>
      ) : threads.length === 0 && hasIndexed ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          <p>No emails found in your inbox.</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '1rem' }}>
            {threads.map((thread) => {
              const latestEmail = thread.emails[0];
              return (
                <Link
                  key={thread.threadId}
                  href={`/emails/${latestEmail.messageId}`}
                  style={{
                    display: 'block',
                    padding: '1rem',
                    borderBottom: '1px solid #e5e7eb',
                    textDecoration: 'none',
                    color: 'inherit',
                    backgroundColor: thread.isRead ? 'white' : '#f9fafb',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: thread.isRead ? 'normal' : 'bold' }}>
                          {thread.subject || latestEmail.subject || '(No Subject)'}
                        </span>
                        {!thread.isRead && (
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#0070f3',
                            }}
                          />
                        )}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>
                        {latestEmail.from}
                        {thread.emailCount > 1 && (
                          <span style={{ marginLeft: '0.5rem', color: '#999' }}>
                            ({thread.emailCount} {thread.emailCount === 1 ? 'email' : 'emails'})
                          </span>
                        )}
                      </div>
                      {latestEmail.snippet && (
                        <div style={{ fontSize: '0.875rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {latestEmail.snippet}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#999', marginLeft: '1rem' }}>
                      {formatDate(thread.lastEmailDate)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <button
              onClick={handlePrev}
              disabled={!data?.emailThreads?.hasPrev}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: data?.emailThreads?.hasPrev ? '#0070f3' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: data?.emailThreads?.hasPrev ? 'pointer' : 'not-allowed',
                fontSize: '1rem',
              }}
            >
              ← Previous
            </button>
            <button
              onClick={handleNext}
              disabled={!data?.emailThreads?.hasNext}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: data?.emailThreads?.hasNext ? '#0070f3' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: data?.emailThreads?.hasNext ? 'pointer' : 'not-allowed',
                fontSize: '1rem',
              }}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

