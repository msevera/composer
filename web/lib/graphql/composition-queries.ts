import { gql } from '@apollo/client';

export const COMPOSE_DRAFT = gql`
  mutation ComposeDraft($input: DraftCompositionInput!) {
    composeDraft(input: $input) {
      content
      sources
    }
  }
`;

export const COMPOSE_TWEET = gql`
  mutation ComposeTweet($input: DraftCompositionInput!) {
    composeTweet(input: $input) {
      content
      sources
    }
  }
`;

