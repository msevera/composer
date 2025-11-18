'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_EMAIL_CONTENT, GET_EMAIL_THREAD, CREATE_EMAIL_DRAFT } from '@/lib/graphql/email-queries';
import { apolloClient } from '@/lib/apollo-client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { GET_CURRENT_USER } from '@/lib/graphql/user-queries';

export default function EmailDetailPage() {
  const params = useParams();
  const messageId = params.messageId as string;
  const [threadId, setThreadId] = useState<string | null>(null);
  const [toField, setToField] = useState('');
  const [ccField, setCcField] = useState('');
  const [bccField, setBccField] = useState('');
  const [subjectField, setSubjectField] = useState('');
  const [bodyField, setBodyField] = useState('');
  const [draftMessage, setDraftMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [didPrefill, setDidPrefill] = useState(false);

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

  const { data: userData } = useQuery(GET_CURRENT_USER, {
    client: apolloClient,
  });

  const [createDraft, { loading: draftSaving }] = useMutation(CREATE_EMAIL_DRAFT, {
    client: apolloClient,
  });

  useEffect(() => {
    if (emailData?.emailContent?.threadId) {
      setThreadId(emailData.emailContent.threadId);
    }
  }, [emailData]);

  useEffect(() => {
    if (!emailData?.emailContent || !userData?.me || didPrefill) {
      return;
    }

    const email = emailData.emailContent;
    const userEmail = userData.me.email?.toLowerCase();
    const uniqueRecipients = new Set<string>();

    const normalizeList = (list?: string[]) => list?.map((addr) => addr.trim()).filter(Boolean) ?? [];
    const addRecipients = (list: string[]) => {
      list.forEach((addr) => {
        if (addr && addr.toLowerCase() !== userEmail) {
          uniqueRecipients.add(addr);
        }
      });
    };

    const primaryRecipients = email.replyTo ? [email.replyTo] : [email.from];
    addRecipients(normalizeList(primaryRecipients));
    addRecipients(normalizeList(email.to));
    addRecipients(normalizeList(email.cc));

    const toList = Array.from(uniqueRecipients);
    setToField(toList.join(', '));
    setCcField('');
    setBccField('');

    const subject = email.subject
      ? email.subject.trim().toLowerCase().startsWith('re:')
        ? email.subject
        : `Re: ${email.subject}`
      : 'Re:';
    setSubjectField(subject);

    const quotedSnippet = email.textBody
      ? email.textBody
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n')
      : email.snippet || '';
    const defaultBody = `\n\nOn ${new Date(email.date).toLocaleString()}, ${email.from} wrote:\n${quotedSnippet}`;
    setBodyField(defaultBody);

    setDidPrefill(true);
  }, [emailData, userData, didPrefill]);

  const parseRecipients = (value: string) =>
    value
      .split(',')
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0);

  const handleDraftSave = async () => {
    if (!emailData?.emailContent) {
      return;
    }

    const to = parseRecipients(toField);
    const cc = parseRecipients(ccField);
    const bcc = parseRecipients(bccField);

    if (to.length === 0) {
      setDraftMessage({ type: 'error', text: 'Please specify at least one recipient.' });
      return;
    }

    try {
      await createDraft({
        variables: {
          input: {
            messageId: emailData.emailContent.messageId,
            threadId: emailData.emailContent.threadId,
            subject: subjectField,
            body: bodyField,
            to,
            cc: cc.length ? cc : undefined,
            bcc: bcc.length ? bcc : undefined,
          },
        },
      });
      setDraftMessage({ type: 'success', text: 'Draft saved to Gmail.' });
    } catch (error: any) {
      setDraftMessage({ type: 'error', text: error.message || 'Failed to save draft.' });
    }
  };

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

      <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Reply (Draft in Gmail)</h2>
        {draftMessage && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              backgroundColor: draftMessage.type === 'success' ? '#e8f5e9' : '#ffebee',
              color: draftMessage.type === 'success' ? '#2e7d32' : '#c62828',
            }}
          >
            {draftMessage.text}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label>
            <span style={{ display: 'block', fontSize: '0.875rem', color: '#555', marginBottom: '0.25rem' }}>To</span>
            <input
              type="text"
              value={toField}
              onChange={(e) => setToField(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
              placeholder="recipient@example.com"
            />
          </label>
          <label>
            <span style={{ display: 'block', fontSize: '0.875rem', color: '#555', marginBottom: '0.25rem' }}>Cc</span>
            <input
              type="text"
              value={ccField}
              onChange={(e) => setCcField(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
              placeholder="Optional"
            />
          </label>
          <label>
            <span style={{ display: 'block', fontSize: '0.875rem', color: '#555', marginBottom: '0.25rem' }}>Bcc</span>
            <input
              type="text"
              value={bccField}
              onChange={(e) => setBccField(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
              placeholder="Optional"
            />
          </label>
          <label>
            <span style={{ display: 'block', fontSize: '0.875rem', color: '#555', marginBottom: '0.25rem' }}>Subject</span>
            <input
              type="text"
              value={subjectField}
              onChange={(e) => setSubjectField(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
          </label>
          <label>
            <span style={{ display: 'block', fontSize: '0.875rem', color: '#555', marginBottom: '0.25rem' }}>Body</span>
            <textarea
              value={bodyField}
              onChange={(e) => setBodyField(e.target.value)}
              rows={10}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', fontFamily: 'inherit' }}
            />
          </label>
          <button
            onClick={handleDraftSave}
            disabled={draftSaving}
            style={{
              alignSelf: 'flex-start',
              padding: '0.75rem 1.5rem',
              backgroundColor: draftSaving ? '#93c5fd' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: draftSaving ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {draftSaving ? 'Saving...' : 'Save Draft'}
          </button>
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

