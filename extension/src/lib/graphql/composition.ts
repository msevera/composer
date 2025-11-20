import { gql } from "@apollo/client";

export const COMPOSE_DRAFT_MUTATION = gql`
  mutation ComposeDraft($input: DraftCompositionInput!) {
    composeDraft(input: $input) {
      content
      sources
    }
  }
`;

