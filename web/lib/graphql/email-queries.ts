import { gql } from '@apollo/client';

export const GET_EMAILS = gql`
  query GetEmails($cursor: String, $limit: Int, $threadId: String, $isRead: Boolean) {
    emails(cursor: $cursor, limit: $limit, threadId: $threadId, isRead: $isRead) {
      emails {
        id
        messageId
        threadId
        userId
        subject
        from
        to
        cc
        bcc
        replyTo
        snippet
        date
        labels
        isRead
        hasAttachments
        attachmentCount
        indexedAt
        bodyFetched
        createdAt
        updatedAt
      }
      nextCursor
      prevCursor
      hasNext
      hasPrev
    }
  }
`;

export const GET_EMAIL_THREADS = gql`
  query GetEmailThreads($cursor: String, $limit: Int) {
    emailThreads(cursor: $cursor, limit: $limit) {
      threads {
        threadId
        userId
        emails {
          id
          messageId
          threadId
          subject
          from
          to
          snippet
          date
          isRead
          hasAttachments
        }
        emailCount
        subject
        lastEmailDate
        isRead
      }
      nextCursor
      prevCursor
      hasNext
      hasPrev
    }
  }
`;

export const GET_EMAIL_THREAD = gql`
  query GetEmailThread($threadId: String!) {
    emailThread(threadId: $threadId) {
      id
      messageId
      threadId
      subject
      from
      to
      cc
      bcc
      snippet
      date
      isRead
      hasAttachments
    }
  }
`;

export const GET_EMAIL_CONTENT = gql`
  query GetEmailContent($messageId: String!) {
    emailContent(messageId: $messageId) {
      messageId
      threadId
      userId
      subject
      from
      to
      cc
      bcc
      replyTo
      date
      textBody
      htmlBody
      attachments {
        attachmentId
        filename
        mimeType
        size
      }
      labels
    }
  }
`;

export const HAS_INITIAL_INDEXING_COMPLETED = gql`
  query HasInitialIndexingCompleted {
    hasInitialIndexingCompleted
  }
`;

export const INDEX_INITIAL_EMAILS = gql`
  mutation IndexInitialEmails {
    indexInitialEmails
  }
`;

export const INDEX_EMAIL = gql`
  mutation IndexEmail($messageId: String!) {
    indexEmail(messageId: $messageId)
  }
`;

