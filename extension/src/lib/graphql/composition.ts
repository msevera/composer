import { gql } from "@apollo/client";

export const GET_CONVERSATION_STATE_QUERY = gql`
  query GetConversationState($conversationId: String!) {
    getConversationState(conversationId: $conversationId) {
      conversationId
      exists
      messages {
        role
        content
        kind
      }
    }
  }
`;

export const COPY_DRAFT_MUTATION = gql`
  mutation CopyDraft($threadId: String, $conversationId: String) {
    copyDraft(threadId: $threadId, conversationId: $conversationId)
  }
`;

