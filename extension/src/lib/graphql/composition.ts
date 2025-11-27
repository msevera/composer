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

