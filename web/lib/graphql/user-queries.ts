import { gql } from '@apollo/client';

export const UPDATE_SEND_PRODUCT_UPDATES = gql`
  mutation UpdateSendProductUpdates($sendProductUpdates: Boolean!) {
    updateSendProductUpdates(sendProductUpdates: $sendProductUpdates) {
      id
      email
      sendProductUpdates
    }
  }
`;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      email
      name
      sendProductUpdates
      onboardingCompleted
      maxDraftsAllowed
      draftsUsed
      lastSignIn
      createdAt
      updatedAt
    }
  }
`;

export const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    me {
      id
      email
      name
      onboardingCompleted
      lastSignIn
      createdAt
      updatedAt
    }
  }
`;

export const SET_ONBOARDING_COMPLETED = gql`
  mutation SetOnboardingCompleted($onboardingCompleted: Boolean!) {
    setOnboardingCompleted(onboardingCompleted: $onboardingCompleted) {
      id
      onboardingCompleted
    }
  }
`;

