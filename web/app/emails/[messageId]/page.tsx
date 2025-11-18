'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { GET_EMAIL_CONTENT, GET_EMAIL_THREAD } from '@/lib/graphql/email-queries';
import { apolloClient } from '@/lib/apollo-client';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function EmailDetailPage() {
  const params = useParams();
  const messageId = params.messageId as string;
  const [threadId, setThreadId] = useState<string | null>(null);

  const { data: emailData, loading: emailLoading, error: emailError } = useQuery(GET_EMAIL_CONTENT, {
    variables: { messageId },
    client: apolloClient,
    fetchPolicy: 'cache-and-network',
  });

  const { data: threadData, loading: threadLoading } = useQuery(GET_EMAIL_THREAD, {
    variables: { threadId },
    client: apolloClient,
    skip: !threadId,
    fetchPolicy: 'cache-and-network',
  });

  useEffect(() => {
    if (emailData?.emailContent?.threadId) {
      setThreadId(emailData.emailContent.threadId);
    }
  }, [emailData]);

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (emailLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading email...</p>
      </div>
    );
  }

  if (emailError) {
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        <p>Error loading email: {emailError.message}</p>
        <Link href="/emails" style={{ color: '#0070f3', textDecoration: 'none', marginTop: '1rem', display: 'inline-block' }}>
          ← Back to Emails
        </Link>
      </div>
    );
  }

  const email = emailData?.emailContent;
  if (!email) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Email not found</p>
        <Link href="/emails" style={{ color: '#0070f3', textDecoration: 'none', marginTop: '1rem', display: 'inline-block' }}>
          ← Back to Emails
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/emails" style={{ color: '#0070f3', textDecoration: 'none', marginBottom: '1rem', display: 'inline-block' }}>
          ← Back to Emails
        </Link>
      </div>

      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '2rem' }}>
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {email.subject || '(No Subject)'}
          </h1>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>
            <div style={{ marginBottom: '0.25rem' }}>
              <strong>From:</strong> {email.from}
            </div>
            {email.to.length > 0 && (
              <div style={{ marginBottom: '0.25rem' }}>
                <strong>To:</strong> {email.to.join(', ')}
              </div>
            )}
            {email.cc && email.cc.length > 0 && (
              <div style={{ marginBottom: '0.25rem' }}>
                <strong>Cc:</strong> {email.cc.join(', ')}
              </div>
            )}
            {email.bcc && email.bcc.length > 0 && (
              <div style={{ marginBottom: '0.25rem' }}>
                <strong>Bcc:</strong> {email.bcc.join(', ')}
              </div>
            )}
            <div style={{ marginTop: '0.5rem', color: '#999' }}>
              {formatDate(email.date)}
            </div>
          </div>
        </div>

        {email.attachments && email.attachments.length > 0 && (
          <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Attachments:</strong>
            {email.attachments.map((att: any) => (
              <div key={att.attachmentId} style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>
                {att.filename} ({(att.size / 1024).toFixed(2)} KB)
              </div>
            ))}
          </div>
        )}

        <div style={{ lineHeight: '1.6' }}>
          {email.htmlBody ? (
            <div
              dangerouslySetInnerHTML={{ __html: email.htmlBody }}
              style={{ maxWidth: '100%', overflow: 'auto' }}
            />
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
              {email.textBody || 'No content available'}
            </pre>
          )}
        </div>
      </div>

      {threadId && threadData?.emailThread && threadData.emailThread.length > 1 && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Thread</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {threadData.emailThread
              .filter((e: any) => e.messageId !== messageId)
              .map((email: any) => (
                <Link
                  key={email.messageId}
                  href={`/emails/${email.messageId}`}
                  style={{
                    display: 'block',
                    padding: '1rem',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                    {email.from} • {formatDate(email.date)}
                  </div>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    {email.subject || '(No Subject)'}
                  </div>
                  {email.snippet && (
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>
                      {email.snippet}
                    </div>
                  )}
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

