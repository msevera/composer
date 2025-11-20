import { gql } from "@apollo/client";

export const COMPOSE_DRAFT_AGENT_MUTATION = gql`
  mutation ComposeDraftWithAgent($input: ComposeDraftAgentInput!) {
    composeDraftWithAgent(input: $input) {
      ... on DraftResult {
        status
        draftContent
        conversationId
        activity
      }
      ... on ClarificationRequired {
        status
        question
        conversationId
        activity
      }
    }
  }
`;

export const RESUME_DRAFT_COMPOSITION_MUTATION = gql`
  mutation ResumeDraftComposition($input: ResumeDraftCompositionInput!) {
    resumeDraftComposition(input: $input) {
      ... on DraftResult {
        status
        draftContent
        conversationId
        activity
      }
      ... on ClarificationRequired {
        status
        question
        conversationId
        activity
      }
    }
  }
`;

