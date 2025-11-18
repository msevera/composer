import { gql } from '@apollo/client';

export const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    me {
      id
      email
      lastSignIn
      isEmailIndexingInProgress
      emailIndexingStartedAt
      createdAt
      updatedAt
    }
  }
`;

