import { gql } from '@apollo/client';

export const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    me {
      id
      email
    }
  }
`;

export const SEND_QUICK_NOTE = gql`
  mutation SendQuickNote($content: String!) {
    sendQuickNote(content: $content)
  }
`;
